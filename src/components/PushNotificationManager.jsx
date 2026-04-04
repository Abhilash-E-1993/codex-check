import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

import {
  getDeviceFcmToken,
  requestNotificationPermission,
  showBrowserNotification,
  subscribeToForegroundMessages,
} from "../fcm";

import { saveUserFcmToken } from "../services/firestoreService";

const TOAST_TIMEOUT_MS = 5000;

const normalizeToast = (payload) => ({

  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,

  title:
    payload?.notification?.title ||
    payload?.data?.title ||
    "New Notification",

  body:
    payload?.notification?.body ||
    payload?.data?.body ||
    "You have a new update.",

  url: payload?.data?.url || "/",
  tag:
    payload?.data?.tag ||
    payload?.messageId ||
    `${payload?.notification?.title || "notification"}-${payload?.notification?.body || "update"}`,

});

/* ------------------------------------------------ */

const PushNotificationManager = () => {

  const { currentUser } = useAuth();

  const navigate = useNavigate();

  const [toasts, setToasts] = useState([]);

  const syncedTokenRef = useRef("");

  const mountedRef = useRef(true);

  /* ---------------- TOKEN SYNC ---------------- */

  useEffect(() => {

    mountedRef.current = true;

    const syncToken = async () => {

      if (!currentUser?.uid) {

        syncedTokenRef.current = "";
        return;

      }

      try {

        const permission = await requestNotificationPermission();

        if (!mountedRef.current || permission !== "granted") {
          return;
        }

        const token = await getDeviceFcmToken();

        if (!mountedRef.current || !token) return;

        if (syncedTokenRef.current === token) return;

        await saveUserFcmToken(currentUser.uid, token);

        syncedTokenRef.current = token;

        console.log("[notifications] FCM token synced");

      } catch (error) {

        console.error("FCM token sync failed", error);

      }

    };

    syncToken();

    return () => {
      mountedRef.current = false;
    };

  }, [currentUser?.uid]);

  /* ---------------- FOREGROUND LISTENER ---------------- */

  useEffect(() => {

    let unsubscribe = () => {};

    subscribeToForegroundMessages(async (payload) => {

      const toast = normalizeToast(payload);

      try {
        await showBrowserNotification({
          title: toast.title,
          body: toast.body,
          url: toast.url,
          tag: toast.tag,
        });
      } catch (error) {
        console.error(
          "Foreground browser notification failed",
          error
        );
      }

      setToasts((prev) => {

        // prevent duplicates
        const exists = prev.some(
          (item) =>
            item.title === toast.title &&
            item.body === toast.body
        );

        if (exists) return prev;

        return [...prev, toast];

      });

      window.setTimeout(() => {

        setToasts((prev) =>
          prev.filter((item) => item.id !== toast.id)
        );

      }, TOAST_TIMEOUT_MS);

    })
      .then((cleanup) => {
        unsubscribe = cleanup;
      })
      .catch((error) => {
        console.error(
          "Foreground notification listener failed",
          error
        );
      });

    return () => unsubscribe();

  }, []);

  /* ---------------- CLOSE TOAST ---------------- */

  const closeToast = (id) => {

    setToasts((prev) =>
      prev.filter((toast) => toast.id !== id)
    );

  };

  /* ---------------- CLICK TOAST ---------------- */

  const handleToastClick = (url) => {

    navigate(url || "/");

  };

  if (!toasts.length) {
    return null;
  }

  return (

    <div
      className="notification-toast-stack"
      aria-live="polite"
      aria-atomic="true"
    >

      {toasts.map((toast) => (

        <div
          key={toast.id}
          className="notification-toast cursor-pointer"
          onClick={() => handleToastClick(toast.url)}
        >

          <div className="flex justify-between items-start gap-4">

            <div>

              <p className="notification-toast-title">
                {toast.title}
              </p>

              <p className="notification-toast-body">
                {toast.body}
              </p>

            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                closeToast(toast.id);
              }}
              className="text-xs opacity-70 hover:opacity-100"
            >
              ✕
            </button>

          </div>

        </div>

      ))}

    </div>

  );

};

export default PushNotificationManager;
