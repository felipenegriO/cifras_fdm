/**
 * Texto do convite da banda, no molde de playlist-share.js.
 */
(function (escopo) {
  function formatar(dados) {
    var banda = (dados && dados.bandaNome) || 'nossa banda';
    var link = (dados && dados.link) || '';
    return [
      '🎸 CONVITE',
      'Você foi convidado para a banda *' + banda + '* no Cifrô.',
      '',
      'Toque no link para entrar:',
      link,
      '',
      '⏰ O convite vale por 24 horas.'
    ].join('\n');
  }

  async function share(dados) {
    return escopo.CifroShare.compartilhar({
      titulo: 'Convite para a banda',
      texto: formatar(dados),
    });
  }

  escopo.CifroConviteShare = { formatar: formatar, share: share };
})(typeof window !== 'undefined' ? window : globalThis);
