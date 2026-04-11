import { db } from "../firebaseAdmin.js";

const getRequestRef = (requestId) =>
  db.collection("serviceRequests").doc(requestId);

const getUserRef = (userId) =>
  db.collection("users").doc(userId);

const buildAssignmentPatch = (candidate, nextIndex, reason) => ({
  mechanicId: candidate.mechanicId,
  mechanicName: candidate.name || "",
  garageName: candidate.garageName || "",
  mechanicPhoneNumber: candidate.phoneNumber || "",
  mechanicCity: candidate.city || "",
  mechanicServiceArea: candidate.serviceArea || "",
  assignedMechanicLocation: candidate.mechanicBaseLocation || null,
  currentMechanicEtaMinutes: candidate.estimatedEtaMinutes ?? null,
  currentMechanicDistanceKm: candidate.distanceKm ?? null,
  mechanicRoutingIndex: nextIndex,
  routingLastAdvancedAt: new Date(),
  routingLastReason: reason,
  completionOTP: null,
  otpGeneratedAt: null,
  mechanicLocation: null,
  status: "Pending",
  updatedAt: new Date(),
});

export const advanceRequestToNextMechanic = async (
  requestId,
  {
    actorMechanicId = null,
    expectedMechanicId = null,
    reason = "mechanic-rejected",
  } = {}
) =>
  db.runTransaction(async (transaction) => {
    const requestRef = getRequestRef(requestId);
    const snapshot = await transaction.get(requestRef);

    if (!snapshot.exists) {
      throw new Error("Service request not found.");
    }

    const request = {
      id: snapshot.id,
      ...snapshot.data(),
    };

    if (request.status !== "Pending") {
      return {
        advanced: false,
        exhausted: false,
        request,
        reason: "request-not-pending",
      };
    }

    if (actorMechanicId && request.mechanicId !== actorMechanicId) {
      throw new Error("Only the assigned mechanic can decline this request.");
    }

    if (expectedMechanicId && request.mechanicId !== expectedMechanicId) {
      return {
        advanced: false,
        exhausted: false,
        request,
        reason: "mechanic-changed",
      };
    }

    const queue = Array.isArray(request.mechanicRoutingQueue)
      ? request.mechanicRoutingQueue
      : [];
    const currentIndex = Number.isInteger(request.mechanicRoutingIndex)
      ? request.mechanicRoutingIndex
      : queue.findIndex(
          (candidate) => candidate?.mechanicId === request.mechanicId
        );

    let nextIndex = -1;
    let nextMechanic = null;

    for (let index = currentIndex + 1; index < queue.length; index += 1) {
      const candidate = queue[index];

      if (!candidate?.mechanicId || candidate.mechanicId === request.mechanicId) {
        continue;
      }

      const mechanicSnapshot = await transaction.get(
        getUserRef(candidate.mechanicId)
      );

      if (!mechanicSnapshot.exists) {
        continue;
      }

      const mechanicProfile = mechanicSnapshot.data() || {};

      if (mechanicProfile.availabilityStatus !== "available") {
        continue;
      }

      nextIndex = index;
      nextMechanic = candidate;
      break;
    }

    if (nextIndex === -1) {
      transaction.set(
        requestRef,
        {
          status: "Rejected",
          routingExhaustedAt: new Date(),
          routingLastAdvancedAt: new Date(),
          routingLastReason: reason,
          completionOTP: null,
          otpGeneratedAt: null,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      return {
        advanced: false,
        exhausted: true,
        request: {
          ...request,
          status: "Rejected",
        },
        reason: "queue-exhausted",
      };
    }

    transaction.set(
      requestRef,
      buildAssignmentPatch(nextMechanic, nextIndex, reason),
      { merge: true }
    );

    return {
      advanced: true,
      exhausted: false,
      request: {
        ...request,
        ...buildAssignmentPatch(nextMechanic, nextIndex, reason),
      },
      nextMechanic,
    };
  });
