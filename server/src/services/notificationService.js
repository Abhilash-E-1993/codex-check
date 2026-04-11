import { db, messaging } from "../firebaseAdmin.js";

const clientAppUrl = process.env.CLIENT_APP_URL || "http://localhost:5173";

const DEFAULT_ICON_URL =
  process.env.NOTIFICATION_ICON_URL ||
  new URL("/notification-icon.png", clientAppUrl).toString();

const buildAppUrl = (path = "/") =>
  new URL(path, clientAppUrl).toString();

const normalizeTokenList = (user) => {
  const tokenSet = new Set();

  if (Array.isArray(user?.fcmTokens)) {
    user.fcmTokens
      .filter((token) => typeof token === "string" && token.trim())
      .forEach((token) => tokenSet.add(token));
  }

  if (typeof user?.fcmToken === "string" && user.fcmToken.trim()) {
    tokenSet.add(user.fcmToken);
  }

  return Array.from(tokenSet);
};

const removeInvalidTokens = async (userId, invalidTokens) => {
  if (!userId || !invalidTokens.length) {
    return;
  }

  const userRef = db.collection("users").doc(userId);
  const snapshot = await userRef.get();

  if (!snapshot.exists) {
    return;
  }

  const user = snapshot.data() || {};
  const nextTokens = normalizeTokenList(user).filter(
    (token) => !invalidTokens.includes(token)
  );

  const updatePayload = {
    fcmTokens: nextTokens,
  };

  if (
    typeof user.fcmToken === "string" &&
    invalidTokens.includes(user.fcmToken)
  ) {
    updatePayload.fcmToken = nextTokens[0] || null;
  }

  await userRef.set(updatePayload, { merge: true });
};

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
  userId,
  tokens,
  title,
  body,
  url = "/",
}) => {
  const tokenList = Array.isArray(tokens)
    ? tokens.filter(Boolean)
    : [];

  if (!tokenList.length) {
    console.warn("[notifications] Skipping push because token missing", {
      userId,
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
        badge: DEFAULT_ICON_URL,
        tag: `request-update-${userId || "user"}`,
      },
    },
  };

  console.log("[notifications] Sending push notification", {
    userId,
    title,
    body,
    tokenCount: tokenList.length,
    link: payload.webpush.fcmOptions.link,
  });

  try {
    const response = await messaging.sendEachForMulticast({
      ...payload,
      tokens: tokenList,
    });

    const invalidTokens = [];

    response.responses.forEach((item, index) => {
      const token = tokenList[index];
      const code = item.error?.code;

      if (
        !item.success &&
        (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        )
      ) {
        invalidTokens.push(token);
      }
    });

    if (invalidTokens.length) {
      await removeInvalidTokens(userId, invalidTokens);
      console.warn("[notifications] Removed invalid FCM tokens", {
        userId,
        invalidTokenCount: invalidTokens.length,
      });
    }

    console.log("[notifications] Push sent", {
      title,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });

    if (response.successCount === 0) {
      const firstError = response.responses.find((item) => item.error)?.error;
      throw firstError || new Error("Push send failed for every token.");
    }
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
    deliveredTokenCount: tokenList.length,
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
    userId: mechanic.id,
    tokens: normalizeTokenList(mechanic),
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
    userId: customer.id,
    tokens: normalizeTokenList(customer),
    title: "Mechanic Accepted Your Request",
    body: `${request.mechanicName} from ${request.garageName} is on the way.`,
    url: "/",
  });
};
