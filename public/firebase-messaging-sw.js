/* global importScripts, firebase */

importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");

/*
  Firebase config is passed through URL parameters when the service worker is registered.
  This avoids hardcoding sensitive config values.
*/

const searchParams = new URLSearchParams(self.location.search);

const firebaseConfig = {
  apiKey: searchParams.get("apiKey") || "",
  authDomain: searchParams.get("authDomain") || "",
  projectId: searchParams.get("projectId") || "",
  storageBucket: searchParams.get("storageBucket") || "",
  messagingSenderId: searchParams.get("messagingSenderId") || "",
  appId: searchParams.get("appId") || "",
};

/* Initialize Firebase safely */

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

/*
  Handle background push notifications
*/

messaging.onBackgroundMessage((payload) => {

  const notificationTitle =
    payload?.notification?.title ||
    payload?.data?.title ||
    "New Notification";

  const notificationBody =
    payload?.notification?.body ||
    payload?.data?.body ||
    "You have a new notification.";

  const notificationUrl =
    payload?.data?.url ||
    "/";

  const notificationOptions = {
    body: notificationBody,

    /*
      Icon shown in notification
      Add this file in /public
    */

    icon: payload?.notification?.icon || "/notification-icon.png",

    /*
      Badge for Android Chrome notifications
    */

    badge: "/notification-icon.png",

    /*
      Prevent duplicate notifications
    */

    tag: payload?.data?.tag || "breakdown-assist-notification",

    data: {
      url: notificationUrl,
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

/*
  Handle notification click
*/

self.addEventListener("notificationclick", (event) => {

  event.notification.close();

  const destinationUrl = event.notification?.data?.url || "/";

  event.waitUntil(

    self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then((clientList) => {

      for (const client of clientList) {

        if (client.url.includes(destinationUrl) && "focus" in client) {
          return client.focus();
        }

      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(destinationUrl);
      }

      return null;

    })

  );

});