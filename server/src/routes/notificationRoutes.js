import express from "express";
import {
  getRequestSnapshot,
  sendNewRequestNotification,
  sendRequestAcceptedNotification,
} from "../services/notificationService.js";
import {
  cancelFallbackCallForRequest,
  prepareFallbackCallForRequest,
} from "../services/fallbackCallScheduler.js";

const router = express.Router();

router.post("/request-created", async (req, res) => {
  try {
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({
        error: "requestId is required.",
      });
    }

    const request = await getRequestSnapshot(requestId);
    console.log("[notifications] request-created payload accepted", {
      requestId,
      actorUid: req.user.uid,
      customerId: request.customerId,
      mechanicId: request.mechanicId,
      status: request.status,
    });

    if (request.customerId !== req.user.uid) {
      return res.status(403).json({
        error: "Only the customer who created this request can trigger the notification.",
      });
    }

    const [pushAttempt, fallbackAttempt] = await Promise.allSettled([
      sendNewRequestNotification(requestId),
      prepareFallbackCallForRequest(requestId),
    ]);

    const pushResult =
      pushAttempt.status === "fulfilled"
        ? pushAttempt.value
        : {
            success: false,
            skipped: false,
            error: pushAttempt.reason?.message || "Push notification failed.",
          };

    const fallbackCall =
      fallbackAttempt.status === "fulfilled"
        ? fallbackAttempt.value
        : {
            enabled: false,
            scheduled: false,
            error:
              fallbackAttempt.reason?.message ||
              "Fallback call scheduling failed.",
          };

    const hasFailure =
      pushAttempt.status === "rejected" ||
      fallbackAttempt.status === "rejected";

    console.log("[notifications] request-created execution summary", {
      requestId,
      pushStatus: pushAttempt.status,
      fallbackStatus: fallbackAttempt.status,
      pushResult,
      fallbackCall,
    });

    return res.status(hasFailure ? 207 : 200).json({
      success: !hasFailure,
      push: pushResult,
      fallbackCall,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to send mechanic notification.",
      details: error.message,
    });
  }
});

router.post("/request-accepted", async (req, res) => {
  try {
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({
        error: "requestId is required.",
      });
    }

    const request = await getRequestSnapshot(requestId);
    console.log("[notifications] request-accepted payload accepted", {
      requestId,
      actorUid: req.user.uid,
      customerId: request.customerId,
      mechanicId: request.mechanicId,
      status: request.status,
    });

    if (request.mechanicId !== req.user.uid) {
      return res.status(403).json({
        error: "Only the assigned mechanic can trigger the acceptance notification.",
      });
    }

    const [cancelAttempt, pushAttempt] = await Promise.allSettled([
      cancelFallbackCallForRequest(requestId, "request-accepted"),
      sendRequestAcceptedNotification(requestId),
    ]);

    const cancelResult =
      cancelAttempt.status === "fulfilled"
        ? {
            success: true,
            cancelled: true,
          }
        : {
            success: false,
            cancelled: false,
            error:
              cancelAttempt.reason?.message ||
              "Fallback call cancellation failed.",
          };

    const pushResult =
      pushAttempt.status === "fulfilled"
        ? pushAttempt.value
        : {
            success: false,
            skipped: false,
            error:
              pushAttempt.reason?.message ||
              "Customer notification failed.",
          };

    const hasFailure =
      cancelAttempt.status === "rejected" ||
      pushAttempt.status === "rejected";

    console.log("[notifications] request-accepted execution summary", {
      requestId,
      cancelStatus: cancelAttempt.status,
      pushStatus: pushAttempt.status,
      cancelResult,
      pushResult,
    });

    return res.status(hasFailure ? 207 : 200).json({
      success: !hasFailure,
      fallbackCall: cancelResult,
      push: pushResult,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to send customer notification.",
      details: error.message,
    });
  }
});

export default router;
