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
const VERSION = 'e2e-old-real';
const CACHE = 'cifro-static-' + VERSION;
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.put('/old-e2e', new Response('old'))).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (event.data?.type === 'GET_VERSION') event.ports[0]?.postMessage({ version: VERSION });
});
