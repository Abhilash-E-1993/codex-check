import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

import {
  getDeviceFcmToken,
  getNotificationPermissionState,
  registerMessagingServiceWorker,
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

const PushNotificationManager = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [toasts, setToasts] = useState([]);
  const [permissionState, setPermissionState] = useState("default");
  const [permissionPromptDismissed, setPermissionPromptDismissed] =
    useState(false);

  const syncedTokenRef = useRef("");
  const mountedRef = useRef(true);

  const syncToken = async (shouldRequestPermission = false) => {
    if (!currentUser?.uid) {
      syncedTokenRef.current = "";
      return {
        token: null,
        permission: getNotificationPermissionState(),
      };
    }

    try {
      await registerMessagingServiceWorker();

      const permission = shouldRequestPermission
        ? await requestNotificationPermission()
        : getNotificationPermissionState();

      if (!mountedRef.current) {
        return {
          token: null,
          permission,
        };
      }

      setPermissionState(permission);

      if (permission !== "granted") {
        return {
          token: null,
          permission,
        };
      }

      const token = await getDeviceFcmToken();

      if (!mountedRef.current || !token) {
        return {
          token: null,
          permission,
        };
      }

      if (syncedTokenRef.current !== token) {
        await saveUserFcmToken(currentUser.uid, token);
        syncedTokenRef.current = token;
        console.log("[notifications] FCM token synced");
      }

      return {
        token,
        permission,
      };
    } catch (error) {
      console.error("FCM token sync failed", error);
      return {
        token: null,
        permission: getNotificationPermissionState(),
      };
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    setPermissionState(getNotificationPermissionState());
    syncToken(false);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setPermissionState(getNotificationPermissionState());
        syncToken(false);
      }
    };

    window.addEventListener("focus", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("focus", handleVisibilityChange);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    let unsubscribe = () => {};

    subscribeToForegroundMessages(async (payload) => {
      const toast = normalizeToast(payload);
      let browserNotificationShown = false;

      try {
        browserNotificationShown = await showBrowserNotification({
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

      if (browserNotificationShown) {
        return;
      }

      setToasts((prev) => {
        const exists = prev.some(
          (item) =>
            item.title === toast.title &&
            item.body === toast.body
        );

        if (exists) {
          return prev;
        }

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

  const closeToast = (id) => {
    setToasts((prev) =>
      prev.filter((toast) => toast.id !== id)
    );
  };

  const handleToastClick = (url) => {
    navigate(url || "/");
  };

  const handleEnableNotifications = async () => {
    const { permission } = await syncToken(true);

    if (permission === "granted") {
      setPermissionPromptDismissed(true);
    }
  };

  if (
    !toasts.length &&
    (
      !currentUser ||
      permissionPromptDismissed ||
      permissionState !== "default"
    )
  ) {
    return null;
  }

  return (
    <>
      {currentUser &&
        !permissionPromptDismissed &&
        permissionState === "default" && (
          <div className="notification-permission-banner" role="status">
            <div>
              <p className="notification-permission-title">
                Turn on push notifications
              </p>
              <p className="notification-permission-body">
                Enable alerts so request updates appear in your phone&apos;s notification bar.
              </p>
            </div>

            <div className="notification-permission-actions">
              <button
                type="button"
                className="notification-permission-button"
                onClick={handleEnableNotifications}
              >
                Enable
              </button>

              <button
                type="button"
                className="notification-permission-dismiss"
                onClick={() => setPermissionPromptDismissed(true)}
              >
                Not now
              </button>
            </div>
          </div>
        )}

      {Boolean(toasts.length) && (
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
                  onClick={(event) => {
                    event.stopPropagation();
                    closeToast(toast.id);
                  }}
                  className="text-xs opacity-70 hover:opacity-100"
                >
                  X
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default PushNotificationManager;
