<?php
require_once __DIR__ . '/config/env.php';

if ((string) env('APP_ENV', '') !== 'test') {
    http_response_code(404);
    exit;
}

header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: no-store');
header('Service-Worker-Allowed: /');
?>
const VERSION = 'e2e-stale-login';
const CACHE = 'cifro-pages-' + VERSION;
const STALE_INDEX = '/index.php';
const STALE_LOGIN = '/login.php';
self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE)
    .then(cache => Promise.all([
      cache.put(STALE_INDEX, new Response('<!doctype html><html><body><main id="stale-landing-e2e">Landing antiga</main></body></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })),
      cache.put(STALE_LOGIN, new Response('<!doctype html><html><body><form method="post" id="loginForm"><input id="email" name="email" type="email"><input id="senha" name="senha" type="password"><button type="submit">Entrar</button></form></body></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })),
    ]))
    .then(() => self.skipWaiting())
));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method === 'GET' && [STALE_INDEX, STALE_LOGIN].includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request).then(response => response || fetch(event.request))));
  }
});
self.addEventListener('message', event => {
  if (event.data?.type === 'GET_VERSION') event.ports[0]?.postMessage({ version: VERSION });
});
