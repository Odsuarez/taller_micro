const API = (
  localStorage.getItem("retrospectivas_api") || "http://127.0.0.1:8000"
).replace(/\/+$/, "");
const pagina =
  location.pathname.split("/").pop().replace(".html", "") || "index";
const parametros = new URLSearchParams(location.search);
const contenido = document.querySelector("#contenido");
let estado = null;
let detalle = null;
let registro = null;
let revision = null;
let ocupado = false;
let ultimaFecha = "";
const categorias = {
  accion: "Acción / objetivo",
  logro: "Logro",
  impedimento: "Impedimento",
  comentario: "Comentario",
  otro: "Otro",
};
const escaparHtml = (valor) =>
  String(valor ?? "").replace(
    /[&<>"']/g,
    (letra) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        letra
      ],
  );
const clave = (nombre) => API + ":" + nombre;
function leer(nombre, inicial) {
  try {
    return JSON.parse(sessionStorage.getItem(clave(nombre))) ?? inicial;
  } catch {
    return inicial;
  }
}
function conservar(nombre, valor) {
  sessionStorage.setItem(clave(nombre), JSON.stringify(valor));
}
function quitar(nombre) {
  sessionStorage.removeItem(clave(nombre));
}
function mensaje(texto, exito = false) {
  document.querySelector("#error").innerHTML = texto
    ? `<p class="${exito ? "notice" : "alert"}">${escaparHtml(texto)}</p>`
    : "";
}
function ir(paginaDestino) {
  location.assign(paginaDestino);
}
function errorMensaje(error) {
  if (error.name !== "AbortError") mensaje(error.message);
}
async function api(ruta, metodo = "GET", datos) {
  let respuesta;
  try {
    respuesta = await fetch(API + ruta, {
      method: metodo,
      headers: {
        Accept: "application/json",
        ...(datos === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(datos === undefined ? {} : { body: JSON.stringify(datos) }),
    });
  } catch {
    throw new Error(
      "No se pudo conectar con el backend. Inicia el servidor PHP y revisa la dirección de conexión.",
    );
  }
  let resultado;
  try {
    resultado = await respuesta.json();
  } catch {
    throw new Error(
      "La API no devolvió JSON. Revisa la dirección y los errores del servidor.",
    );
  }
  if (!respuesta.ok || resultado.ok === false) {
    const error = new Error(
      resultado.error?.mensaje || "No se pudo completar la operación.",
    );
    error.codigo = resultado.error?.codigo;
    error.detalles = resultado.error?.detalles;
    if (respuesta.status === 423) {
      estado = { ...estado, ...error.detalles, bloquear_navegacion: true };
      bloquearNavegacion();
      if (pagina !== "retrospectiva") ir("retrospectiva.html");
    }
    throw error;
  }
  return resultado.data;
}
function intro(etiqueta, titulo, texto) {
  return `<div class="intro"><span class="eyebrow">${etiqueta}</span><h1>${titulo}</h1><p>${texto}</p></div>`;
}
function lista(items = [], vacio = "No hay registros en esta sección.") {
  return items.length
    ? `<ul class="objetivos">${items.map((item) => `<li class="record-copy">${escaparHtml(item.descripcion)}</li>`).join("")}</ul>`
    : `<p class="muted">${vacio}</p>`;
}
function gestion(items) {
  return items.length
    ? `<details class="gestionar"><summary>Editar o eliminar registros guardados</summary><ul class="lista-editable">${items.map((item) => `<li><span><small>${categorias[item.categoria] || ""}</small><br>${escaparHtml(item.descripcion)}</span><div class="acciones-registro"><a class="button light" href="editar_registro.html?id=${item.id}">Editar</a><a class="button light" href="eliminar_registro.html?id=${item.id}">Eliminar</a></div></li>`).join("")}</ul></details>`
    : "";
}
function otros(items) {
  return items.length
    ? `<ul class="items">${items.map((item) => `<li><span class="badge">${categorias[item.categoria]}</span><span class="record-copy">${escaparHtml(item.descripcion)}</span></li>`).join("")}</ul>`
    : '<p class="muted">No hay registros en esta sección.</p>';
}
function fechas(sprint) {
  return `${escaparHtml(sprint.fecha_inicio)} — ${escaparHtml(sprint.fecha_fin)}`;
}
function bloquearNavegacion() {
  if (!estado?.bloquear_navegacion) return;
  document.querySelector(".page-title").removeAttribute("href");
  document.querySelector("nav").innerHTML =
    '<span class="button primary" aria-current="page">Retrospectiva pendiente</span><span class="button" aria-disabled="true">Ver sprint actual</span><span class="button" aria-disabled="true">Ver sprints anteriores</span>';
}
async function actualizarEstado() {
  estado = await api("/estado");
  ultimaFecha = estado.fecha_actual;
  bloquearNavegacion();
  if (estado.bloquear_navegacion && pagina !== "retrospectiva") {
    ir("retrospectiva.html");
    throw new DOMException("Redirigiendo", "AbortError");
  }
  return estado;
}
function resumenLista(grupo, nombre, vacio) {
  return (
    lista(grupo.items, vacio) +
    (grupo.restantes
      ? `<details class="mas-elementos"><summary data-global="${nombre}">Ver ${grupo.restantes} elementos más</summary><div id="global-${nombre}"></div></details>`
      : "")
  );
}
async function inicio() {
  const [actual, global] = await Promise.all([
    api("/sprints/actual"),
    api("/proyecto/resumen"),
  ]);
  const d = actual.actual || actual.programado;
  let sprintActual;
  if (actual.actual)
    sprintActual = `<h3>${escaparHtml(d.sprint.nombre)}</h3><p class="muted">${fechas(d.sprint)}</p><h3>Lo que ya se realizó</h3>${lista(d.realizadas, "Todavía no hay objetivos marcados como realizados.")}<h3>Lo que falta</h3>${lista(d.pendientes, "Todos los objetivos están realizados.")}<a class="text-link" href="sprint_actual.html">Ver detalle y modificar este sprint →</a>`;
  else if (d)
    sprintActual = `<h3>${escaparHtml(d.sprint.nombre)}</h3><p>Tu próximo sprint empieza el ${escaparHtml(d.sprint.fecha_inicio)}.</p><h3>Objetivos por realizar</h3>${lista(d.pendientes)}<a class="text-link" href="sprint_actual.html">Ver detalle y modificar este sprint →</a>`;
  else
    sprintActual =
      '<div class="empty"><h3>Todavía no hay un sprint actual</h3><p>Acá encontrarás el resumen del sprint actual: lo realizado y lo que falta.</p><a class="text-link" href="agendar.html">Agendar nuevo sprint →</a></div>';
  const proyecto = global.sprints_finalizados
    ? `<p class="muted">Resumen de ${global.sprints_finalizados} sprints finalizados. Para objetivos con el mismo texto, se muestra su estado más reciente.</p><h3>Resumen de lo que ya se realizó</h3>${resumenLista(global.realizadas, "realizadas", "Aún no hay objetivos realizados en el historial.")}<h3>Lo que falta</h3>${resumenLista(global.pendientes, "pendientes", "No quedaron objetivos pendientes en los sprints anteriores.")}<p class="muted">${global.logros} logros y ${global.impedimentos} impedimentos registrados.</p><a class="text-link" href="anteriores.html">Consultar sprints anteriores →</a>`
    : '<div class="empty"><p>Acá encontrarás el resumen acumulado del proyecto: lo realizado y lo que quedó pendiente en los sprints anteriores.</p><p>El historial aparecerá al finalizar tu primera retrospectiva.</p></div>';
  contenido.innerHTML =
    intro(
      "SEGUIMIENTO DEL EQUIPO",
      "El avance de tu proyecto, sprint a sprint.",
      "Revisa lo realizado y los objetivos que siguen pendientes.",
    ) +
    `<div class="resumen-escalonado"><section class="card actual-card"><span class="eyebrow">EN ESTE MOMENTO</span><h2>Sprint actual</h2>${sprintActual}</section><section class="card global-card"><span class="eyebrow">TODO LO ACUMULADO</span><h2>Proyecto global</h2>${proyecto}</section></div>`;
}
function agendaInicial() {
  return {
    nombre: "",
    fecha_inicio: "",
    fecha_fin: "",
    nuevo: "",
    objetivos: [],
    retomar: [],
  };
}
let agenda = leer("agenda", agendaInicial());
let pendientesRetomar = [];
function guardarAgenda() {
  const form = document.querySelector("#agenda");
  if (!form) return;
  for (const campo of ["nombre", "fecha_inicio", "fecha_fin", "nuevo"])
    agenda[campo] = form.elements[campo].value;
  agenda.retomar = [...form.querySelectorAll("[name=retomar]:checked")].map(
    (c) => Number(c.value),
  );
  conservar("agenda", agenda);
}
function renderAgenda() {
  contenido.innerHTML =
    intro(
      "SIGUIENTE PASO",
      "Agendar nuevo sprint",
      "Define las fechas y los objetivos del próximo sprint.",
    ) +
    (parametros.has("finalizado")
      ? '<p class="notice">Retrospectiva finalizada. El sprint ya está en el historial.</p>'
      : "") +
    `<form class="card workflow" id="agenda"><label>Nombre del sprint<input name="nombre" required maxlength="100" value="${escaparHtml(agenda.nombre)}" placeholder="Ejemplo: Sprint 2"></label><div class="date-grid"><label>Fecha de inicio<input name="fecha_inicio" type="date" min="${estado.fecha_actual}" max="9999-12-31" required value="${escaparHtml(agenda.fecha_inicio)}"></label><label>Fecha de finalización<input name="fecha_fin" type="date" min="${[estado.fecha_actual, agenda.fecha_inicio].sort().pop()}" max="9999-12-31" required value="${escaparHtml(agenda.fecha_fin)}"></label></div><label for="nuevo-objetivo">Nuevo objetivo por realizar</label><div class="objetivo-input"><input id="nuevo-objetivo" name="nuevo" maxlength="2000" value="${escaparHtml(agenda.nuevo)}" placeholder="Escribe un objetivo"><button class="button primary" type="button" data-accion="anadir">Añadir</button></div><p class="muted">Añade los objetivos uno por uno. Se guardarán al agendar el sprint.</p><ul class="lista-editable">${agenda.objetivos.map((objetivo, indice) => `<li><span>${escaparHtml(objetivo)}</span><button class="button light" type="button" data-quitar="${indice}">Quitar</button></li>`).join("")}</ul>${pendientesRetomar.length ? `<h3>Retomar pendientes del último sprint</h3><p class="muted">Selecciona cuáles quieres incluir como objetivos del nuevo sprint.</p>${pendientesRetomar.map((item) => `<label class="check-row"><input type="checkbox" name="retomar" value="${item.id}" ${agenda.retomar.includes(item.id) ? "checked" : ""}><span>${escaparHtml(item.descripcion)}</span></label>`).join("")}` : ""}<div class="form-actions"><a class="button light" href="index.html">Volver al inicio</a><button class="button primary">Agendar sprint</button></div></form>`;
}
async function agendar() {
  const [actual, anterior] = await Promise.all([
    api("/sprints/actual"),
    api("/sprints/ultimo/acciones"),
  ]);
  if (actual.actual || actual.programado) {
    contenido.innerHTML =
      intro(
        "SIGUIENTE PASO",
        "Agendar nuevo sprint",
        "Define las fechas y los objetivos del próximo sprint.",
      ) +
      '<section class="card"><h2>Ya tienes un sprint abierto</h2><p>Finaliza su retrospectiva antes de agendar otro.</p><a class="text-link" href="sprint_actual.html">Ver sprint →</a></section>';
    return;
  }
  pendientesRetomar = anterior.acciones.filter(
    (item) => item.cumplida !== true,
  );
  agenda.retomar = agenda.retomar.filter((id) =>
    pendientesRetomar.some((item) => item.id === id),
  );
  renderAgenda();
}
function anadirObjetivo() {
  guardarAgenda();
  const objetivo = agenda.nuevo.trim();
  if (!objetivo || objetivo.length > 2000 || /[\r\n]/.test(objetivo))
    throw new Error(
      "Escribe un objetivo de hasta 2000 caracteres, en una sola línea.",
    );
  if (!agenda.objetivos.includes(objetivo)) {
    if (agenda.objetivos.length >= 100)
      throw new Error("Puedes añadir hasta 100 objetivos.");
    agenda.objetivos.push(objetivo);
  }
  agenda.nuevo = "";
  conservar("agenda", agenda);
  renderAgenda();
  document.querySelector("[name=nuevo]").focus();
}
function balance(d) {
  return (
    ["realizadas", "pendientes", "logros", "impedimentos"]
      .map(
        (campo, indice) =>
          `<h3>${["Lo que ya se realizó", "Lo que falta", "Logros", "Impedimentos"][indice]}</h3>${lista(d[campo])}`,
      )
      .join("") +
    `<details><summary>Comentarios y otros registros</summary>${otros(d.items.filter((item) => ["comentario", "otro"].includes(item.categoria)))}</details>`
  );
}
async function sprintActual() {
  const actual = await api("/sprints/actual");
  const id =
    parametros.get("id") || (actual.actual || actual.programado)?.sprint.id;
  if (!id) {
    contenido.innerHTML =
      intro(
        "DETALLE DEL EQUIPO",
        "Sprint actual",
        "Consulta toda la información y modifica los datos o registros del sprint.",
      ) +
      '<section class="card"><h2>Todavía no hay un sprint actual</h2><p>Agenda un sprint para consultar aquí sus detalles.</p><a class="text-link" href="agendar.html">Agendar nuevo sprint →</a></section>';
    return;
  }
  if (!/^[1-9]\d*$/.test(String(id)))
    throw new Error("El identificador del sprint no es válido.");
  const [datos, items] = await Promise.all([
    api("/sprints/" + id),
    api("/sprints/" + id + "/items"),
  ]);
  detalle = { ...datos, items };
  const s = datos.sprint;
  const iniciado = s.fecha_inicio <= estado.fecha_actual;
  contenido.innerHTML =
    intro(
      "DETALLE DEL EQUIPO",
      s.estado === "finalizado" ? "Detalle del sprint" : "Sprint actual",
      "Consulta toda la información y modifica los datos o registros del sprint.",
    ) +
    `<div class="detalle-grid"><section class="card"><h2>Datos del sprint</h2><p class="muted">${s.estado === "finalizado" ? "Finalizado" : iniciado ? "En curso" : "Programado"} · ${datos.realizadas.length} objetivos realizados y ${datos.pendientes.length} pendientes.</p><form id="sprint"><label>Nombre<input name="nombre" required maxlength="100" value="${escaparHtml(s.nombre)}" ${s.estado === "finalizado" ? "readonly" : ""}></label><label>Fecha de inicio<input type="date" name="fecha_inicio" required ${iniciado || s.estado === "finalizado" ? "readonly" : `min="${estado.fecha_actual}"`} max="9999-12-31" value="${s.fecha_inicio}"></label>${iniciado ? '<p class="muted">La fecha de inicio se conserva porque este sprint ya comenzó.</p>' : ""}<label>Fecha final y retrospectiva<input name="fecha_fin" type="date" min="${[estado.fecha_actual, s.fecha_inicio].sort().pop()}" max="9999-12-31" required value="${s.fecha_fin}" ${s.estado === "finalizado" ? "readonly" : ""}></label>${s.estado !== "finalizado" ? '<div class="form-actions"><button class="button primary">Guardar cambios</button></div>' : ""}</form>${iniciado && s.estado !== "finalizado" ? '<a class="text-link" href="retrospectiva.html">Iniciar retrospectiva →</a>' : ""}</section><section class="card"><h2>Objetivos y balance</h2>${balance(detalle)}${gestion(items)}<a class="text-link" href="editar_registro.html?sprint=${s.id}">Añadir registro →</a></section></div>`;
}
async function anteriores() {
  const [historial, sprints] = await Promise.all([
    api("/sprints/anteriores"),
    api("/sprints"),
  ]);
  const finalizados = new Set(
    sprints.filter((s) => s.estado === "finalizado").map((s) => s.id),
  );
  contenido.innerHTML =
    intro(
      "HISTORIAL DEL PROYECTO",
      "Sprints anteriores",
      "Consulta los resultados de cada retrospectiva finalizada.",
    ) +
    (historial.length
      ? historial
          .filter((d) => finalizados.has(d.sprint.id))
          .map(
            (d) =>
              `<section class="card history-card"><h2>${escaparHtml(d.sprint.nombre)}</h2><p class="muted">${fechas(d.sprint)} · Finalizado</p><h3>Lo que ya se realizó</h3>${lista(d.realizadas, "No hubo objetivos marcados como realizados.")}<h3>Lo que faltó</h3>${lista(d.pendientes, "No quedaron objetivos pendientes.")}<details><summary>Logros, impedimentos y acuerdos de la reunión</summary>${otros(d.items.filter((item) => item.categoria !== "accion"))}</details>${gestion(d.items)}<a class="text-link" href="sprint_actual.html?id=${d.sprint.id}">Ver detalle →</a></section>`,
          )
          .join("")
      : '<section class="card"><p>Todavía no hay sprints finalizados. Acá encontrarás sus resultados cuando completes la primera retrospectiva.</p></section>');
}
async function editarRegistro(eliminar = false) {
  const id = parametros.get("id");
  const sprint = parametros.get("sprint");
  if (
    (id && !/^[1-9]\d*$/.test(id)) ||
    (!id && (!sprint || !/^[1-9]\d*$/.test(sprint)))
  )
    throw new Error("El identificador del registro o sprint no es válido.");
  registro = id
    ? await api("/items/" + id)
    : {
        sprint_id: Number(sprint),
        categoria: "accion",
        descripcion: "",
        cumplida: false,
      };
  await api("/sprints/" + registro.sprint_id);
  const volver = `sprint_actual.html?id=${registro.sprint_id}`;
  if (eliminar) {
    contenido.innerHTML =
      intro(
        "GESTIÓN DE REGISTROS",
        "Eliminar registro",
        "Confirma si deseas eliminar este registro.",
      ) +
      `<form id="eliminar" class="card workflow"><p class="record-copy">${escaparHtml(registro.descripcion)}</p><p>Esta operación elimina el registro guardado.</p><div class="form-actions"><a class="button light" href="${volver}">Cancelar</a><button class="button primary">Eliminar registro</button></div></form>`;
    return;
  }
  contenido.innerHTML =
    intro(
      "GESTIÓN DE REGISTROS",
      id ? "Editar registro" : "Añadir registro",
      "Actualiza la categoría, descripción y estado del elemento.",
    ) +
    `<form id="registro" class="card workflow"><label>Categoría<select name="categoria">${Object.entries(
      categorias,
    )
      .map(
        ([valor, texto]) =>
          `<option value="${valor}" ${registro.categoria === valor ? "selected" : ""}>${texto}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Descripción<textarea name="descripcion" maxlength="2000" required rows="5">${escaparHtml(registro.descripcion)}</textarea></label><label id="estado-registro" ${registro.categoria !== "accion" ? "hidden" : ""}>Estado<select name="cumplida"><option value="false" ${registro.cumplida !== true ? "selected" : ""}>Pendiente</option><option value="true" ${registro.cumplida === true ? "selected" : ""}>Realizada</option></select></label><div class="form-actions"><a class="button light" href="${volver}">Cancelar</a><button class="button primary">Guardar cambios</button></div></form>`;
}
async function retrospectiva() {
  const actual = estado.bloquear_navegacion
    ? { actual: { sprint: { id: estado.sprint_actual_id } } }
    : await api("/sprints/actual");
  if (!actual.actual) {
    contenido.innerHTML =
      intro(
        "REUNIÓN DEL EQUIPO",
        "Retrospectiva del sprint",
        "Revisa los objetivos, registra lo ocurrido y finaliza la reunión.",
      ) +
      `<section class="card"><h2>No hay un sprint actual para revisar</h2><p>${actual.programado ? "El sprint agendado todavía no ha comenzado." : "Agenda un sprint y sus objetivos para empezar."}</p><a class="text-link" href="agendar.html">Agendar nuevo sprint →</a></section>`;
    return;
  }
  detalle = await api("/sprints/" + actual.actual.sprint.id + "/retrospectiva");
  const id = detalle.sprint.id;
  revision = leer("revision-" + id, {
    sprint_id: id,
    paso: 1,
    realizadas: detalle.realizadas.map((item) => item.id),
    adicionales: "",
    logros: "",
    impedimentos: "",
    comentarios: "",
    acuerdos: "",
  });
  const confirmada = leer("anticipada-" + id, false);
  if (detalle.control.requiere_confirmacion_anticipada && !confirmada) {
    contenido.innerHTML =
      intro(
        "REUNIÓN DEL EQUIPO",
        "Confirmar retrospectiva anticipada",
        "Revisa la fecha programada antes de continuar.",
      ) +
      `<section class="card workflow"><h2>${escaparHtml(detalle.sprint.nombre)}</h2><p>La retrospectiva está programada para el ${detalle.sprint.fecha_fin}. ¿Seguro que quieres realizarla ahora?</p><div class="form-actions"><a class="button light" href="index.html" data-cancelar-anticipada>No, volver al inicio</a><button class="button primary" data-accion="confirmar-anticipada">Sí, iniciar retrospectiva</button></div></section>`;
    return;
  }
  renderRevision();
}
function guardarRevision() {
  const form = document.querySelector("#revision");
  if (!form || !revision) return;
  if (revision.paso === 1) {
    revision.realizadas = [
      ...form.querySelectorAll("[name=realizadas]:checked"),
    ].map((c) => Number(c.value));
    revision.adicionales = form.elements.adicionales.value;
  }
  if (revision.paso === 2)
    for (const campo of ["logros", "impedimentos", "acuerdos", "comentarios"])
      revision[campo] = form.elements[campo].value;
  conservar("revision-" + revision.sprint_id, revision);
}
function renderRevision() {
  const acciones = detalle.items.filter((item) => item.categoria === "accion");
  let etapa;
  if (revision.paso === 1)
    etapa = `<h3>1. Revisar los objetivos del sprint</h3><p>Marca lo realizado. Los objetivos sin marcar quedarán pendientes.</p>${acciones.map((item) => `<label class="check-row"><input type="checkbox" name="realizadas" value="${item.id}" ${revision.realizadas.includes(item.id) ? "checked" : ""}><span>${escaparHtml(item.descripcion)}</span></label>`).join("")}<label>Otras tareas que ya se realizaron<textarea name="adicionales" rows="4" placeholder="Una tarea por línea">${escaparHtml(revision.adicionales)}</textarea></label>`;
  else if (revision.paso === 2)
    etapa =
      "<h3>2. Registrar el balance del equipo</h3>" +
      (detalle.logros.length || detalle.impedimentos.length
        ? `<details><summary>Ver lo registrado hasta ahora</summary>${otros([...detalle.logros, ...detalle.impedimentos])}</details>`
        : "") +
      Object.entries({
        logros: "¿Qué salió bien? Logros",
        impedimentos: "¿Qué dificultó el trabajo? Impedimentos",
        acuerdos: "Acciones o acuerdos de mejora para el próximo sprint",
        comentarios: "Comentarios adicionales",
      })
        .map(
          ([campo, titulo]) =>
            `<label>${titulo}<textarea name="${campo}" rows="4" placeholder="Un elemento por línea">${escaparHtml(revision[campo])}</textarea></label>`,
        )
        .join("") +
      '<p class="muted">Los acuerdos se guardarán como acciones pendientes y podrás retomarlos al agendar el siguiente sprint.</p>';
  else
    etapa =
      `<h3>3. Finalizar la retrospectiva</h3><p>${acciones.filter((item) => revision.realizadas.includes(item.id)).length} objetivos realizados y ${acciones.filter((item) => !revision.realizadas.includes(item.id)).length} pendientes.</p>` +
      Object.entries({
        adicionales: "Otras tareas realizadas",
        logros: "Logros",
        impedimentos: "Impedimentos",
        acuerdos: "Acuerdos de mejora pendientes",
        comentarios: "Comentarios",
      })
        .filter(([campo]) => revision[campo].trim())
        .map(
          ([campo, titulo]) =>
            `<h3>${titulo}</h3><p class="record-copy">${escaparHtml(revision[campo])}</p>`,
        )
        .join("") +
      "<p>Al finalizar, el sprint pasará al historial y podrás agendar el siguiente.</p>";
  contenido.innerHTML =
    (estado.bloquear_navegacion
      ? `<p class="alert">La retrospectiva estaba programada para el ${detalle.sprint.fecha_fin}. Debes finalizarla para volver al inicio, consultar el historial o agendar otro sprint.</p>`
      : "") +
    intro(
      "REUNIÓN DEL EQUIPO",
      "Retrospectiva del sprint",
      "Revisa los objetivos, registra lo ocurrido y finaliza la reunión.",
    ) +
    `<section class="card workflow"><h2>${escaparHtml(detalle.sprint.nombre)}</h2><p class="muted">${fechas(detalle.sprint)}</p><p class="notice">Los datos de las etapas se conservan temporalmente en este navegador. Se guardan en la base de datos al finalizar.</p><ol class="steps" aria-label="Etapas">${["Objetivos", "Balance", "Finalizar"].map((titulo, indice) => `<li ${revision.paso === indice + 1 ? 'aria-current="step"' : ""}>${indice + 1}. ${titulo}</li>`).join("")}</ol><form id="revision">${etapa}<div class="form-actions wizard-nav">${revision.paso > 1 ? '<button class="button light" type="button" data-accion="anterior">Anterior</button>' : ""}<button class="button primary" name="accion" value="${revision.paso < 3 ? "continuar" : "finalizar"}">${revision.paso < 3 ? "Continuar" : "Finalizar retrospectiva"}</button></div></form></section>`;
}
function lineas(texto) {
  if (texto.length > 50000) throw new Error("El texto es demasiado largo.");
  const valores = [
    ...new Set(
      texto
        .split(/\r\n|[\n\r\u0085\u2028\u2029]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  if (valores.length > 100 || valores.some((s) => s.length > 2000))
    throw new Error(
      "Escribe como máximo 100 elementos de hasta 2000 caracteres por sección.",
    );
  return valores;
}
function validarFechas(inicio, fin, permitirInicio = false) {
  const valido = (fecha) =>
    /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
    fecha >= "1000-01-01" &&
    fecha <= "9999-12-31" &&
    !Number.isNaN(Date.parse(fecha + "T12:00:00Z")) &&
    new Date(fecha + "T12:00:00Z").toISOString().slice(0, 10) === fecha;
  if (!valido(inicio) || !valido(fin))
    throw new Error("Revisa las fechas del sprint.");
  if (!permitirInicio && inicio < estado.fecha_actual)
    throw new Error(
      "La fecha de inicio no puede ser anterior a la fecha actual.",
    );
  if (fin < inicio || fin < estado.fecha_actual)
    throw new Error(
      "La fecha final no puede ser anterior al inicio ni a la fecha actual.",
    );
}
async function enviar(form, boton) {
  mensaje("");
  if (form.id === "agenda") {
    guardarAgenda();
    if (agenda.nuevo.trim()) anadirObjetivo();
    await actualizarEstado();
    validarFechas(agenda.fecha_inicio, agenda.fecha_fin);
    if (!agenda.objetivos.length && !agenda.retomar.length)
      throw new Error("Agrega al menos un objetivo para el nuevo sprint.");
    await api("/sprints", "POST", {
      nombre: agenda.nombre.trim(),
      fecha_inicio: agenda.fecha_inicio,
      fecha_fin: agenda.fecha_fin,
      objetivos: agenda.objetivos,
      retomar: agenda.retomar,
    });
    quitar("agenda");
    ir("index.html");
  } else if (form.id === "sprint") {
    const datos = Object.fromEntries(new FormData(form));
    await actualizarEstado();
    validarFechas(
      datos.fecha_inicio,
      datos.fecha_fin,
      detalle.sprint.fecha_inicio <= estado.fecha_actual &&
        datos.fecha_inicio === detalle.sprint.fecha_inicio,
    );
    await api("/sprints/" + detalle.sprint.id, "PUT", datos);
    await sprintActual();
    mensaje("Los datos del sprint se guardaron correctamente.", true);
  } else if (form.id === "registro") {
    const datos = Object.fromEntries(new FormData(form));
    datos.cumplida =
      datos.categoria === "accion" ? datos.cumplida === "true" : null;
    await api(
      registro.id
        ? "/items/" + registro.id
        : "/sprints/" + registro.sprint_id + "/items",
      registro.id ? "PUT" : "POST",
      datos,
    );
    quitar("revision-" + registro.sprint_id);
    ir("sprint_actual.html?id=" + registro.sprint_id);
  } else if (form.id === "eliminar") {
    await api("/items/" + registro.id, "DELETE");
    quitar("revision-" + registro.sprint_id);
    ir("sprint_actual.html?id=" + registro.sprint_id);
  } else if (form.id === "revision") {
    guardarRevision();
    for (const campo of [
      "adicionales",
      "logros",
      "impedimentos",
      "comentarios",
      "acuerdos",
    ])
      lineas(revision[campo]);
    if (revision.paso < 3) {
      revision.paso++;
      conservar("revision-" + revision.sprint_id, revision);
      renderRevision();
      return;
    }
    const datos = {
      realizadas: revision.realizadas,
      confirmar_anticipada: leer("anticipada-" + revision.sprint_id, false),
    };
    for (const campo of [
      "adicionales",
      "logros",
      "impedimentos",
      "comentarios",
      "acuerdos",
    ])
      datos[campo] = lineas(revision[campo]);
    try {
      await api(
        "/sprints/" + revision.sprint_id + "/retrospectiva/finalizar",
        "POST",
        datos,
      );
    } catch (error) {
      if (error.codigo === "CONFIRMACION_REQUERIDA") {
        quitar("anticipada-" + revision.sprint_id);
        await retrospectiva();
      }
      throw error;
    }
    quitar("revision-" + revision.sprint_id);
    quitar("anticipada-" + revision.sprint_id);
    ir("agendar.html?finalizado=1");
  }
}
document.addEventListener("submit", async (event) => {
  if (event.target.id === "configurar") return;
  event.preventDefault();
  if (ocupado) return;
  ocupado = true;
  const botones = [...event.target.querySelectorAll("button")];
  botones.forEach((b) => (b.disabled = true));
  try {
    await enviar(event.target, event.submitter);
  } catch (error) {
    errorMensaje(error);
  } finally {
    ocupado = false;
    botones.forEach((b) => (b.disabled = false));
  }
});
document.addEventListener("input", (event) => {
  if (event.target.closest("#agenda")) {
    guardarAgenda();
    if (event.target.name === "fecha_inicio")
      document.querySelector("[name=fecha_fin]").min = [
        estado.fecha_actual,
        event.target.value,
      ]
        .sort()
        .pop();
  }
  if (event.target.closest("#revision")) guardarRevision();
  if (event.target.closest("#sprint") && event.target.name === "fecha_inicio")
    document.querySelector("[name=fecha_fin]").min = [
      estado.fecha_actual,
      event.target.value,
    ]
      .sort()
      .pop();
});
document.addEventListener("change", (event) => {
  if (event.target.closest("#registro") && event.target.name === "categoria")
    document.querySelector("#estado-registro").hidden =
      event.target.value !== "accion";
});
document.addEventListener("click", async (event) => {
  const boton = event.target.closest(
    "[data-accion],[data-quitar],[data-global],[data-cancelar-anticipada]",
  );
  if (!boton || ocupado) return;
  try {
    mensaje("");
    if (boton.dataset.accion === "anadir") anadirObjetivo();
    if (boton.hasAttribute("data-quitar")) {
      guardarAgenda();
      agenda.objetivos.splice(Number(boton.dataset.quitar), 1);
      conservar("agenda", agenda);
      renderAgenda();
    }
    if (boton.dataset.accion === "confirmar-anticipada") {
      conservar("anticipada-" + detalle.sprint.id, true);
      renderRevision();
    }
    if (boton.hasAttribute("data-cancelar-anticipada"))
      quitar("anticipada-" + detalle.sprint.id);
    if (boton.dataset.accion === "anterior") {
      guardarRevision();
      revision.paso = Math.max(1, revision.paso - 1);
      conservar("revision-" + revision.sprint_id, revision);
      renderRevision();
    }
    if (boton.dataset.global && !boton.dataset.cargado) {
      const global = await api("/proyecto/resumen?limite=0");
      document.querySelector("#global-" + boton.dataset.global).innerHTML =
        lista(global[boton.dataset.global].items.slice(3));
      boton.dataset.cargado = "true";
    }
  } catch (error) {
    errorMensaje(error);
  }
});
document.querySelector("#conexion").addEventListener("click", () => {
  document.querySelector("#configurar").elements.url.value = API;
  document.querySelector("#configuracion").showModal();
});
document
  .querySelector("#cerrar-configuracion")
  .addEventListener("click", () =>
    document.querySelector("#configuracion").close(),
  );
document.querySelector("#configurar").addEventListener("submit", (event) => {
  event.preventDefault();
  const url = new URL(event.target.elements.url.value);
  if (!["http:", "https:"].includes(url.protocol)) return;
  localStorage.setItem("retrospectivas_api", url.href.replace(/\/+$/, ""));
  location.reload();
});
async function iniciar() {
  try {
    await api("/salud");
    await actualizarEstado();
    document.querySelector("#estado-conexion").textContent =
      " · API y base de datos conectadas";
    const paginas = {
      index: inicio,
      agendar,
      sprint_actual: sprintActual,
      anteriores,
      retrospectiva,
      editar_registro: () => editarRegistro(),
      eliminar_registro: () => editarRegistro(true),
    };
    if (!paginas[pagina]) throw new Error("La página solicitada no existe.");
    await paginas[pagina]();
  } catch (error) {
    errorMensaje(error);
    contenido.querySelector("p.muted")?.remove();
    document.querySelector(".app-footer").hidden = false;
  }
}
setInterval(async () => {
  if (ocupado || document.hidden || !estado) return;
  try {
    const previa = ultimaFecha;
    await actualizarEstado();
    if (previa !== ultimaFecha)
      for (const input of document.querySelectorAll(
        "input[type=date]:not([readonly])",
      ))
        input.min = estado.fecha_actual;
  } catch (error) {
    if (error.name === "AbortError") return;
  }
}, 60000);
iniciar();
