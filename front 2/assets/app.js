
const API_DEFAULT = 'http://127.0.0.1:8000';
let API = localStorage.getItem('retroflow_api') || API_DEFAULT;
const PAGE = document.body.dataset.page || 'dashboard';

let state = {
    sprints: [],
    actual: null,
    pastSprints: [],
    summary: null,
    detail: null,
    retomar: [],
    currentId: null,
    limite: 3,
    editingItem: null
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const dateFmt = s => s
    ? new Date(s + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[c]));

const lines = s => s.split('\n').map(x => x.trim()).filter(Boolean);

function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3200);
}

function showNotice(msg, type = '') {
    const n = $('#noticeArea');
    n.innerHTML = msg ? `<div class="notice ${type}">${esc(msg)}</div>` : '';
}

function statusPill(status) {
    const map = {
        actual: ['En curso', 'pill-live'],
        programado: ['Programado', 'pill-planned'],
        finalizado: ['Finalizado', 'pill-done']
    };
    const v = map[status] || ['Estado', 'pill-neutral'];
    return `<span class="pill ${v[1]}">${v[0]}</span>`;
}

async function api(path, options = {}) {
    const res = await fetch(API + path, {
        ...options,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    let data = {};
    try {
        data = await res.json();
    } catch { }

    if (!res.ok) {
        const err = new Error(data?.error?.mensaje || data?.mensaje || `Error HTTP ${res.status}`);
        err.status = res.status;
        err.data = data?.error || data || {};
        throw err;
    }

    const body = (data && Object.prototype.hasOwnProperty.call(data, 'data')) ? data.data : data;
    return body;
}

async function health() {
    try {
        await api('/salud');
        const estado = await api('/estado');
        $('#apiDot').className = 'status-dot ok';
        $('#apiStatus').textContent = 'API y base de datos conectadas';
        $('#apiUrlLabel').textContent = API.replace(/^https?:\/\//, '');
        return estado;
    } catch {
        $('#apiDot').className = 'status-dot bad';
        $('#apiStatus').textContent = 'Sin conexion con API o base de datos';
        $('#apiUrlLabel').textContent = API.replace(/^https?:\/\//, '');
        return null;
    }
}

function setView(view) {
    $$('.view').forEach(x => x.classList.toggle('active', x.id === 'view-' + view));
    $$('[data-page-link]').forEach(x => x.classList.toggle('active', x.dataset.pageLink === view || (view === 'detail' && x.dataset.pageLink === 'sprints')));

    const names = {
        dashboard: ['WORKSPACE / RESUMEN', 'Resumen general'],
        sprints: ['WORKSPACE / SPRINTS', 'Sprints'],
        history: ['WORKSPACE / HISTORIAL', 'Historial'],
        detail: ['WORKSPACE / DETALLE', 'Detalle del sprint']
    };

    $('#crumb').textContent = names[view][0];
    $('#pageTitle').textContent = names[view][1];

    if (view === 'dashboard') loadDashboard();
    if (view === 'sprints') loadSprints();
    if (view === 'history') loadHistory();
}

async function loadDashboard() {
    try {
        const [actual, sprints, pastSprints, summary] = await Promise.all([
            api('/sprints/actual'),
            api('/sprints'),
            api('/sprints/anteriores'),
            api('/proyecto/resumen?limite=' + state.limite)
        ]);

        state.actual = actual?.actual ?? null;
        state.sprints = Array.isArray(sprints)
            ? sprints
            : (Array.isArray(sprints?.sprints) ? sprints.sprints : []);
        state.pastSprints = Array.isArray(pastSprints)
            ? pastSprints
            : (Array.isArray(pastSprints?.sprints) ? pastSprints.sprints : []);
        state.summary = summary || {};

        renderDashboard();
    } catch (e) {
        showNotice(e.message, 'error');
    }
}

function renderDashboard() {
    const s = state.summary || {};

    $('#statSprints').textContent = s.sprints_finalizados ?? 0;
    $('#statDone').textContent = s.realizadas?.total ?? 0;
    $('#statPending').textContent = s.pendientes?.total ?? 0;
    $('#statBlocks').textContent = s.impedimentos ?? 0;

    const a = state.actual;

    $('#currentPill').textContent = a ? 'En curso' : 'Sin sprint';
    $('#currentSprint').innerHTML = a
        ? sprintFocus(a)
        : emptySprint('No hay un sprint en curso', 'Crea un sprint para comenzar a organizar los objetivos del equipo.');

    const past = state.pastSprints || [];
    $('#pastSprints').innerHTML = past.length
        ? past.slice(0, 3).map(d => sprintFocus(d)).join('')
        : emptySprint('Aún no hay sprints pasados', 'Los sprints finalizados aparecerán aquí.');

    const done = s.realizadas?.total || 0;
    const pending = s.pendientes?.total || 0;
    const total = done + pending;

    $('#progressBar').style.width = (total ? done / total * 100 : 0) + '%';
    $('#progressDone').textContent = done + ' realizadas';
    $('#progressPending').textContent = pending + ' pendientes';

    const recent = [
        ...(s.pendientes?.items || []),
        ...(s.realizadas?.items || [])
    ];
    const restantes = (s.pendientes?.restantes || 0) + (s.realizadas?.restantes || 0);

    $('#recentList').innerHTML = recent.length
        ? recent.map(x => `<span class="mini-chip">${x.cumplida ? '✓' : '○'} ${esc(x.descripcion)}</span>`).join('')
            + (restantes ? `<span class="mini-chip">+${restantes} más</span>` : '')
        : '<span class="empty-inline">Todavía no hay acciones para mostrar.</span>';
}

function emptySprint(title, desc) {
    return `<div class="empty-state compact"><div class="empty-icon">◷</div><b>${title}</b><p>${desc}</p></div>`;
}

function sprintFocus(d, planned = false) {
    const s = d.sprint || d;
    const items = d.items || [];
    const done = d.realizadas?.length || 0;
    const pending = d.pendientes?.length || 0;
    const total = done + pending;

    return `
        <div class="sprint-hero">
            <div>
                <h4>${esc(s.nombre)}</h4>
                <div class="sprint-meta">${dateFmt(s.fecha_inicio)} — ${dateFmt(s.fecha_fin)}</div>
            </div>
            ${statusPill(s.estado)}
        </div>
        <div class="sprint-progress">
            <div class="progress-track"><span style="width:${total ? done / total * 100 : 0}%"></span></div>
            <div class="progress-labels">
                <span>${done} de ${total} objetivos realizados</span>
                <span>${total ? Math.round(done / total * 100) : 0}%</span>
            </div>
        </div>
        <div class="sprint-footer">
            <span class="sprint-meta">${pending} pendientes</span>
            <button class="text-button" onclick="openDetail(${s.id})">Ver sprint →</button>
        </div>`;
}

async function loadSprints() {
    try {
        const result = await api('/sprints');
        state.sprints = Array.isArray(result)
            ? result
            : (Array.isArray(result?.sprints) ? result.sprints : []);
        renderSprints();
    } catch (e) {
        showNotice(e.message, 'error');
    }
}

function renderSprints() {
    const q = ($('#sprintSearch')?.value || '').toLowerCase();
    const f = $('#statusFilter')?.value || 'todos';

    const rows = (Array.isArray(state.sprints) ? state.sprints : [])
        .filter(s => (s.nombre || '').toLowerCase().includes(q) && (f === 'todos' || s.estado === f));

    $('#sprintList').innerHTML = rows.length
        ? rows.map(s => `
            <article class="sprint-row">
                <div class="sprint-symbol">◷</div>
                <div class="sprint-row-main">
                    <b>${esc(s.nombre)}</b>
                    <small>${dateFmt(s.fecha_inicio)} — ${dateFmt(s.fecha_fin)}</small>
                </div>
                ${statusPill(s.estado)}
                <div class="sprint-row-actions">
                    <button class="text-button" onclick="openDetail(${s.id})">Abrir →</button>
                </div>
            </article>`).join('')
        : '<div class="empty-page">◷<b>No se encontraron sprints</b><p>Crea un sprint o cambia el filtro de búsqueda.</p></div>';
}

async function loadHistory() {
    try {
        const list = await api('/sprints/anteriores');

        $('#historyList').innerHTML = list.length
            ? list.map(d => {
                const s = d.sprint;
                return `
                    <article class="history-card">
                        <div class="history-top">
                            <span class="eyebrow">RETROSPECTIVA COMPLETADA</span>
                            ${statusPill('finalizado')}
                        </div>
                        <h3>${esc(s.nombre)}</h3>
                        <div class="sprint-meta">${dateFmt(s.fecha_inicio)} — ${dateFmt(s.fecha_fin)}</div>
                        <div class="history-stats">
                            <span><b>${d.realizadas.length}</b> realizadas</span>
                            <span><b>${d.pendientes.length}</b> pendientes</span>
                            <span><b>${d.logros.length}</b> logros</span>
                            <span><b>${d.impedimentos.length}</b> impedimentos</span>
                        </div>
                        <div style="text-align:right;margin-top:10px">
                            <button class="text-button" onclick="openDetail(${s.id})">Consultar retrospectiva →</button>
                        </div>
                    </article>`;
            }).join('')
            : '<div class="empty-page">↺<b>Aún no hay retrospectivas</b><p>Cuando finalices tu primer sprint, su resumen aparecerá aquí.</p></div>';
    } catch (e) {
        showNotice(e.message, 'error');
    }
}
async function fetchDetail(id) {
    const normalize = value => {
        const result = value && typeof value === 'object' ? value : {};
        result.sprint = result.sprint || null;
        result.items = Array.isArray(result.items) ? result.items : [];
        result.logros = Array.isArray(result.logros)
            ? result.logros
            : result.items.filter(item => item.categoria === 'logro');
        result.impedimentos = Array.isArray(result.impedimentos)
            ? result.impedimentos
            : result.items.filter(item => item.categoria === 'impedimento');
        result.comentarios = Array.isArray(result.comentarios)
            ? result.comentarios
            : result.items.filter(item => item.categoria === 'comentario');
        return result;
    };

    try {
        const retrospective = normalize(await api(`/sprints/${id}/retrospectiva`));
        if (retrospective.sprint) return retrospective;
    } catch (error) {
        console.warn('No se pudo cargar la retrospectiva; se intentará cargar el sprint y sus elementos.', error);
    }

    const [sprintResult, itemsResult] = await Promise.allSettled([
        api(`/sprints/${id}`),
        api(`/sprints/${id}/items`)
    ]);

    if (sprintResult.status !== 'fulfilled') {
        throw new Error(sprintResult.reason?.message || 'No se pudo recuperar la información del sprint.');
    }

    const sprintData = sprintResult.value || {};
    const result = normalize({
        ...sprintData,
        sprint: sprintData.sprint || sprintData
    });

    if (itemsResult.status === 'fulfilled') {
        const itemsData = itemsResult.value;
        result.items = Array.isArray(itemsData)
            ? itemsData
            : (Array.isArray(itemsData?.items) ? itemsData.items : result.items);
    }

    result.logros = result.items.filter(item => item.categoria === 'logro');
    result.impedimentos = result.items.filter(item => item.categoria === 'impedimento');
    result.comentarios = result.items.filter(item => item.categoria === 'comentario');

    if (!result.sprint?.id) throw new Error('La API respondió, pero no devolvió los datos del sprint solicitado.');
    return result;
}

async function openDetail(id) {
    if (PAGE !== 'detail') {
        window.location.href = `detalle.html?id=${encodeURIComponent(id)}`;
        return;
    }

    try {
        const d = await fetchDetail(id);
        state.detail = d;
        state.currentId = Number(id);
        renderDetail(d);
        setView('detail');
    } catch (e) {
        showNotice(e.message, 'error');
    }
}

function itemRows(items, actions = false) {
    if (!items?.length) return '<div class="empty-inline">No hay elementos registrados.</div>';

    return items.map(i => `
        <div class="item-row">
            <span class="item-bullet"></span>
            <div class="item-copy">
                <b>${esc(i.descripcion)}</b>
                <small>${i.cumplida === true ? 'Completada' : i.cumplida === false && i.categoria === 'accion' ? 'Pendiente' : esc(i.categoria)}</small>
            </div>
            ${actions ? `<div class="item-tools"><button class="icon-btn" title="Editar" onclick="openEditItem(${i.id})">✎</button><button class="icon-btn" title="Eliminar" onclick="deleteItem(${i.id})">×</button></div>` : ''}
        </div>`).join('');
}

function renderDetail(d) {
    const s = d.sprint;
    d.items = Array.isArray(d.items) ? d.items : [];
    d.logros = Array.isArray(d.logros) ? d.logros : [];
    d.impedimentos = Array.isArray(d.impedimentos) ? d.impedimentos : [];
    d.comentarios = Array.isArray(d.comentarios) ? d.comentarios : [];

    $('#detailStatus').outerHTML = statusPill(s.estado).replace('<span', '<span id="detailStatus"');

    $('#detailContent').innerHTML = `
        <div class="detail-head">
            <div>
                <div class="eyebrow">SPRINT ${s.id} · ${esc(s.estado.toUpperCase())}</div>
                <h2>${esc(s.nombre)}</h2>
                <p>${dateFmt(s.fecha_inicio)} — ${dateFmt(s.fecha_fin)}</p>
            </div>
            <div class="detail-actions">
                ${s.estado !== 'finalizado'
                    ? '<button class="button button-secondary" onclick="openEditSprint()">✎ Editar sprint</button><button class="button button-secondary" onclick="openItemDialog()">＋ Agregar elemento</button><button class="button button-primary" onclick="openFinish()">Finalizar retrospectiva</button>'
                    : ''}
            </div>
        </div>
        <div class="detail-columns">
            <div>
                <section class="detail-panel">
                    <h3>◉ Objetivos y acciones</h3>
                    ${itemRows(d.items.filter(i => i.categoria === 'accion'), s.estado !== 'finalizado')}
                </section>
                <section class="detail-panel">
                    <h3>✦ Logros</h3>
                    ${itemRows(d.logros)}
                </section>
            </div>
            <div>
                <section class="detail-panel">
                    <h3>⚑ Impedimentos</h3>
                    ${itemRows(d.impedimentos)}
                </section>
                <section class="detail-panel">
                    <h3>☷ Comentarios</h3>
                    ${itemRows(d.comentarios)}
                </section>
            </div>
        </div>
        ${d.control?.finalizada
            ? '<div class="notice success">Esta retrospectiva ya fue finalizada. Aquí puedes consultar el resultado guardado.</div>'
            : d.control?.retrospectiva_vencida
                ? '<div class="notice">La retrospectiva está pendiente y debe finalizarse para continuar usando el sistema.</div>'
                : ''}`;
}

async function refreshDetail() {
    const d = await fetchDetail(state.currentId);
    state.detail = d;
    renderDetail(d);
    await loadDashboard();
}

function openSprintDialog() {
    const f = $('#sprintForm');
    f.reset();

    const today = new Date().toLocaleDateString('en-CA');
    f.fecha_inicio.min = today;
    f.fecha_inicio.value = today;

    let future = new Date();
    future.setDate(future.getDate() + 7);
    f.fecha_fin.value = future.toLocaleDateString('en-CA');
    f.fecha_fin.min = today;

    loadCarry();
    $('#sprintDialog').showModal();
}

async function loadCarry() {
    try {
        const d = await api('/sprints/ultimo/acciones');
        const pending = (d.acciones || []).filter(x => x.cumplida !== true);

        state.retomar = pending;
        $('#carryBox').classList.toggle('hidden', !pending.length);
        $('#carryList').innerHTML = pending
            .map(x => `<label class="carry-option"><input type="checkbox" value="${x.id}"> ${esc(x.descripcion)}</label>`)
            .join('');
    } catch {
        $('#carryBox').classList.add('hidden');
    }
}

$('#sprintForm').addEventListener('submit', async e => {
    e.preventDefault();

    const f = e.currentTarget;
    const fd = new FormData(f);
    const payload = {
        nombre: fd.get('nombre').trim(),
        fecha_inicio: fd.get('fecha_inicio'),
        fecha_fin: fd.get('fecha_fin'),
        objetivos: lines(fd.get('objetivos')),
        retomar: $$('#carryList input:checked').map(x => Number(x.value))
    };

    try {
        await api('/sprints', { method: 'POST', body: JSON.stringify(payload) });
        $('#sprintDialog').close();
        toast('Sprint creado correctamente');
        window.location.href = 'sprints.html';
    } catch (err) {
        toast(err.message);
    }
});

function openItemDialog() {
    if (state.detail?.sprint?.estado === 'finalizado') return;
    $('#itemForm').reset();
    state.editingItem = null;
    $('#itemDialogTitle').textContent = 'Agregar elemento';
    $('#itemSubmit').textContent = 'Guardar elemento';
    $('#doneWrap').classList.remove('hidden');
    $('#itemDialog').showModal();
}

$('#itemForm [name=categoria]').addEventListener('change', e => {
    $('#doneWrap').classList.toggle('hidden', e.target.value !== 'accion');
});

$('#itemForm').addEventListener('submit', async e => {
    e.preventDefault();

    const f = e.currentTarget;
    const fd = new FormData(f);
    const cat = fd.get('categoria');
    const payload = {
        categoria: cat,
        descripcion: fd.get('descripcion').trim(),
        cumplida: cat === 'accion' ? f.cumplida.checked : false
    };

    try {
        if (state.editingItem) {
            await api(`/items/${state.editingItem}`, { method: 'PUT', body: JSON.stringify(payload) });
            toast('Elemento actualizado');
        } else {
            await api(`/sprints/${state.currentId}/items`, { method: 'POST', body: JSON.stringify(payload) });
            toast('Elemento agregado');
        }
        $('#itemDialog').close();
        await refreshDetail();
    } catch (err) {
        toast(err.message);
    }
});

async function deleteItem(id) {
    if (!confirm('¿Seguro que deseas eliminar este elemento?')) return;

    try {
        await api(`/items/${id}`, { method: 'DELETE' });
        toast('Elemento eliminado');
        await refreshDetail();
    } catch (e) {
        toast(e.message);
    }
}

function openFinish() {
    const d = state.detail;
    if (!d) return;

    $('#finishForm').reset();

    const actions = d.items.filter(i => i.categoria === 'accion');
    $('#finishActions').innerHTML = actions.length
        ? actions.map(i => `<label class="choice-option"><input type="checkbox" name="realizadas" value="${i.id}" ${i.cumplida === true ? 'checked' : ''}> ${esc(i.descripcion)}</label>`).join('')
        : '<span class="empty-inline">No hay objetivos iniciales registrados.</span>';

    const early = d.control?.requiere_confirmacion_anticipada;
    $('#finishEarlyNotice').classList.toggle('hidden', !early);
    $('#finishEarlyNotice').textContent = early
        ? `La fecha programada de finalización es ${dateFmt(d.sprint.fecha_fin)}. Para finalizar antes, debes confirmar la casilla inferior.`
        : '';
    $('#finishForm [name=confirmar_anticipada]').closest('label').classList.toggle('hidden', !early);

    $('#finishDialog').showModal();
}

$('#finishForm').addEventListener('submit', async e => {
    e.preventDefault();

    const f = e.currentTarget;
    const fd = new FormData(f);
    const payload = {
        realizadas: fd.getAll('realizadas').map(Number),
        adicionales: lines(fd.get('adicionales')),
        logros: lines(fd.get('logros')),
        impedimentos: lines(fd.get('impedimentos')),
        comentarios: lines(fd.get('comentarios')),
        acuerdos: lines(fd.get('acuerdos')),
        confirmar_anticipada: f.confirmar_anticipada.checked
    };

    try {
        await api(`/sprints/${state.currentId}/retrospectiva/finalizar`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        $('#finishDialog').close();
        toast('Retrospectiva finalizada');
        await openDetail(state.currentId);
    } catch (err) {
        if (err.data?.codigo === 'CONFIRMACION_REQUERIDA') {
            toast('Debes confirmar la finalización anticipada.');
            $('#finishEarlyNotice').classList.remove('hidden');
            $('#finishEarlyNotice').textContent = err.message;
            return;
        }
        toast(err.message);
    }
});
async function openEditItem(id) {
    try {
        const it = await api(`/items/${id}`);
        const f = $('#itemForm');
        f.reset();
        state.editingItem = it.id;
        f.categoria.value = it.categoria;
        f.descripcion.value = it.descripcion;
        f.cumplida.checked = it.cumplida === true;
        $('#doneWrap').classList.toggle('hidden', it.categoria !== 'accion');
        $('#itemDialogTitle').textContent = 'Editar elemento';
        $('#itemSubmit').textContent = 'Guardar cambios';
        $('#itemDialog').showModal();
    } catch (e) {
        toast(e.message);
    }
}
async function openEditSprint() {
    try {
        const d = await api(`/sprints/${state.currentId}`);
        const s = d.sprint;
        const f = $('#editSprintForm');
        const today = new Date().toLocaleDateString('en-CA');
        const started = s.fecha_inicio <= today;

        f.nombre.value = s.nombre;
        f.fecha_inicio.value = s.fecha_inicio;
        f.fecha_fin.value = s.fecha_fin;
        f.fecha_inicio.disabled = started;
        f.fecha_inicio.min = today;
        f.fecha_fin.min = today;
        $('#editSprintHint').classList.toggle('hidden', !started);
        $('#editSprintDialog').showModal();
    } catch (e) {
        toast(e.message);
    }
}

$('#editSprintForm').addEventListener('submit', async e => {
    e.preventDefault();

    const f = e.currentTarget;
    const payload = { nombre: f.nombre.value.trim(), fecha_fin: f.fecha_fin.value };
    if (!f.fecha_inicio.disabled) payload.fecha_inicio = f.fecha_inicio.value;

    try {
        await api(`/sprints/${state.currentId}`, { method: 'PUT', body: JSON.stringify(payload) });
        $('#editSprintDialog').close();
        toast('Sprint actualizado');
        await refreshDetail();
    } catch (err) {
        toast(err.message);
    }
});

$('#limitSelect').addEventListener('change', e => {
    state.limite = Number(e.target.value);
    loadDashboard();
});


$('#newSprintBtn').onclick = openSprintDialog;
$('#newSprintBtn2').onclick = openSprintDialog;
$$('[data-action=create]').forEach(b => b.onclick = openSprintDialog);
$$('[data-close]').forEach(b => b.addEventListener('click', () => $('#' + b.dataset.close).close()));

$('#configBtn').onclick = () => {
    $('#configForm').apiUrl.value = API;
    $('#configDialog').showModal();
};

$('#configForm').addEventListener('submit', async e => {
    e.preventDefault();

    API = e.currentTarget.apiUrl.value.replace(/\/+$/, '');
    localStorage.setItem('retroflow_api', API);
    $('#configDialog').close();

    const estado = await health();
    if (!estado) {
        showNotice('No se pudo verificar la conexion. Comprueba que el backend y la base de datos esten activos.', 'error');
        return;
    }

    showNotice('');
    await loadDashboard();
    toast('Conexión actualizada');
});

$('#sprintSearch').addEventListener('input', renderSprints);
$('#statusFilter').addEventListener('change', renderSprints);

$('#todayLabel').textContent = new Date().toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
});

(async () => {
    const e = await health();

    if (!e) {
        showNotice('No se pudo verificar la conexion. Comprueba que el backend y la base de datos esten activos.', 'error');
        return;
    }

    if (e.bloquear_navegacion && e.sprint_actual_id && PAGE !== 'detail') {
        window.location.href = `detalle.html?id=${encodeURIComponent(e.sprint_actual_id)}`;
        return;
    }

    if (PAGE === 'detail') {
        const id = new URLSearchParams(window.location.search).get('id');
        if (!id || !/^\d+$/.test(id)) {
            showNotice('No se indicó un sprint válido para consultar.', 'error');
            setView('detail');
            return;
        }
        await openDetail(Number(id));
        return;
    }

    setView(PAGE);
})();
