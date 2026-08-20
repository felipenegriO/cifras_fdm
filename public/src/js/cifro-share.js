/**
 * Compartilhamento: nativo no celular, área de transferência no desktop.
 *
 * Vive separado porque repertório e convite precisam exatamente do mesmo
 * comportamento — quando isso estava duplicado, qualquer correção só chegava
 * a um dos dois. Recebe window ou globalThis para poder ser testado no Node.
 */
(function (escopo) {
  function isMobile() {
    var nav = escopo.navigator || {};
    if (nav.userAgentData && typeof nav.userAgentData.mobile === 'boolean') {
      return nav.userAgentData.mobile;
    }
    return /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || '');
  }

  async function copy(texto) {
    var nav = escopo.navigator || {};
    if (nav.clipboard && escopo.isSecureContext) {
      await nav.clipboard.writeText(texto);
      return;
    }
    // Sem clipboard API (http, navegador antigo): textarea invisível + execCommand.
    var area = escopo.document.createElement('textarea');
    area.value = texto;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    escopo.document.body.appendChild(area);
    area.select();
    escopo.document.execCommand('copy');
    area.remove();
  }

  async function compartilhar(dados) {
    var nav = escopo.navigator || {};
    if (isMobile() && nav.share) {
      try {
        await nav.share({ title: dados.titulo, text: dados.texto });
        return 'shared';
      } catch (erro) {
        if (erro && erro.name === 'AbortError') return 'cancelled';
        throw erro;
      }
    }
    await escopo.CifroShare.copy(dados.texto);
    return 'copied';
  }

  escopo.CifroShare = { isMobile: isMobile, copy: copy, compartilhar: compartilhar };
})(typeof window !== 'undefined' ? window : globalThis);
