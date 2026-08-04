(function () {
  const api = '/src/backend/categorias/api.php';
  const form = document.getElementById('categoryForm');
  const idInput = document.getElementById('categoryId');
  const nameInput = document.getElementById('categoryName');
  const list = document.getElementById('categoryList');
  const cancel = document.getElementById('cancelEdit');
  let categories = [];

  function resetForm() {
    idInput.value = '';
    nameInput.value = '';
    cancel.hidden = true;
    nameInput.focus();
  }

  function render() {
    list.replaceChildren();
    if (!categories.length) {
      const empty = document.createElement('li');
      empty.className = 'category-empty';
      empty.textContent = 'Nenhuma categoria cadastrada.';
      list.appendChild(empty);
      return;
    }
    categories.forEach(category => {
      const row = document.createElement('li');
      row.className = 'category-row';
      const name = document.createElement('span');
      name.className = 'category-name';
      name.textContent = category.nome;
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
      remove.addEventListener('click', () => deleteCategory(category));
      actions.append(edit, remove);
      row.append(name, actions);
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
    if (!response.ok || !data.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
    return data;
  }

  async function load() {
    try {
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
