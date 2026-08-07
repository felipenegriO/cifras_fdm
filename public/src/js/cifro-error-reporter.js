(function () {
  function send(payload) {
    var url = (window.APP_BASE || '') + '/api/log-js-error.php';
    try {
      navigator.sendBeacon(url, JSON.stringify(payload));
    } catch (_) {
      fetch(url, { method: 'POST', body: JSON.stringify(payload), keepalive: true }).catch(function () {});
    }
  }

  window.addEventListener('error', function (e) {
    send({
      descricao:  (e.message || 'JS error').substring(0, 500),
      referencia: ((e.filename || '') + ':' + e.lineno + ':' + e.colno).substring(0, 255),
      detalhes:   { type: 'onerror', stack: e.error && e.error.stack ? e.error.stack.substring(0, 1000) : null }
    });
  });

  window.addEventListener('unhandledrejection', function (e) {
    var msg = e.reason instanceof Error ? e.reason.message : String(e.reason || 'Unhandled promise rejection');
    var stack = e.reason instanceof Error ? (e.reason.stack || '').substring(0, 1000) : null;
    send({
      descricao:  msg.substring(0, 500),
      referencia: 'unhandledrejection',
      detalhes:   { type: 'promise', stack: stack }
    });
  });
})();
