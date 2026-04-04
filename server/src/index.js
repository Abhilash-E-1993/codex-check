import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { requireAuth } from "./middleware/authMiddleware.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import { auth as adminAuth } from "./firebaseAdmin.js";
import { startFallbackCallRecoveryLoop } from "./services/fallbackCallScheduler.js";

dotenv.config();

process.on("uncaughtException", (error) => {
  console.error("[process] uncaughtException", {
    name: error.name,
    message: error.message,
    stack: error.stack,
  });
});

process.on("unhandledRejection", (reason) => {
  console.error("[process] unhandledRejection", reason);
});

const app = express();
const port = Number(process.env.PORT || 4000);

const configuredOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const localhostOriginPattern =
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

const allowedOrigins = Array.from(
  new Set([
    ...configuredOrigins,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ])
);

const corsOptions = {
  origin(origin, callback) {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      localhostOriginPattern.test(origin)
    ) {
      return callback(null, true);
    }

    console.error("[cors] Blocked request origin", {
      origin,
      allowedOrigins,
    });

    return callback(new Error("Origin not allowed by CORS."));
  },
  credentials: false,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());

app.use((req, _res, next) => {
  if (req.path.startsWith("/api/notifications")) {
    console.log("[request] Incoming notification API request", {
      method: req.method,
      path: req.originalUrl,
      origin: req.headers.origin || null,
      hasAuthorizationHeader: Boolean(req.headers.authorization),
    });
  }

  next();
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "notification-backend",
  });
});

app.use("/api/notifications", requireAuth, notificationRoutes);

app.use((error, _req, res, _next) => {
  console.error("[express] unhandled middleware error", {
    message: error.message,
    stack: error.stack,
  });
  return res.status(500).json({
    error: error.message || "Unexpected server error.",
  });
});

startFallbackCallRecoveryLoop();

app.listen(port, () => {
  console.log("[startup] Notification backend configuration", {
    port,
    clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    allowedOrigins,
    clientAppUrl: process.env.CLIENT_APP_URL || "http://localhost:5173",
    projectId: adminAuth.app.options.projectId || process.env.FIREBASE_ADMIN_PROJECT_ID || null,
    hasClientEmail: Boolean(process.env.FIREBASE_ADMIN_CLIENT_EMAIL),
    hasPrivateKey: Boolean(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
    notificationIconUrl: process.env.NOTIFICATION_ICON_URL || null,
    hasTwilioAccountSid: Boolean(process.env.TWILIO_ACCOUNT_SID),
    hasTwilioAuthToken: Boolean(process.env.TWILIO_AUTH_TOKEN),
    hasTwilioPhoneNumber: Boolean(process.env.TWILIO_PHONE_NUMBER),
    hasTwilioTwimlUrl: Boolean(process.env.TWILIO_TWIML_URL),
    twilioFallbackDelayMs: process.env.TWILIO_FALLBACK_DELAY_MS || null,
  });
  console.log(`Notification backend listening on port ${port}`);
});
