(function () {
  const api = (window.APP_BASE || '') + '/src/backend/categorias/api.php';
  const form = document.getElementById('categoryForm');
  const idInput = document.getElementById('categoryId');
  const nameInput = document.getElementById('categoryName');
  const list = document.getElementById('categoryList');
  const cancel = document.getElementById('cancelEdit');
  let categories = [];

  const ACENTOS = { 'á':'a','à':'a','ã':'a','â':'a','ä':'a','é':'e','è':'e','ê':'e','ë':'e','í':'i','ì':'i','î':'i','ï':'i','ó':'o','ò':'o','õ':'o','ô':'o','ö':'o','ú':'u','ù':'u','û':'u','ü':'u','ç':'c','ñ':'n' };

  // Mesma regra do servidor (CategoriaRepository::normalizarNome): a contagem
  // precisa casar com o que o back-end considera a mesma categoria.
  function normalizarNome(nome) {
    return String(nome || '').trim().replace(/\s+/g, ' ').toLowerCase()
      .replace(/[áàãâäéèêëíìîïóòõôöúùûüçñ]/g, letra => ACENTOS[letra] || letra);
  }

  function contarMusicas(nome) {
    const alvo = normalizarNome(nome);
    const musicas = Array.isArray(window.songs) ? window.songs : [];
    return musicas.filter(musica => normalizarNome(musica.classificacao) === alvo).length;
  }

  function rotuloContagem(total) {
    if (total === 0) return 'nenhuma música';
    return total === 1 ? '1 música' : total + ' músicas';
  }

  const onboarding = document.getElementById('categoryOnboarding');
  const KITS = [
    { titulo: 'Pelo momento do culto', nomes: ['Abertura', 'Adoração', 'Ministração', 'Encerramento'] },
    { titulo: 'Pelo estilo da música', nomes: ['Lenta', 'Animada', 'Congregacional'] },
    { titulo: 'Pela ocasião', nomes: ['Natal', 'Páscoa', 'Infantil'] }
  ];

  function renderOnboarding() {
    if (!onboarding) return;
    onboarding.hidden = categories.length > 0;
    if (categories.length > 0) { onboarding.replaceChildren(); return; }

    const caixa = document.createElement('div');
    caixa.className = 'category-onboarding';

    const titulo = document.createElement('h2');
    titulo.textContent = 'Organize as músicas do seu jeito';
    const texto = document.createElement('p');
    texto.textContent = 'Categoria é como sua banda agrupa as músicas. O critério é você que escolhe — comece por um destes:';
    caixa.append(titulo, texto);

    KITS.forEach(kit => {
      const bloco = document.createElement('div');
      bloco.className = 'category-kit';
      const nome = document.createElement('div');
      nome.className = 'category-kit__title';
      nome.textContent = kit.titulo;
      const chips = document.createElement('div');
      chips.className = 'category-kit__chips';
      kit.nomes.forEach(item => {
        const chip = document.createElement('span');
        chip.className = 'category-kit__chip';
        chip.textContent = item;
        chips.appendChild(chip);
      });
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'btn btn--primary';
      botao.textContent = 'Usar estas ' + kit.nomes.length;
      botao.addEventListener('click', () => aplicarKit(kit.nomes, botao));
      bloco.append(nome, chips, botao);
      caixa.appendChild(bloco);
    });

    // O formulário livre já existe logo abaixo deste bloco na marcação; esta
    // linha é só a costura entre os kits e ele.
    const livre = document.createElement('p');
    livre.className = 'category-onboarding__foot';
    livre.textContent = 'Ou crie a sua no campo abaixo.';
    const rodape = document.createElement('p');
    rodape.className = 'category-onboarding__foot';
    rodape.textContent = 'Depois de criadas, elas viram filtros na tela inicial e uma opção no editor de cada música.';
    caixa.append(livre, rodape);

    onboarding.replaceChildren(caixa);
  }

  // Cria em sequência: cada resposta devolve a revisão nova, que precisa ir na
  // chamada seguinte. Nome equivalente a um que já existe é pulado (409), não
  // interrompe o kit.
  async function aplicarKit(nomes, botao) {
    botao.disabled = true;
    let criadas = 0;
    try {
      for (const nome of nomes) {
        try {
          await request({ nome });
          criadas += 1;
        } catch (error) {
          if (!error.jaExiste) throw error;
        }
      }
      await cifroSync.sync(window.CIFRO_BAND_ID, { force: true });
      await load();
      if (window.cifroToast) cifroToast(criadas + ' categorias criadas.', 'success');
    } catch (error) {
      await load();
      if (window.cifroToast) cifroToast(error.message, 'error');
    } finally {
      botao.disabled = false;
    }
  }

  function resetForm() {
    idInput.value = '';
    nameInput.value = '';
    cancel.hidden = true;
    nameInput.focus();
  }

  function render() {
    renderOnboarding();
    list.replaceChildren();
    if (!categories.length) {
      // Lista vazia é representada pelo bloco de onboarding (acima), não por
      // uma linha própria aqui — evita dizer a mesma coisa duas vezes.
      return;
    }
    categories.forEach(category => {
      const row = document.createElement('li');
      row.className = 'category-row';
      const name = document.createElement('span');
      name.className = 'category-name';
      name.textContent = category.nome;
      const total = contarMusicas(category.nome);
      const count = document.createElement('span');
      count.className = 'category-count';
      count.textContent = rotuloContagem(total);
      const actions = document.createElement('div');
      actions.className = 'category-actions';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn btn--secondary';
      edit.textContent = 'Editar';
      edit.addEventListener('click', () => {
        idInput.value = category.id;
        nameInput.value = category.nome;
        cancel.hidden = false;
        nameInput.focus();
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn--danger';
      remove.textContent = 'Excluir';
      if (total > 0) {
        remove.disabled = true;
        remove.title = category.nome + ' está em uso por ' + rotuloContagem(total) + '.';
        remove.setAttribute('aria-label', 'Excluir ' + category.nome + ' — em uso por ' + rotuloContagem(total));
      } else {
        remove.addEventListener('click', () => deleteCategory(category));
      }
      actions.append(edit, remove);
      row.append(name, count, actions);
      list.appendChild(row);
    });
  }

  async function request(payload) {
    if (payload) await cifroSync.sync(window.CIFRO_BAND_ID, { force: true });
    const response = await fetch(api, payload ? {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    } : { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      const erro = new Error(data.error || 'Não foi possível concluir a operação.');
      erro.jaExiste = response.status === 409 && !!data.categoria;
      erro.categoria = data.categoria || null;
      throw erro;
    }
    return data;
  }

  async function load() {
    try {
      // As contagens por música são um extra; a lista de categorias em si
      // não depende do sync. Se ele falhar (ou nunca resolver por estar
      // offline), a contagem cai para "nenhuma música" mas a lista — que é
      // o que importa — continua aparecendo normalmente.
      await cifroSync.load(window.CIFRO_BAND_ID).catch(() => {});
      const data = await request();
      categories = data.categorias || [];
      render();
    } catch (error) {
      list.innerHTML = '<li class="category-empty">Não foi possível carregar as categorias.</li>';
      if (window.cifroToast) cifroToast(error.message, 'error');
    }
  }

  async function deleteCategory(category) {
    const confirmed = await cifroConfirm({
      title: 'Excluir categoria',
      message: `Deseja excluir a categoria <strong>${String(category.nome).replace(/[<>&]/g, '')}</strong>?`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      danger: true
    });
    if (!confirmed) return;
    try {
      await request({ action: 'delete', id: category.id });
      await cifroSync.sync(window.CIFRO_BAND_ID, { force: true });
      if (String(idInput.value) === String(category.id)) resetForm();
      await load();
      if (window.cifroToast) cifroToast('Categoria excluída.', 'success');
    } catch (error) {
      if (window.cifroToast) cifroToast(error.message, 'error');
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const nome = nameInput.value.trim();
    if (!nome) return;
    try {
      await request({ id: idInput.value || null, nome });
      await cifroSync.sync(window.CIFRO_BAND_ID, { force: true });
      resetForm();
      await load();
      if (window.cifroToast) cifroToast('Categoria salva.', 'success');
    } catch (error) {
      if (window.cifroToast) cifroToast(error.message, 'error');
    }
  });

  cancel.addEventListener('click', resetForm);
  load();
})();
