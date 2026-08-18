const CACHE_NAME = 'life-companion-v1';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './AboutPhone.jpg',
  './AndroError.png',
  './Apps.jpg',
  './Back.png',
  './Bored.png',
  './Borned.png',
  './Donut.png',
  './Gallery.png',
  './GameDroid.png',
  './Home.jpg',
  './Internet.png',
  './KitKat.png',
  './PacDroid.jpg',
  './Settings.png',
  './Shot.png',
  './UnBorned.png',
  './Update.png',
  './Video.png',
  './Widget.jpg',
  './Woff.jpg',
  './Won.jpg',
  './accept.jpg',
  './android.png',
  './android_version.jpg',
  './animation_call.mp4',
  './call_background.jpg',
  './calling.jpg',
  './camera.mp4',
  './camera.png',
  './cancel.jpg',
  './contacts.png',
  './endcall.jpg',
  './message.jpg',
  './notification.mp3',
  './pac-droid.jpg',
  './phone.png',
  './pink.png',
  './purple.png',
  './quick.jpg',
  './quicksettings.jpg',
  './ringtone.mp3',
  './settings.jpg',
  './snake.png',
  './snake_keep.png',
  './wallpaper.jpg'
];

// Устанавливаем и кэшируем всё сразу (офлайн-режим "из коробки")
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Чистим старые версии кэша
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Cache-first: сначала кэш, если нет — сеть, и докладываем в кэш
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
