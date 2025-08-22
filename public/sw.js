const CACHE_NAME = 'eerie-grid-ph-cache-v1';

const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/map.html',
  '/archive.html',
  '/codex.html',
  '/artifacts.html',
  '/keepers-note.html',
  '/style.css',
  '/landing.css',
  '/archive.css',
  '/codex.css',
  '/artifacts.css',
  '/chatbot.css',
  '/story-page.css',
  '/jumpscare.css',
  '/client.js',
  '/archive.js',
  '/codex.js',
  '/artifacts.js',
  '/story.js',
  '/chatbot.js',
  '/jumpscare.js',
  '/supabase-client.js',
  '/images/keeper_icon.png',
  'https://cdn-icons-png.freepik.com/256/8494/8494367.png',
  'https://fonts.googleapis.com/css2?family=Creepster&family=Special+Elite&family=Merriweather:wght@300;400;700&display=swap'
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching all: app shell and content');
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch(error => {
        console.error('[Service Worker] Cache addAll failed:', error);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});