# Vehicle Breakdown Assistance Web App

A React + Vite + Firebase app for matching stranded customers with nearby mechanics, with real-time push notifications powered by Firebase Cloud Messaging and a separate Express backend.

## Features

- Email/password and Google login
- Role-based profiles for customers and mechanics
- Area-based mechanic matching
- Service request creation and status tracking
- Live location and ETA support
- Real-time push notifications using Firebase Cloud Messaging
- Separate Express notification backend for easier deployment without Firebase Functions billing

## Notification Flow

- When a customer taps `Request Help`, the app creates the Firestore request and then calls the Express backend to notify only that selected mechanic.
- When a mechanic accepts a request, the app updates Firestore and then calls the Express backend to notify the customer.
- If the web app is already open, push messages are also shown as lightweight in-app toast notifications.
- Tapping a notification opens the web app, and the existing role-based home route sends the user to the correct dashboard.

## Frontend Environment Variables

Create `.env` from [.env.example](/c:/Users/abhil/OneDrive/Desktop/web%20dev/mechanic-app/mechanic-app/.env.example):

```bash+
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
VITE_NOTIFICATION_API_BASE_URL=http://localhost:4000
```

- `VITE_FIREBASE_VAPID_KEY` is used in [src/fcm.js](/c:/Users/abhil/OneDrive/Desktop/web%20dev/mechanic-app/mechanic-app/src/fcm.js).
- `VITE_NOTIFICATION_API_BASE_URL` should point to your Express backend in local development and production.

## Backend Environment Variables

Create `server/.env` from [server/.env.example](/c:/Users/abhil/OneDrive/Desktop/web%20dev/mechanic-app/mechanic-app/server/.env.example):

```bash
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
CLIENT_APP_URL=http://localhost:5173
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
NOTIFICATION_ICON_URL=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_TWIML_URL=
TWILIO_STATUS_CALLBACK_URL=
TWILIO_FALLBACK_DELAY_MS=35000
TWILIO_TIMEOUT_SECONDS=25
```

- `CLIENT_ORIGIN` controls CORS and can be a comma-separated list when deployed.
- `CLIENT_APP_URL` is the frontend URL used in push-click links.
- `FIREBASE_ADMIN_*` should come from a Firebase service account.
- `NOTIFICATION_ICON_URL` is optional. If left blank, the backend uses `${CLIENT_APP_URL}/notification-icon.png`.
- `TWILIO_TWIML_URL` should point to the TwiML endpoint or TwiML Bin URL Twilio should use when the reminder call connects.
- `TWILIO_FALLBACK_DELAY_MS` controls how long the backend waits before calling the mechanic if the request is still pending.

## Fallback Call Flow

- When a customer creates a request, the backend still sends the instant push notification as before.
- At the same time, the backend schedules a Twilio reminder call for that mechanic.
- If the request is still `Pending` after the configured delay, the backend places the Twilio call.
- If the mechanic accepts before then, the backend cancels the scheduled fallback call.
- If Twilio env vars are left blank, the app keeps working exactly as before and the fallback call remains disabled.

## Firebase Setup

1. Create a Firebase project and add a Web App.
2. Enable Authentication providers you need:
   - Email/Password
   - Google
3. Create Firestore and apply the rules from [firebase/firestore.rules](/c:/Users/abhil/OneDrive/Desktop/web%20dev/mechanic-app/mechanic-app/firebase/firestore.rules).
4. Enable Firebase Cloud Messaging for the web app.
5. Generate a Web Push certificate and paste the public VAPID key into `.env`.
6. Create a Firebase service account and put its values into `server/.env`.

## Service Worker And Icon

- The FCM service worker lives at [public/firebase-messaging-sw.js](/c:/Users/abhil/OneDrive/Desktop/web%20dev/mechanic-app/mechanic-app/public/firebase-messaging-sw.js).
- Add your notification icon at `public/notification-icon.png` if you want a custom notification image.
- Notifications still work if the icon file is missing.

## Browser Notifications

- Browser permission is requested after sign-in.
- The app generates an FCM device token and stores it in `users/{userId}.fcmToken`.
- If the token changes, it is updated in Firestore automatically.

## Local Development

1. Install frontend dependencies:
   ```bash
   npm install
   ```
2. Install backend dependencies:
   ```bash
   cd server
   npm install
   ```
3. Fill `.env` and `server/.env`.
4. Start the frontend:
   ```bash
   npm run dev
   ```
5. In another terminal, start the backend:
   ```bash
   npm run dev:server
   ```

## Deployment Notes

- Deploy the React frontend and the Express backend separately.
- For Railway, set the service root to `server/` when deploying the backend.
- Put the deployed backend URL into `VITE_NOTIFICATION_API_BASE_URL`.
- Put the deployed frontend URL into `CLIENT_APP_URL`.
- Add the deployed frontend origin to `CLIENT_ORIGIN`.

## Important Files

- Frontend FCM setup: [src/fcm.js](/c:/Users/abhil/OneDrive/Desktop/web%20dev/mechanic-app/mechanic-app/src/fcm.js)
- Foreground toast handling: [src/components/PushNotificationManager.jsx](/c:/Users/abhil/OneDrive/Desktop/web%20dev/mechanic-app/mechanic-app/src/components/PushNotificationManager.jsx)
- Frontend notification API calls: [src/services/notificationService.js](/c:/Users/abhil/OneDrive/Desktop/web%20dev/mechanic-app/mechanic-app/src/services/notificationService.js)
- Express backend entry: [server/src/index.js](/c:/Users/abhil/OneDrive/Desktop/web%20dev/mechanic-app/mechanic-app/server/src/index.js)
- Express notification routes: [server/src/routes/notificationRoutes.js](/c:/Users/abhil/OneDrive/Desktop/web%20dev/mechanic-app/mechanic-app/server/src/routes/notificationRoutes.js)
- Firebase Admin setup: [server/src/firebaseAdmin.js](/c:/Users/abhil/OneDrive/Desktop/web%20dev/mechanic-app/mechanic-app/server/src/firebaseAdmin.js)

## Manual Configuration Checklist

- Add all frontend Firebase config values to `.env`
- Add `VITE_FIREBASE_VAPID_KEY` to `.env`
- Add `VITE_NOTIFICATION_API_BASE_URL` to `.env`
- Add backend Firebase Admin service-account values to `server/.env`
- Set `CLIENT_ORIGIN` and `CLIENT_APP_URL` in `server/.env`
- Enable browser notification permission when prompted
- Add `public/notification-icon.png` if you want a custom icon
- Apply Firestore rules from `firebase/firestore.rules`
