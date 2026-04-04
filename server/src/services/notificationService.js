import { db, messaging } from "../firebaseAdmin.js";

const clientAppUrl = process.env.CLIENT_APP_URL || "http://localhost:5173";

const DEFAULT_ICON_URL =
  process.env.NOTIFICATION_ICON_URL ||
  new URL("/notification-icon.png", clientAppUrl).toString();

const buildAppUrl = (path = "/") =>
  new URL(path, clientAppUrl).toString();

/* ---------------- GET REQUEST ---------------- */

export const getRequestSnapshot = async (requestId) => {
  console.log("[notifications] Loading service request", { requestId });

  const snapshot = await db
    .collection("serviceRequests")
    .doc(requestId)
    .get();

  if (!snapshot.exists) {
    throw new Error("Service request not found.");
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
};

/* ---------------- GET USER ---------------- */

export const getUserSnapshot = async (userId) => {
  console.log("[notifications] Loading user profile", { userId });

  const snapshot = await db
    .collection("users")
    .doc(userId)
    .get();

  if (!snapshot.exists) {
    throw new Error("User profile not found.");
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
};

/* ---------------- PUSH SENDER ---------------- */

export const sendPushToToken = async ({
  token,
  title,
  body,
  url = "/",
}) => {
  if (!token) {
    console.warn("[notifications] Skipping push because token missing", {
      title,
      url,
    });

    return {
      success: false,
      skipped: true,
      reason: "missing-token",
    };
  }

  const payload = {

    token,

    notification: {
      title,
      body,
    },

    data: {
      title,
      body,
      url: buildAppUrl(url),
    },

    webpush: {
      fcmOptions: {
        link: buildAppUrl(url),
      },
      notification: {
        icon: DEFAULT_ICON_URL,
      },
    },

  };

  console.log("[notifications] Sending push notification", {
    title,
    body,
    hasToken: Boolean(token),
    link: payload.webpush.fcmOptions.link,
  });
  try {
    const messageId = await messaging.send(payload);

    console.log("[notifications] Push sent", {
      messageId,
      title,
    });
  } catch (error) {
    console.error("[notifications] Push failed", {
      code: error.code,
      message: error.message,
    });
    throw error;
  }

  return {
    success: true,
    skipped: false,
  };
};

/* ---------------- NEW REQUEST ---------------- */

export const sendNewRequestNotification = async (requestId) => {
  const request = await getRequestSnapshot(requestId);
  const mechanic = await getUserSnapshot(request.mechanicId);

  console.log("[notifications] Preparing mechanic notification", {
    requestId,
    serviceType: request.serviceType,
    mechanicId: request.mechanicId,
    mechanicServices: mechanic.services,
  });

  /* -------- SERVICE FILTER -------- */

  if (
    Array.isArray(mechanic.services) &&
    mechanic.services.length > 0 &&
    !mechanic.services.includes(request.serviceType)
  ) {
    console.warn("[notifications] Mechanic does not provide this service", {
      requestService: request.serviceType,
      mechanicServices: mechanic.services,
    });

    return {
      success: false,
      skipped: true,
      reason: "service-not-supported",
    };
  }

  return sendPushToToken({
    token: mechanic.fcmToken,
    title: "New Breakdown Request",
    body: `Customer needs help for ${request.serviceType}. Tap to view.`,
    url: "/",
  });
};

/* ---------------- REQUEST ACCEPTED ---------------- */

export const sendRequestAcceptedNotification = async (requestId) => {
  const request = await getRequestSnapshot(requestId);

  if (request.status !== "Accepted") {
    throw new Error(
      "Notification can only be sent for accepted requests."
    );
  }

  const customer = await getUserSnapshot(request.customerId);

  console.log("[notifications] Preparing customer notification", {
    requestId,
    customerId: request.customerId,
  });

  return sendPushToToken({
    token: customer.fcmToken,
    title: "Mechanic Accepted Your Request",
    body: `${request.mechanicName} from ${request.garageName} is on the way.`,
    url: "/",
  });
};
