function getRoteiroById(id) {
  if (typeof roteirosSalvos === 'undefined') return null;
  return roteirosSalvos.find(r => String(r.id) === String(id));
}

function isRoteiroVisible(roteiro) {
  if (!roteiro || !roteiro.visivel_ate) return true;
  const parts = String(roteiro.visivel_ate).split('-');
  if (parts.length !== 3) return true;
  const date = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59);
  if (Number.isNaN(date.getTime())) return true;
  return date.getTime() >= Date.now();
}

function formatRoteiroDate(value) {
  if (!value) return '';
  const parts = String(value).split('-');
  if (parts.length !== 3) return '';
  return 'Visivel ate: ' + parts[2] + '/' + parts[1] + '/' + parts[0];
}

function sanitizeRoteiroHtml(html) {
  const allowedTags = new Set([
    'b', 'br', 'strong', 'em', 'i', 'u', 'p', 'span', 'div', 'a',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li'
  ]);

  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  const nodes = Array.from(doc.body.querySelectorAll('*'));

  nodes.forEach(node => {
    const tag = node.nodeName.toLowerCase();
    if (!allowedTags.has(tag)) {
      const parent = node.parentNode;
      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      parent.removeChild(node);
      return;
    }

    Array.from(node.attributes).forEach(attr => {
      const name = attr.name.toLowerCase();
      if (tag === 'a' && name === 'href') return;
      if (tag === 'span' && name === 'style') return;
      if (tag === 'div' && name === 'style') return;
      node.removeAttribute(attr.name);
    });

    if (tag === 'a') {
      const href = node.getAttribute('href') || '';
      if (!href || href.startsWith('javascript:')) {
        node.removeAttribute('href');
      }
    }
  });

  return doc.body.innerHTML;
}

function renderRoteiro(containerId, roteiroHtml) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = sanitizeRoteiroHtml(roteiroHtml || '');

  const params = new URLSearchParams(window.location.search);
  const roteiroId = params.get('id');

  // Normaliza links para music.php?id=... e garante retorno ao roteiro
  container.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (!href) return;

    if (roteiroId) {
      a.setAttribute('href', addRoteiroReturn(href, roteiroId));
    }

    // suporta link direto com id na query
    if (href.includes('music.php') && href.includes('id=')) {
      return;
    }

    const trimmedHref = href.trim();
    const hrefIdMatch = trimmedHref.match(/^(?:#|musica:|music:)?(\d+)$/i);
    if (hrefIdMatch) {
      a.setAttribute('href', addRoteiroReturn('music.php?id=' + hrefIdMatch[1], roteiroId));
      return;
    }

    // suporta numero no texto do link
    const text = (a.textContent || '').trim();
    const idMatch = text.match(/(\d+)/);
    if (idMatch) {
      a.setAttribute('href', addRoteiroReturn('music.php?id=' + idMatch[1], roteiroId));
    }
  });
}

function addRoteiroReturn(href, roteiroId) {
  if (!roteiroId) return href;
  if (!href.includes('music.php')) return href;
  if (href.includes('from=roteiro')) return href;

  const separator = href.includes('?') ? '&' : '?';
  return href + separator + 'from=roteiro&roteiroId=' + encodeURIComponent(roteiroId);
}
