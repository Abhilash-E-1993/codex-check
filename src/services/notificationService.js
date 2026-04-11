const NOTIFICATION_API_BASE_URL = (
  import.meta.env.VITE_NOTIFICATION_API_BASE_URL || "http://localhost:4000"
).replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = 7000;
const RETRY_DELAY_MS = 900;
const MAX_RETRIES = 2;

const wait = (ms) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const isTransientNetworkError = (error) =>
  error?.name === "AbortError" ||
  error instanceof TypeError;

const createRequestOptions = (token, requestId, signal) => ({
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ requestId }),
  signal,
});

const postNotificationEvent = async ({
  currentUser,
  endpoint,
  requestId,
}) => {
  if (!currentUser?.getIdToken || !requestId) {
    return {
      success: false,
      skipped: true,
      reason: "missing-user-or-request",
    };
  }

  const token = await currentUser.getIdToken();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

    try {
      const response = await fetch(
        `${NOTIFICATION_API_BASE_URL}/api/notifications/${endpoint}`,
        createRequestOptions(token, requestId, controller.signal)
      );

      window.clearTimeout(timeoutId);

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        console.error("[notifications] Backend notification request failed", {
          endpoint,
          requestId,
          status: response.status,
          errorPayload,
        });
        throw new Error(
          errorPayload.error ||
            errorPayload.details ||
            "Notification request failed."
        );
      }

      const payload = await response.json();
      console.log("[notifications] Backend notification request succeeded", {
        endpoint,
        requestId,
        payload,
        attempt,
      });
      return payload;
    } catch (error) {
      window.clearTimeout(timeoutId);

      const shouldRetry =
        attempt < MAX_RETRIES &&
        isTransientNetworkError(error);

      console.error("[notifications] Notification request attempt failed", {
        endpoint,
        requestId,
        attempt,
        shouldRetry,
        message: error.message,
        name: error.name,
      });

      if (shouldRetry) {
        await wait(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }

      if (isTransientNetworkError(error)) {
        throw new Error(
          "Notification service is temporarily unavailable. Your request was saved, but the push alert could not be sent right now."
        );
      }

      throw error;
    }
  }
};

export const notifyMechanicAboutNewRequest = async ({
  currentUser,
  requestId,
}) =>
  postNotificationEvent({
    currentUser,
    endpoint: "request-created",
    requestId,
  });

export const notifyCustomerAboutAcceptedRequest = async ({
  currentUser,
  requestId,
}) =>
  postNotificationEvent({
    currentUser,
    endpoint: "request-accepted",
    requestId,
  });

export const advanceRequestToNextMechanic = async ({
  currentUser,
  requestId,
}) =>
  postNotificationEvent({
    currentUser,
    endpoint: "request-declined",
    requestId,
  });
