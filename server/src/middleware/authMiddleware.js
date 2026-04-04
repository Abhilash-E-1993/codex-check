import { auth } from "../firebaseAdmin.js";

/* ---------------- TOKEN EXTRACTOR ---------------- */

const extractBearerToken = (headerValue = "") => {

  if (!headerValue) return null;

  const parts = headerValue.split(" ");

  if (parts.length !== 2) return null;

  const [scheme, token] = parts;

  if (scheme.toLowerCase() !== "bearer") return null;

  return token.trim();

};

/* ---------------- AUTH MIDDLEWARE ---------------- */

export const requireAuth = async (req, res, next) => {

  try {

    const authHeader = req.headers.authorization || "";

    const token = extractBearerToken(authHeader);

    if (!token) {

      console.error("[auth] Missing or malformed bearer token", {
        path: req.originalUrl,
        method: req.method,
        hasAuthorizationHeader: Boolean(authHeader),
        headerPreview: authHeader
          ? authHeader.slice(0, 30)
          : null,
      });

      return res.status(401).json({
        error: "Missing Firebase ID token.",
      });

    }

    /* -------- VERIFY TOKEN -------- */

    const decodedToken = await auth.verifyIdToken(token);

    console.log("[auth] Firebase ID token verified", {
      uid: decodedToken.uid,
      path: req.originalUrl,
      authTime: decodedToken.auth_time,
      issuer: decodedToken.iss,
      audience: decodedToken.aud,
    });

    req.user = decodedToken;

    return next();

  } catch (error) {

    console.error("[auth] Firebase ID token verification failed", {
      path: req.originalUrl,
      method: req.method,
      code: error.code || "unknown",
      message: error.message,
      hasAuthorizationHeader: Boolean(req.headers.authorization),
      tokenPreview: req.headers.authorization
        ? req.headers.authorization.slice(0, 40)
        : null,
    });

    return res.status(401).json({
      error: "Invalid or expired Firebase ID token.",
      details: error.message,
      code: error.code || "unknown",
    });

  }

};