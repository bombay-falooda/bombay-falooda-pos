// Firebase Cloud Messaging Background Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA_B4s-fbAiVSuPvdZWEum8xnRscJ5IcWo",
  authDomain: "bombay-falooda-10639.firebaseapp.com",
  projectId: "bombay-falooda-10639",
  storageBucket: "bombay-falooda-10639.firebasestorage.app",
  messagingSenderId: "594662082129",
  appId: "1:594662082129:web:214a25b821a74787ea9a70",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[FCM Service Worker] Received background message: ', payload);
  const notificationTitle = payload.notification?.title || 'Bombay Falooda POS Alert';
  const notificationOptions = {
    body: payload.notification?.body || 'New order update received',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200, 100, 400],
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
