import { getToken, isSupported, getMessaging, onMessage } from "firebase/messaging";
import { app, firebaseConfig } from "./firebase";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
export const NOTIFICATION_ICON_PATH = "/notification-icon.png";

const buildServiceWorkerUrl = () => {
  const params = new URLSearchParams({
    apiKey: firebaseConfig.apiKey || "",
    authDomain: firebaseConfig.authDomain || "",
    projectId: firebaseConfig.projectId || "",
    storageBucket: firebaseConfig.storageBucket || "",
    messagingSenderId: firebaseConfig.messagingSenderId || "",
    appId: firebaseConfig.appId || "",
  });

  return `/firebase-messaging-sw.js?${params.toString()}`;
};

export const isMessagingSupported = async () => {
  if (typeof window === "undefined") {
    return false;
  }

  return isSupported();
};

const getMessagingInstance = async () => {
  const supported = await isMessagingSupported();
  return supported ? getMessaging(app) : null;
};

export const registerMessagingServiceWorker = async () => {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return null;
  }

  return navigator.serviceWorker.register(buildServiceWorkerUrl());
};

export const getNotificationPermissionState = () => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }

  return Notification.permission;
};

export const showBrowserNotification = async ({
  title,
  body,
  url = "/",
  tag = "breakdown-assist-notification",
}) => {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted" ||
    !("serviceWorker" in navigator)
  ) {
    return false;
  }

  const registration =
    (await navigator.serviceWorker.getRegistration()) ||
    (await registerMessagingServiceWorker()) ||
    (await navigator.serviceWorker.ready);

  if (!registration) {
    return false;
  }

  await registration.showNotification(title || "New Notification", {
    body: body || "You have a new update.",
    icon: NOTIFICATION_ICON_PATH,
    badge: NOTIFICATION_ICON_PATH,
    tag,
    renotify: true,
    data: {
      url,
    },
  });

  return true;
};

export const requestNotificationPermission = async () => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }

  const currentPermission = getNotificationPermissionState();

  if (currentPermission === "granted" || currentPermission === "denied") {
    return currentPermission;
  }

  return Notification.requestPermission();
};

export const getDeviceFcmToken = async () => {
  const permission = await requestNotificationPermission();

  if (permission !== "granted") {
    return null;
  }

  const messaging = await getMessagingInstance();
  if (!messaging) {
    return null;
  }

  if (!VAPID_KEY) {
    console.warn("VITE_FIREBASE_VAPID_KEY is missing. FCM token generation is disabled.");
    return null;
  }

  const registration = await registerMessagingServiceWorker();

  return getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
};

export const subscribeToForegroundMessages = async (onReceive) => {
  const messaging = await getMessagingInstance();

  if (!messaging) {
    return () => {};
  }

  return onMessage(messaging, (payload) => {
    onReceive?.(payload);
  });
};
