import { db } from "../firebaseAdmin.js";
import {
  getTwilioFallbackDelayMs,
  isTwilioReminderConfigured,
  triggerMechanicReminderCall,
} from "./twilioService.js";
import { getRequestSnapshot, getUserSnapshot } from "./notificationService.js";

const FALLBACK_STATUS = {
  SCHEDULED: "scheduled",
  TRIGGERING: "triggering",
  COMPLETED: "completed",
  SKIPPED: "skipped",
  FAILED: "failed",
  DISABLED: "disabled",
  CANCELLED: "cancelled",
};

const SWEEP_INTERVAL_MS = 15000;
const activeTimers = new Map();

const getRequestRef = (requestId) =>
  db.collection("serviceRequests").doc(requestId);

const asDate = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const clearFallbackTimer = (requestId) => {
  const timerEntry = activeTimers.get(requestId);

  if (timerEntry?.timer) {
    clearTimeout(timerEntry.timer);
    activeTimers.delete(requestId);
  }
};

const updateFallbackCallFields = async (requestId, patch) => {
  await getRequestRef(requestId).set(
    {
      ...patch,
      fallbackCallUpdatedAt: new Date(),
    },
    { merge: true }
  );
};

const getMechanicPhoneNumberForRequest = async (request) => {
  if (request.mechanicPhoneNumber) {
    return request.mechanicPhoneNumber;
  }

  const mechanic = await getUserSnapshot(request.mechanicId);
  return mechanic.phoneNumber || "";
};

const markFallbackCallSkipped = async (requestId, reason) => {
  await updateFallbackCallFields(requestId, {
    fallbackCallStatus: FALLBACK_STATUS.SKIPPED,
    fallbackCallSkippedReason: reason,
    fallbackCallCompletedAt: new Date(),
  });
};

const claimFallbackCall = async (requestId) =>
  db.runTransaction(async (transaction) => {
    const requestRef = getRequestRef(requestId);
    const snapshot = await transaction.get(requestRef);

    if (!snapshot.exists) {
      return { shouldTrigger: false, reason: "request-missing" };
    }

    const request = {
      id: snapshot.id,
      ...snapshot.data(),
    };

    const scheduledFor = asDate(request.fallbackCallScheduledFor);

    if (request.status !== "Pending") {
      transaction.set(
        requestRef,
        {
          fallbackCallStatus: FALLBACK_STATUS.SKIPPED,
          fallbackCallSkippedReason: "request-not-pending",
          fallbackCallCompletedAt: new Date(),
          fallbackCallUpdatedAt: new Date(),
        },
        { merge: true }
      );

      return { shouldTrigger: false, reason: "request-not-pending" };
    }

    if (request.fallbackCallStatus !== FALLBACK_STATUS.SCHEDULED) {
      return {
        shouldTrigger: false,
        reason: request.fallbackCallStatus || "not-scheduled",
      };
    }

    if (scheduledFor && scheduledFor.getTime() > Date.now()) {
      return {
        shouldTrigger: false,
        reason: "not-due-yet",
        scheduledFor,
      };
    }

    transaction.set(
      requestRef,
      {
        fallbackCallStatus: FALLBACK_STATUS.TRIGGERING,
        fallbackCallTriggeredAt: new Date(),
        fallbackCallLastAttemptAt: new Date(),
        fallbackCallAttemptCount: (request.fallbackCallAttemptCount || 0) + 1,
        fallbackCallUpdatedAt: new Date(),
        fallbackCallError: null,
        fallbackCallSkippedReason: null,
      },
      { merge: true }
    );

    return {
      shouldTrigger: true,
      request,
    };
  });

export const processFallbackCallForRequest = async (requestId) => {
  clearFallbackTimer(requestId);

  console.log("[fallback-call] Processing fallback call", {
    requestId,
  });

  if (!isTwilioReminderConfigured()) {
    await updateFallbackCallFields(requestId, {
      fallbackCallStatus: FALLBACK_STATUS.DISABLED,
      fallbackCallSkippedReason: "twilio-not-configured",
      fallbackCallCompletedAt: null,
    });
    return {
      success: false,
      skipped: true,
      reason: "twilio-not-configured",
    };
  }

  const claim = await claimFallbackCall(requestId);

  if (!claim.shouldTrigger) {
    if (claim.reason === "request-missing") {
      console.warn("[fallback-call] Request missing during processing", {
        requestId,
      });
      return {
        success: false,
        skipped: true,
        reason: claim.reason,
      };
    }

    if (claim.reason === "request-not-pending") {
      console.log("[fallback-call] Request no longer pending, skipping", {
        requestId,
      });
      return {
        success: false,
        skipped: true,
        reason: claim.reason,
      };
    }

    if (claim.reason === "not-due-yet" && claim.scheduledFor) {
      console.log("[fallback-call] Request not due yet, rescheduling", {
        requestId,
        scheduledFor: claim.scheduledFor,
      });
      scheduleFallbackCallTimer(requestId, claim.scheduledFor);
    }

    console.log("[fallback-call] Claim skipped", {
      requestId,
      reason: claim.reason,
    });

    return {
      success: false,
      skipped: true,
      reason: claim.reason,
    };
  }

  try {
    const mechanicPhoneNumber =
      claim.request.mechanicPhoneNumber ||
      (await getMechanicPhoneNumberForRequest(claim.request));

    if (!mechanicPhoneNumber) {
      await markFallbackCallSkipped(requestId, "mechanic-phone-missing");
      console.warn("[fallback-call] Mechanic phone missing", {
        requestId,
      });
      return {
        success: false,
        skipped: true,
        reason: "mechanic-phone-missing",
      };
    }

    const result = await triggerMechanicReminderCall({
      requestId,
      mechanicPhoneNumber,
    });

    await updateFallbackCallFields(requestId, {
      fallbackCallStatus: FALLBACK_STATUS.COMPLETED,
      fallbackCallProvider: "twilio",
      fallbackCallReference: result.callSid,
      fallbackCallCompletedAt: new Date(),
      fallbackCallError: null,
    });

    console.log("[fallback-call] Twilio reminder completed", {
      requestId,
      callSid: result.callSid,
    });

    return result;
  } catch (error) {
    await updateFallbackCallFields(requestId, {
      fallbackCallStatus: FALLBACK_STATUS.FAILED,
      fallbackCallError: error.message,
      fallbackCallCompletedAt: new Date(),
    });

    console.error("[fallback-call] Twilio reminder failed", {
      requestId,
      message: error.message,
    });

    throw error;
  }
};

export const scheduleFallbackCallTimer = (requestId, scheduledFor) => {
  const executionTime = asDate(scheduledFor) || new Date();
  const delayMs = Math.max(executionTime.getTime() - Date.now(), 0);
  const existingTimer = activeTimers.get(requestId);

  if (
    existingTimer?.scheduledFor &&
    existingTimer.scheduledFor.getTime() === executionTime.getTime()
  ) {
    return;
  }

  clearFallbackTimer(requestId);

  console.log("[fallback-call] Scheduling fallback timer", {
    requestId,
    scheduledFor: executionTime,
    delayMs,
  });

  const timer = setTimeout(() => {
    processFallbackCallForRequest(requestId).catch((error) => {
      console.error("[fallback-call] Timer execution failed", {
        requestId,
        message: error.message,
      });
    });
  }, delayMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  activeTimers.set(requestId, {
    timer,
    scheduledFor: executionTime,
  });
};

export const prepareFallbackCallForRequest = async (requestId) => {
  const request = await getRequestSnapshot(requestId);
  const fallbackDelayMs = getTwilioFallbackDelayMs();
  const scheduledFor = new Date(Date.now() + fallbackDelayMs);
  const twilioEnabled = isTwilioReminderConfigured();

  console.log("[fallback-call] Preparing fallback call", {
    requestId,
    requestStatus: request.status,
    twilioEnabled,
    fallbackDelayMs,
  });

  if (request.status !== "Pending") {
    await markFallbackCallSkipped(requestId, "request-not-pending");
    return {
      enabled: false,
      scheduled: false,
      skipped: true,
      reason: "request-not-pending",
    };
  }

  const mechanicPhoneNumber =
    request.mechanicPhoneNumber ||
    (await getMechanicPhoneNumberForRequest(request));

  if (!mechanicPhoneNumber) {
    await markFallbackCallSkipped(requestId, "mechanic-phone-missing");
    return {
      enabled: false,
      scheduled: false,
      skipped: true,
      reason: "mechanic-phone-missing",
    };
  }

  await updateFallbackCallFields(requestId, {
    fallbackCallEnabled: twilioEnabled,
    fallbackCallDelayMs: fallbackDelayMs,
    fallbackCallScheduledFor: scheduledFor,
    fallbackCallStatus: twilioEnabled
      ? FALLBACK_STATUS.SCHEDULED
      : FALLBACK_STATUS.DISABLED,
    fallbackCallProvider: "twilio",
    fallbackCallReference: null,
    fallbackCallTriggeredAt: null,
    fallbackCallCompletedAt: null,
    fallbackCallAttemptCount: 0,
    fallbackCallLastAttemptAt: null,
    fallbackCallSkippedReason: twilioEnabled
      ? null
      : "twilio-not-configured",
    fallbackCallError: null,
  });

  if (twilioEnabled) {
    scheduleFallbackCallTimer(requestId, scheduledFor);
  }

  return {
    enabled: twilioEnabled,
    scheduled: twilioEnabled,
    scheduledFor: scheduledFor.toISOString(),
    delayMs: fallbackDelayMs,
  };
};

export const cancelFallbackCallForRequest = async (
  requestId,
  reason = "request-accepted"
) => {
  clearFallbackTimer(requestId);

  console.log("[fallback-call] Cancelling fallback call", {
    requestId,
    reason,
  });

  const request = await getRequestSnapshot(requestId);
  const currentStatus = request.fallbackCallStatus || null;

  if (
    ![
      FALLBACK_STATUS.SCHEDULED,
      FALLBACK_STATUS.TRIGGERING,
    ].includes(currentStatus)
  ) {
    console.log("[fallback-call] Cancellation skipped", {
      requestId,
      currentStatus,
    });
    return;
  }

  await updateFallbackCallFields(requestId, {
    fallbackCallStatus: FALLBACK_STATUS.CANCELLED,
    fallbackCallSkippedReason: reason,
    fallbackCallCompletedAt: new Date(),
  });
};

const recoverScheduledFallbackCalls = async () => {
  const snapshot = await db
    .collection("serviceRequests")
    .where("status", "==", "Pending")
    .get();

  snapshot.forEach((docSnapshot) => {
    const request = docSnapshot.data();

    if (request.fallbackCallStatus !== FALLBACK_STATUS.SCHEDULED) {
      return;
    }

    scheduleFallbackCallTimer(
      docSnapshot.id,
      asDate(request.fallbackCallScheduledFor) || new Date()
    );
  });
};

export const startFallbackCallRecoveryLoop = () => {
  recoverScheduledFallbackCalls().catch((error) => {
    console.error("[fallback-call] Initial recovery failed", {
      message: error.message,
    });
  });

  const interval = setInterval(() => {
    recoverScheduledFallbackCalls().catch((error) => {
      console.error("[fallback-call] Recovery sweep failed", {
        message: error.message,
      });
    });
  }, SWEEP_INTERVAL_MS);

  if (typeof interval.unref === "function") {
    interval.unref();
  }
};
