const TWILIO_DEFAULT_CALL_DELAY_MS = 35000;
const TWILIO_DEFAULT_TIMEOUT_SECONDS = 25;
const TWILIO_API_BASE_URL = "https://api.twilio.com/2010-04-01";

const digitsOnly = (value = "") => `${value}`.replace(/\D/g, "");

const normalizeIndianPhoneNumber = (value) => {
  const digits = digitsOnly(value);

  if (!digits) {
    return "";
  }

  if (`${value}`.trim().startsWith("+")) {
    return `${value}`.trim();
  }

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  return digits;
};

const buildUrlWithRequestId = (explicitUrl, requestId) => {
  if (!explicitUrl) {
    return "";
  }

  try {
    const url = new URL(explicitUrl);
    url.searchParams.set("requestId", requestId);
    return url.toString();
  } catch {
    const separator = explicitUrl.includes("?") ? "&" : "?";
    return `${explicitUrl}${separator}requestId=${encodeURIComponent(requestId)}`;
  }
};

const buildTwimlUrl = (requestId) =>
  buildUrlWithRequestId(process.env.TWILIO_TWIML_URL?.trim(), requestId);

export const getTwilioFallbackDelayMs = () => {
  const configuredValue = Number(process.env.TWILIO_FALLBACK_DELAY_MS);

  if (Number.isFinite(configuredValue) && configuredValue >= 1000) {
    return configuredValue;
  }

  return TWILIO_DEFAULT_CALL_DELAY_MS;
};

export const isTwilioReminderConfigured = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER?.trim();
  const twimlUrl = process.env.TWILIO_TWIML_URL?.trim();

  return Boolean(accountSid && authToken && fromPhoneNumber && twimlUrl);
};

const getTwilioRequestConfig = (requestId) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromPhoneNumber = normalizeIndianPhoneNumber(
    process.env.TWILIO_PHONE_NUMBER?.trim()
  );
  const twimlUrl = buildTwimlUrl(requestId);
  const statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL?.trim();
  const timeoutSeconds = Number(process.env.TWILIO_TIMEOUT_SECONDS);
  const callTimeoutSeconds =
    Number.isFinite(timeoutSeconds) && timeoutSeconds > 0
      ? timeoutSeconds
      : TWILIO_DEFAULT_TIMEOUT_SECONDS;

  if (!(accountSid && authToken && fromPhoneNumber && twimlUrl)) {
    throw new Error(
      "Twilio reminder call is not fully configured. Add the required TWILIO_* environment variables."
    );
  }

  return {
    accountSid,
    authToken,
    fromPhoneNumber,
    twimlUrl,
    statusCallbackUrl,
    callTimeoutSeconds,
  };
};

export const triggerMechanicReminderCall = async ({
  requestId,
  mechanicPhoneNumber,
}) => {
  const {
    accountSid,
    authToken,
    fromPhoneNumber,
    twimlUrl,
    statusCallbackUrl,
    callTimeoutSeconds,
  } = getTwilioRequestConfig(requestId);

  const toPhoneNumber = normalizeIndianPhoneNumber(mechanicPhoneNumber);

  if (!toPhoneNumber) {
    throw new Error("Mechanic phone number is missing.");
  }

  const endpoint = `${TWILIO_API_BASE_URL}/Accounts/${accountSid}/Calls.json`;
  const params = new URLSearchParams({
    To: toPhoneNumber,
    From: fromPhoneNumber,
    Url: twimlUrl,
    Timeout: `${callTimeoutSeconds}`,
  });

  if (statusCallbackUrl) {
    const callbackUrl = buildUrlWithRequestId(statusCallbackUrl, requestId);
    params.set("StatusCallback", callbackUrl);
    params.set("StatusCallbackMethod", "POST");
  }

  console.log("[twilio] Triggering reminder call", {
    requestId,
    to: toPhoneNumber,
    from: fromPhoneNumber,
    twimlUrl,
    endpoint,
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("[twilio] Reminder call failed", {
      requestId,
      status: response.status,
      payload,
    });

    throw new Error(
      payload?.message || payload?.detail || "Twilio call request failed."
    );
  }

  const callSid = payload?.sid || payload?.callSid || null;

  console.log("[twilio] Reminder call created", {
    requestId,
    callSid,
  });

  return {
    success: true,
    provider: "twilio",
    callSid,
    raw: payload,
  };
};
