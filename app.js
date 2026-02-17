import {
  loadData,
  saveData,
  exportData,
  importData,
  generateId
} from "./storage/repository.js";
import { buildProjectSummary } from "./services/projectService.js";
import { evalExpr } from "./domain/calc.js";

let data = loadData();
let currentProject = createEmptyProject();
let currentTemplateId = null;
let editingBoardId = null;
let editingEdgebandId = null;
let editingAccessoryId = null;
let boardSizeChoices = {};
let templateDraft = createEmptyTemplate();
let allowRotate = data.settings.allowRotate !== false;
let projectFilters = {
  search: "",
  status: ""
};

const PROJECT_STATUSES = [
  { id: "nuevo", label: "Nuevo proyecto" },
  { id: "presupuesto", label: "Presupuesto" },
  { id: "armado", label: "En proceso de armado" },
  { id: "terminado", label: "Terminado" },
  { id: "entregado", label: "Entregado" }
];

const navButtons = document.querySelectorAll(".nav-btn");
const views = document.querySelectorAll(".view");

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    setActiveView(btn.dataset.view);
  });
});

const tabs = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

tabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabs.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    tabPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.id === `tab-${tab}`);
    });
  });
});

const el = (selector) => document.querySelector(selector);
const elAll = (selector) => Array.from(document.querySelectorAll(selector));

function ensureProjectStatus(project) {
  if (!PROJECT_STATUSES.some((status) => status.id === project.status)) {
    project.status = "nuevo";
    return true;
  }
  return false;
}

let statusUpdated = false;
data.projects.forEach((project) => {
  if (ensureProjectStatus(project)) statusUpdated = true;
});
if (statusUpdated) saveData(data);

function createEmptyProject() {
  return {
    id: generateId("proj"),
    name: "",
    client: "",
    contact: "",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
    items: [],
    manualAccessories: [],
    status: "nuevo"
  };
}

function createEmptyTemplate() {
  return {
    id: generateId("tpl"),
    name: "",
    params: {
      ANCHO: 600,
      ALTO: 720,
      PROF: 560,
      ESPESOR: 18,
      HOLGURA: 2
    },
    pieces: [],
    accessoriesRules: []
  };
}

function formatCurrency(value) {
  return `$${value.toFixed(2)}`;
}

function formatNumber(value, decimals = 2) {
  return Number(value || 0).toFixed(decimals);
}

function formatEdges(edges) {
  if (!edges) return "Sin canto";
  const labels = [];
  if (edges.l1) labels.push("L1");
  if (edges.l2) labels.push("L2");
  if (edges.w1) labels.push("C1");
  if (edges.w2) labels.push("C2");
  return labels.length ? labels.join(" ") : "Sin canto";
}

function showToast(message, type = "ok") {
  const root = el("#toast-root");
  if (!root) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`.trim();
  toast.textContent = message;
  root.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2600);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asPositiveInt(value) {
  const parsed = Math.round(toNumber(value, 0));
  return parsed > 0 ? parsed : 0;
}

function buildSummary() {
  return buildProjectSummary(currentProject, data, {
    boardSizeById: boardSizeChoices,
    allowRotate
  });
}

function totalPiecesQty(pieces) {
  return pieces.reduce((acc, piece) => acc + toNumber(piece.qty, 0), 0);
}

function collectProjectAlerts(summary) {
  const alerts = [];
  if (!currentProject.name.trim()) {
    alerts.push({
      type: "warn",
      text: "Conviene definir un nombre para identificar el presupuesto."
    });
  }
  if (!currentProject.client.trim()) {
    alerts.push({
      type: "warn",
      text: "Falta el nombre del cliente para exportar un presupuesto completo."
    });
  }
  if (summary.pieces.length === 0) {
    alerts.push({
      type: "warn",
      text: "No hay piezas cargadas. Agrega una plantilla o una pieza manual."
    });
  }
  const invalidPieces = summary.pieces.filter(
    (piece) => piece.length <= 0 || piece.width <= 0 || piece.qty <= 0
  );
  if (invalidPieces.length) {
    alerts.push({
      type: "error",
      text: `${invalidPieces.length} pieza(s) tienen medidas/cantidad invalida por expresiones o carga manual.`
    });
  }
  const missingMaterial = summary.pieces.filter(
    (piece) => !data.catalogs.boards.some((board) => board.id === piece.materialId)
  );
  if (missingMaterial.length) {
    alerts.push({
      type: "error",
      text: `${missingMaterial.length} pieza(s) no tienen material valido asignado en el catalogo.`
    });
  }
  if (summary.unplaced.count > 0) {
    alerts.push({
      type: "error",
      text: `${summary.unplaced.count} pieza(s) no entran en la placa seleccionada. Ajusta medidas o cambia tamano de placa.`
    });
  }
  return alerts;
}

function renderProjectInsights(summary) {
  const container = el("#project-insights");
  if (!container) return;
  container.innerHTML = "";
  if (!summary) return;
  const cards = [
    { label: "Modulos", value: formatNumber(summary.moduleCount, 0) },
    { label: "Piezas", value: formatNumber(totalPiecesQty(summary.pieces), 0) },
    { label: "Area total", value: `${formatNumber(summary.totalAreaM2)} m2` },
    { label: "Costo total", value: formatCurrency(summary.costs.total) }
  ];
  cards.forEach((card) => {
    const node = document.createElement("div");
    node.className = "kpi-card";
    node.innerHTML = `
      <div class="kpi-label">${card.label}</div>
      <div class="kpi-value">${card.value}</div>
    `;
    container.appendChild(node);
  });
}

function renderProjectAlerts(summary) {
  const container = el("#project-alerts");
  if (!container) return;
  const alerts = collectProjectAlerts(summary);
  if (!alerts.length) {
    container.innerHTML = "";
    return;
  }
  const list = document.createElement("div");
  list.className = "alert-list";
  alerts.forEach((entry) => {
    const item = document.createElement("div");
    item.className = `alert-item ${entry.type === "error" ? "error" : ""}`.trim();
    item.textContent = entry.text;
    list.appendChild(item);
  });
  container.innerHTML = "";
  container.appendChild(list);
}

function fillProjectsStatusFilter() {
  const select = el("#projects-status-filter");
  if (!select) return;
  select.innerHTML = `<option value="">Todos</option>${PROJECT_STATUSES.map(
    (status) => `<option value="${status.id}">${status.label}</option>`
  ).join("")}`;
}

function applySettingsPreset(preset) {
  if (preset === "basic") {
    data.settings.kerf = 3;
    data.settings.marginPct = 25;
    data.settings.laborMode = "hour";
    data.settings.laborRatePerHour = 12;
    data.settings.laborTimePerPieceMin = 8;
    data.settings.laborTimePerModuleMin = 25;
    data.settings.laborRatePerM2 = 4;
  }
  if (preset === "fast") {
    data.settings.kerf = 2.5;
    data.settings.marginPct = 18;
    data.settings.laborMode = "m2";
    data.settings.laborRatePerM2 = 6;
    data.settings.laborRatePerHour = 14;
    data.settings.laborTimePerPieceMin = 5;
    data.settings.laborTimePerModuleMin = 15;
  }
  saveData(data);
  fillSettingsForm();
  renderProjectView();
}

function parseBoardSizes(rawValue) {
  return String(rawValue || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [width, height] = entry.split("x").map((n) => Number(n.trim()));
      return { width, height, raw: entry };
    });
}

function updateBoardSizesHint() {
  const hint = el("#board-sizes-hint");
  if (!hint) return;
  const sizes = parseBoardSizes(el("#board-sizes").value);
  const valid = sizes.filter((size) => size.width > 0 && size.height > 0);
  if (!sizes.length) {
    hint.textContent = "Si no cargas tamanos, se usara 2750x1830 por defecto.";
    return;
  }
  const invalidCount = sizes.length - valid.length;
  hint.textContent = invalidCount
    ? `${valid.length} tamano(s) valido(s), ${invalidCount} invalido(s). Formato: ANCHOxALTO en mm.`
    : `${valid.length} tamano(s) validado(s).`;
}

function resetBoardForm() {
  editingBoardId = null;
  el("#board-name").value = "";
  el("#board-thickness").value = "";
  el("#board-cost").value = "";
  el("#board-waste").value = "";
  el("#board-sizes").value = "";
  updateBoardSizesHint();
}

function resetEdgebandForm() {
  editingEdgebandId = null;
  el("#edgeband-name").value = "";
  el("#edgeband-width").value = "";
  el("#edgeband-cost").value = "";
  el("#edgeband-waste").value = "";
}

function resetAccessoryForm() {
  editingAccessoryId = null;
  el("#acc-name").value = "";
  el("#acc-unit").value = "";
  el("#acc-cost").value = "";
}

function getBoardUsage(boardId) {
  const templateCount = data.templates.reduce(
    (acc, tpl) => acc + tpl.pieces.filter((piece) => piece.materialId === boardId).length,
    0
  );
  const projectManualCount = data.projects.reduce((acc, project) => {
    const items = project.items || [];
    return (
      acc +
      items.filter((item) => item.type === "piece" && item.piece?.materialId === boardId).length
    );
  }, 0);
  return templateCount + projectManualCount;
}

function getEdgebandUsage(edgeId) {
  const templateCount = data.templates.reduce(
    (acc, tpl) => acc + tpl.pieces.filter((piece) => piece.edgeBandId === edgeId).length,
    0
  );
  const projectManualCount = data.projects.reduce((acc, project) => {
    const items = project.items || [];
    return (
      acc +
      items.filter((item) => item.type === "piece" && item.piece?.edgeBandId === edgeId).length
    );
  }, 0);
  return templateCount + projectManualCount;
}

function getAccessoryUsage(accessoryId) {
  const templateCount = data.templates.reduce(
    (acc, tpl) =>
      acc + tpl.accessoriesRules.filter((rule) => rule.accessoryId === accessoryId).length,
    0
  );
  const projectManualCount = data.projects.reduce((acc, project) => {
    const items = project.manualAccessories || [];
    return acc + items.filter((entry) => entry.accessoryId === accessoryId).length;
  }, 0);
  return templateCount + projectManualCount;
}

function refreshCatalogFormState() {
  const boardState = el("#board-form-state");
  const boardBtn = el("#btn-add-board");
  if (boardState && boardBtn) {
    if (editingBoardId && !data.catalogs.boards.some((entry) => entry.id === editingBoardId)) {
      editingBoardId = null;
    }
    if (editingBoardId) {
      const board = data.catalogs.boards.find((entry) => entry.id === editingBoardId);
      boardState.textContent = `Editando placa: ${board?.name || editingBoardId}`;
      boardBtn.textContent = "Actualizar placa";
    } else {
      boardState.textContent = "Nueva placa";
      boardBtn.textContent = "Guardar placa";
    }
  }

  const edgeState = el("#edgeband-form-state");
  const edgeBtn = el("#btn-add-edgeband");
  if (edgeState && edgeBtn) {
    if (
      editingEdgebandId &&
      !data.catalogs.edgebands.some((entry) => entry.id === editingEdgebandId)
    ) {
      editingEdgebandId = null;
    }
    if (editingEdgebandId) {
      const edge = data.catalogs.edgebands.find((entry) => entry.id === editingEdgebandId);
      edgeState.textContent = `Editando tapacanto: ${edge?.name || editingEdgebandId}`;
      edgeBtn.textContent = "Actualizar tapacanto";
    } else {
      edgeState.textContent = "Nuevo tapacanto";
      edgeBtn.textContent = "Guardar tapacanto";
    }
  }

  const accessoryState = el("#accessory-form-state");
  const accessoryBtn = el("#btn-add-accessory");
  if (accessoryState && accessoryBtn) {
    if (
      editingAccessoryId &&
      !data.catalogs.accessories.some((entry) => entry.id === editingAccessoryId)
    ) {
      editingAccessoryId = null;
    }
    if (editingAccessoryId) {
      const acc = data.catalogs.accessories.find((entry) => entry.id === editingAccessoryId);
      accessoryState.textContent = `Editando accesorio: ${acc?.name || editingAccessoryId}`;
      accessoryBtn.textContent = "Actualizar accesorio";
    } else {
      accessoryState.textContent = "Nuevo accesorio";
      accessoryBtn.textContent = "Guardar accesorio";
    }
  }
}

function updateProjectFromForm() {
  currentProject.name = el("#proj-name").value.trim();
  currentProject.client = el("#proj-client").value.trim();
  currentProject.contact = el("#proj-contact").value.trim();
  currentProject.date = el("#proj-date").value;
  currentProject.notes = el("#proj-notes").value.trim();
  autoSaveCurrentProject();
}

function hasProjectContent(project) {
  return Boolean(
    (project.name && project.name.trim()) ||
      (project.client && project.client.trim()) ||
      (project.contact && project.contact.trim()) ||
      (project.notes && project.notes.trim()) ||
      (project.items && project.items.length) ||
      (project.manualAccessories && project.manualAccessories.length)
  );
}

function saveCurrentProject({ force = false, silent = false } = {}) {
  const index = data.projects.findIndex((p) => p.id === currentProject.id);
  if (index < 0 && !force && !hasProjectContent(currentProject)) {
    return false;
  }
  if (index >= 0) {
    data.projects[index] = structuredClone(currentProject);
  } else {
    data.projects.push(structuredClone(currentProject));
  }
  saveData(data);
  if (!silent) {
    renderProjectsList();
  }
  return true;
}

function autoSaveCurrentProject() {
  saveCurrentProject({ force: false, silent: true });
}

function handleProjectBoardClick(event) {
  const btn = event.target.closest("button");
  if (!btn) return;
  const id = btn.dataset.id;
  if (!id) return;
  if (btn.dataset.action === "edit") {
    const project = data.projects.find((p) => p.id === id);
    if (project) {
      currentProject = structuredClone(project);
      currentProject.manualAccessories = currentProject.manualAccessories || [];
      setActiveView("project");
    }
    return;
  }
  if (btn.dataset.action === "duplicate") {
    const project = data.projects.find((p) => p.id === id);
    if (!project) return;
    const copy = structuredClone(project);
    copy.id = generateId("proj");
    copy.name = `${project.name || "Proyecto"} (copia)`;
    copy.date = new Date().toISOString().slice(0, 10);
    data.projects.push(copy);
    saveData(data);
    showToast("Proyecto duplicado");
    renderProjectsList();
    return;
  }
  if (btn.dataset.action === "delete") {
    if (!confirm("Eliminar proyecto?")) return;
    data.projects = data.projects.filter((p) => p.id !== id);
    saveData(data);
    showToast("Proyecto eliminado");
    renderProjectsList();
  }
}

["#proj-name", "#proj-client", "#proj-contact", "#proj-date", "#proj-notes"].forEach(
  (selector) => {
    el(selector).addEventListener("input", updateProjectFromForm);
    el(selector).addEventListener("change", updateProjectFromForm);
  }
);

function renderProjectsList() {
  const board = el("#projects-board");
  if (!board) return;
  board.innerHTML = "";

  let needsSave = false;
  const statusCounts = {};
  PROJECT_STATUSES.forEach((status) => {
    statusCounts[status.id] = 0;
  });
  data.projects.forEach((project) => {
    if (ensureProjectStatus(project)) needsSave = true;
  });
  if (needsSave) saveData(data);

  const search = projectFilters.search.trim().toLowerCase();
  const activeStatus = projectFilters.status;
  const visibleProjects = data.projects.filter((project) => {
    const statusMatch = !activeStatus || project.status === activeStatus;
    if (!statusMatch) return false;
    if (!search) return true;
    const haystack = [project.name, project.client, project.contact].join(" ").toLowerCase();
    return haystack.includes(search);
  });
  visibleProjects.forEach((project) => {
    statusCounts[project.status] = (statusCounts[project.status] || 0) + 1;
  });

  PROJECT_STATUSES.forEach((status) => {
    const column = document.createElement("div");
    column.className = "kanban-column";
    column.dataset.status = status.id;
    const count = statusCounts[status.id] || 0;
    column.innerHTML = `
      <div class="kanban-header">
        <h3>${status.label}</h3>
        <span class="badge">${count}</span>
      </div>
      <div class="kanban-dropzone" data-status="${status.id}"></div>
    `;
    board.appendChild(column);
  });

  if (data.projects.length === 0) {
    const empty = document.createElement("div");
    empty.className = "kanban-empty";
    empty.innerHTML = "<p class=\"muted\">Sin proyectos guardados.</p>";
    board.prepend(empty);
  } else if (visibleProjects.length === 0) {
    const empty = document.createElement("div");
    empty.className = "kanban-empty";
    empty.innerHTML = "<p class=\"muted\">No hay proyectos que coincidan con el filtro.</p>";
    board.prepend(empty);
  }

  const zoneByStatus = new Map(
    Array.from(board.querySelectorAll(".kanban-dropzone")).map((zone) => [
      zone.dataset.status,
      zone
    ])
  );

  visibleProjects.forEach((project) => {
    const zone = zoneByStatus.get(project.status) || zoneByStatus.get("nuevo");
    if (!zone) return;
    const itemsCount =
      (project.items ? project.items.length : 0) +
      (project.manualAccessories ? project.manualAccessories.length : 0);
    const card = document.createElement("div");
    card.className = "kanban-card";
    card.draggable = true;
    card.dataset.id = project.id;
    card.innerHTML = `
      <div class="kanban-card-title">${project.name || "Proyecto sin nombre"}</div>
      <div class="kanban-card-meta">${project.client || "Sin cliente"}${
        project.date ? ` · ${project.date}` : ""
      }</div>
      <div class="kanban-card-meta">${itemsCount} items</div>
      <div class="kanban-card-actions">
        <button data-action="edit" data-id="${project.id}" class="ghost">Editar</button>
        <button data-action="duplicate" data-id="${project.id}" class="ghost">Duplicar</button>
        <button data-action="delete" data-id="${project.id}" class="ghost">Eliminar</button>
      </div>
    `;
    card.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", project.id);
      event.dataTransfer.effectAllowed = "move";
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
    });
    zone.appendChild(card);
  });

  board.querySelectorAll(".kanban-dropzone").forEach((zone) => {
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.classList.add("over");
    });
    zone.addEventListener("dragleave", () => {
      zone.classList.remove("over");
    });
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("over");
      const id = event.dataTransfer.getData("text/plain");
      if (!id) return;
      const project = data.projects.find((p) => p.id === id);
      if (!project) return;
      project.status = zone.dataset.status || "nuevo";
      saveData(data);
      showToast("Estado actualizado");
      renderProjectsList();
    });
  });
}

function setActiveView(name) {
  navButtons.forEach((b) => {
    const active = b.dataset.view === name;
    b.classList.toggle("active", active);
  });
  views.forEach((view) => {
    view.classList.toggle("active", view.id === `view-${name}`);
  });
  if (name === "project") {
    renderProjectView();
  }
  if (name === "projects") {
    renderProjectsList();
  }
  if (name === "templates") {
    renderTemplatesList();
    renderTemplateEditor();
  }
  if (name === "catalogs") {
    renderCatalogs();
  }
  if (name === "settings") {
    fillSettingsForm();
  }
}

function renderProjectItems() {
  const container = el("#project-items");
  container.innerHTML = "";
  if (currentProject.items.length === 0) {
    container.innerHTML = "<p class=\"muted\">Agrega plantillas o piezas manuales.</p>";
    return;
  }
  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Tipo</th>
        <th>Detalle</th>
        <th>Cant.</th>
        <th></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");
  currentProject.items.forEach((item) => {
    const row = document.createElement("tr");
    if (item.type === "template") {
      const template = data.templates.find((t) => t.id === item.templateId);
      row.innerHTML = `
        <td>Plantilla</td>
        <td>${template ? template.name : "Plantilla"}</td>
        <td>${item.qty}</td>
        <td><button data-id="${item.id}" class="ghost">Quitar</button></td>
      `;
    } else {
      row.innerHTML = `
        <td>Pieza</td>
        <td>${item.piece.name} ${item.piece.length}x${item.piece.width}mm</td>
        <td>${item.piece.qty}</td>
        <td><button data-id="${item.id}" class="ghost">Quitar</button></td>
      `;
    }
    tbody.appendChild(row);
  });
  container.appendChild(table);

  tbody.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.id;
    currentProject.items = currentProject.items.filter((item) => item.id !== id);
    showToast("Item quitado");
    renderProjectView();
  });
}

function renderManualAccessories() {
  const container = el("#project-manual-accessories");
  container.innerHTML = "";
  if (!currentProject.manualAccessories || currentProject.manualAccessories.length === 0) {
    container.innerHTML = "<p class=\"muted\">Sin accesorios manuales.</p>";
    return;
  }
  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Accesorio manual</th>
        <th>Cant.</th>
        <th>Notas</th>
        <th></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");
  currentProject.manualAccessories.forEach((entry) => {
    const accessory = data.catalogs.accessories.find((a) => a.id === entry.accessoryId);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${accessory ? accessory.name : "Accesorio"}</td>
      <td>${entry.qty}</td>
      <td>${entry.notes || ""}</td>
      <td><button data-id="${entry.id}" class="ghost">Quitar</button></td>
    `;
    tbody.appendChild(row);
  });
  container.appendChild(table);

  tbody.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.id;
    currentProject.manualAccessories = currentProject.manualAccessories.filter(
      (item) => item.id !== id
    );
    showToast("Accesorio quitado");
    renderProjectView();
  });
}

function renderCutList(summary) {
  const container = el("#cut-list");
  container.innerHTML = "";
  if (!summary || summary.pieces.length === 0) {
    container.innerHTML = "<p class=\"muted\">Sin piezas.</p>";
    return;
  }
  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Pieza</th>
        <th>Material</th>
        <th>Espesor</th>
        <th>Largo</th>
        <th>Ancho</th>
        <th>Cant.</th>
        <th>Canto</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");
  summary.pieces.forEach((piece) => {
    const board = data.catalogs.boards.find((b) => b.id === piece.materialId);
    const band = data.catalogs.edgebands.find((e) => e.id === piece.edgeBandId);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${piece.name}</td>
      <td>${board ? board.name : "-"}</td>
      <td>${piece.thickness}mm</td>
      <td>${formatNumber(piece.length, 0)}mm</td>
      <td>${formatNumber(piece.width, 0)}mm</td>
      <td>${piece.qty}</td>
      <td>${band ? band.name : "Sin tapacanto"} (${formatEdges(piece.edges)})</td>
    `;
    tbody.appendChild(row);
  });
  container.appendChild(table);
}

function renderEdgebands(summary) {
  const container = el("#edgeband-totals");
  container.innerHTML = "";
  if (!summary || summary.edgebands.length === 0) {
    container.innerHTML = "<p class=\"muted\">Sin tapacanto.</p>";
    return;
  }
  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Tipo</th>
        <th>Ancho</th>
        <th>Metros</th>
        <th>Costo</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");
  summary.edgebands.forEach((band) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${band.name}</td>
      <td>${band.width}mm</td>
      <td>${formatNumber(band.meters)}</td>
      <td>${formatCurrency(band.cost)}</td>
    `;
    tbody.appendChild(row);
  });
  container.appendChild(table);
}

function renderAccessories(summary) {
  const container = el("#accessory-totals");
  container.innerHTML = "";
  if (!summary || summary.accessories.summary.length === 0) {
    container.innerHTML = "<p class=\"muted\">Sin accesorios.</p>";
    return;
  }
  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Accesorio</th>
        <th>Unidad</th>
        <th>Cant.</th>
        <th>Costo</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");
  summary.accessories.summary.forEach((acc) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${acc.name}</td>
      <td>${acc.unit}</td>
      <td>${formatNumber(acc.qty, 2)}</td>
      <td>${formatCurrency(acc.cost)}</td>
    `;
    tbody.appendChild(row);
  });
  container.appendChild(table);
}

function renderCostSummary(summary) {
  const container = el("#cost-summary");
  container.innerHTML = "";
  if (!summary) return;
  const marginValue = summary.costs.total - summary.costs.subtotal;
  const laborLabel =
    summary.costs.labor.mode === "m2"
      ? `${formatNumber(summary.costs.labor.units)} m2`
      : `${formatNumber(summary.costs.labor.units)} horas`;
  container.innerHTML = `
    <div class="list">
      <div class="list-item"><strong>Placas</strong><span>${formatCurrency(summary.costs.boards)}</span></div>
      <div class="list-item"><strong>Tapacanto</strong><span>${formatCurrency(summary.costs.edgebands)}</span></div>
      <div class="list-item"><strong>Accesorios</strong><span>${formatCurrency(summary.costs.accessories)}</span></div>
      <div class="list-item"><strong>Mano de obra (${laborLabel})</strong><span>${formatCurrency(summary.costs.labor.cost)}</span></div>
      <div class="list-item"><strong>Subtotal</strong><span>${formatCurrency(summary.costs.subtotal)}</span></div>
      <div class="list-item"><strong>Margen (${formatNumber(data.settings.marginPct, 1)}%)</strong><span>${formatCurrency(marginValue)}</span></div>
      <div class="list-item"><strong>Total</strong><span>${formatCurrency(summary.costs.total)}</span></div>
    </div>
  `;
}

function renderNesting(summary) {
  const container = el("#nesting-view");
  container.innerHTML = "";
  if (!summary || summary.nesting.length === 0) {
    if (summary && summary.unplaced.count > 0) {
      container.innerHTML =
        "<p class=\"muted\">Hay piezas cargadas, pero no entran en ninguna placa seleccionada.</p>";
    } else {
      container.innerHTML = "<p class=\"muted\">Sin piezas para optimizar.</p>";
    }
    return;
  }

  summary.nesting.forEach((entry) => {
    const wrapper = document.createElement("div");
    wrapper.className = "svg-board";
    const options = entry.board.sizes
      .map((size, idx) => {
        const label = `${size.width}x${size.height}mm`;
        const selected = boardSizeChoices[entry.board.id] === idx ? "selected" : "";
        return `<option value="${idx}" ${selected}>${label}</option>`;
      })
      .join("");

    wrapper.innerHTML = `
      <div class="card-header">
        <div>
          <strong>${entry.board.name}</strong>
          <span class="badge">${entry.purchaseBoards} placas compra</span>
          <span class="badge">${entry.result.totalBoards} placas optimizadas</span>
          ${
            entry.result.unplacedCount
              ? `<span class="badge">${entry.result.unplacedCount} sin ubicar</span>`
              : ""
          }
        </div>
        <label>
          Tamano
          <select data-board="${entry.board.id}" class="nesting-size">
            ${options}
          </select>
        </label>
      </div>
    `;

    entry.result.boards.forEach((boardLayout, index) => {
      const svg = createBoardSvg(boardLayout, entry.size, index + 1);
      wrapper.appendChild(svg);
    });
    if (entry.result.unplacedPieces.length) {
      const warning = document.createElement("div");
      warning.className = "alert-item error";
      warning.textContent = `Sin ubicar: ${entry.result.unplacedPieces
        .map((piece) => `${piece.name} ${formatNumber(piece.length, 0)}x${formatNumber(piece.width, 0)} (${piece.qty})`)
        .join(", ")}`;
      wrapper.appendChild(warning);
    }

    container.appendChild(wrapper);
  });

  container.querySelectorAll(".nesting-size").forEach((select) => {
    select.addEventListener("change", (event) => {
      boardSizeChoices[event.target.dataset.board] = Number(event.target.value);
      renderProjectView();
    });
  });
}

function createBoardSvg(boardLayout, size, index) {
  const scale = 300 / size.width;
  const svg = document.createElement("div");
  const viewWidth = size.width * scale;
  const viewHeight = size.height * scale;
  const shapes = boardLayout.placements
    .map((p, idx) => {
      const color = pickColor(p.name, idx);
      return `<rect x="${p.x * scale}" y="${p.y * scale}" width="${p.width * scale}" height="${p.height * scale}" fill="${color}" fill-opacity="0.6" stroke="#5d5148" stroke-width="1" />`;
    })
    .join("");
  svg.innerHTML = `
    <div class="muted">Placa ${index} - desperdicio ${formatNumber(boardLayout.wastePct, 1)}%</div>
    <svg width="${viewWidth}" height="${viewHeight}" viewBox="0 0 ${viewWidth} ${viewHeight}">
      <rect width="${viewWidth}" height="${viewHeight}" fill="#fffaf3" stroke="#a88f7c" stroke-width="2"></rect>
      ${shapes}
    </svg>
  `;
  return svg;
}

function pickColor(seed, index) {
  const colors = ["#f0b07b", "#f4d09b", "#c0d8c8", "#f6c7b6", "#d3c1ea"];
  const hash = seed ? seed.length : index;
  return colors[hash % colors.length];
}

function renderProjectView() {
  currentProject.manualAccessories = currentProject.manualAccessories || [];
  el("#proj-name").value = currentProject.name;
  el("#proj-client").value = currentProject.client;
  el("#proj-contact").value = currentProject.contact;
  el("#proj-date").value = currentProject.date;
  el("#proj-notes").value = currentProject.notes;
  const rotateInput = el("#nest-allow-rotate");
  if (rotateInput) {
    rotateInput.checked = allowRotate;
  }

  renderProjectItems();
  renderManualAccessories();
  renderTemplateSelector();
  renderManualSelectors();

  updateProjectFromForm();
  const summary = buildSummary();
  renderProjectInsights(summary);
  renderProjectAlerts(summary);
  renderCutList(summary);
  renderEdgebands(summary);
  renderAccessories(summary);
  renderCostSummary(summary);
  renderNesting(summary);
}

function renderTemplateSelector() {
  const select = el("#tpl-select");
  if (!select) return;
  if (!data.templates.length) {
    select.innerHTML = `<option value="">Sin plantillas</option>`;
    renderTemplateParams(null);
    return;
  }
  select.innerHTML = data.templates
    .map((tpl) => `<option value="${tpl.id}">${tpl.name}</option>`)
    .join("");
  const selected = data.templates.find((t) => t.id === select.value) || data.templates[0];
  if (selected) {
    select.value = selected.id;
  }
  renderTemplateParams(selected);
  select.onchange = () => {
    const template = data.templates.find((t) => t.id === select.value);
    renderTemplateParams(template);
  };
}

function renderTemplateParams(template) {
  const container = el("#tpl-params");
  container.innerHTML = "";
  if (!template) return;
  const entries = template.visibleParams
    ? template.visibleParams
        .map((key) => [key, template.params[key]])
        .filter(([, value]) => value !== undefined)
    : Object.entries(template.params);
  entries.forEach(([key, value]) => {
    const label = document.createElement("label");
    label.textContent = key;
    const input = document.createElement("input");
    input.type = "number";
    input.value = value;
    input.dataset.param = key;
    label.appendChild(input);
    container.appendChild(label);
  });
}

function renderManualSelectors() {
  const materialSelect = el("#manual-material");
  const edgebandSelect = el("#manual-edgeband");
  const accessorySelect = el("#manual-accessory");
  const prevMaterial = materialSelect.value;
  const prevEdgeband = edgebandSelect.value;
  const prevAccessory = accessorySelect.value;
  materialSelect.innerHTML = data.catalogs.boards
    .map((b) => `<option value="${b.id}">${b.name}</option>`)
    .join("");
  edgebandSelect.innerHTML =
    `<option value="">Sin tapacanto</option>` +
    data.catalogs.edgebands
      .map((e) => `<option value="${e.id}">${e.name}</option>`)
      .join("");
  accessorySelect.innerHTML = data.catalogs.accessories
    .map((a) => `<option value="${a.id}">${a.name}</option>`)
    .join("");
  if (data.catalogs.boards.some((board) => board.id === prevMaterial)) {
    materialSelect.value = prevMaterial;
  }
  if (
    prevEdgeband === "" ||
    data.catalogs.edgebands.some((edge) => edge.id === prevEdgeband)
  ) {
    edgebandSelect.value = prevEdgeband;
  }
  if (data.catalogs.accessories.some((acc) => acc.id === prevAccessory)) {
    accessorySelect.value = prevAccessory;
  }
}

function exportCutListCSV(summary) {
  if (!summary || summary.pieces.length === 0) return;
  const headers = [
    "Nombre",
    "Material",
    "Espesor",
    "Largo",
    "Ancho",
    "Cantidad",
    "Tapacanto",
    "Lados"
  ];
  const rows = summary.pieces.map((piece) => {
    const board = data.catalogs.boards.find((b) => b.id === piece.materialId);
    const band = data.catalogs.edgebands.find((e) => e.id === piece.edgeBandId);
    return [
      piece.name,
      board ? board.name : "",
      piece.thickness,
      piece.length,
      piece.width,
      piece.qty,
      band ? band.name : "",
      formatEdges(piece.edges)
    ];
  });
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");
  downloadFile(csv, "cutlist.csv", "text/csv");
}

function exportCutListPDF(summary) {
  if (!summary || summary.pieces.length === 0) return;
  const win = window.open("", "_blank");
  if (!win) return;
  const rows = summary.pieces
    .map(
      (p) =>
        `<tr><td>${p.name}</td><td>${p.length}x${p.width}mm</td><td>${p.qty}</td><td>${formatEdges(p.edges)}</td></tr>`
    )
    .join("");
  win.document.write(`
    <html>
      <head>
        <title>Cut List</title>
        <style>
          body{font-family:Arial,sans-serif;padding:24px;}h1{margin-top:0;}table{width:100%;border-collapse:collapse;margin:12px 0;}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left;font-size:12px;}
        </style>
      </head>
      <body>
        <h1>Cut List</h1>
        <p><strong>Proyecto:</strong> ${currentProject.name || ""}</p>
        <table>
          <tr><th>Pieza</th><th>Medidas</th><th>Cant.</th><th>Canto</th></tr>
          ${rows}
        </table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

function exportBudgetPDF(summary) {
  if (!summary) return;
  const win = window.open("", "_blank");
  if (!win) return;
  const piecesRows = summary.pieces
    .map(
      (p) =>
        `<tr><td>${p.name}</td><td>${p.length}x${p.width}mm</td><td>${p.qty}</td></tr>`
    )
    .join("");
  const accessoryRows = summary.accessories.summary
    .map(
      (a) => `<tr><td>${a.name}</td><td>${a.qty}</td><td>${formatCurrency(a.cost)}</td></tr>`
    )
    .join("");
  win.document.write(`
    <html>
      <head>
        <title>Presupuesto</title>
        <style>
          body{font-family:Arial,sans-serif;padding:24px;}h1{margin-top:0;}table{width:100%;border-collapse:collapse;margin:12px 0;}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left;font-size:12px;}
        </style>
      </head>
      <body>
        <h1>Presupuesto</h1>
        <p><strong>Cliente:</strong> ${currentProject.client || ""}</p>
        <p><strong>Proyecto:</strong> ${currentProject.name || ""}</p>
        <p><strong>Fecha:</strong> ${currentProject.date || ""}</p>
        <h2>Resumen</h2>
        <table>
          <tr><th>Materiales</th><td>${formatCurrency(summary.costs.materials)}</td></tr>
          <tr><th>Mano de obra</th><td>${formatCurrency(summary.costs.labor.cost)}</td></tr>
          <tr><th>Total</th><td>${formatCurrency(summary.costs.total)}</td></tr>
        </table>
        <h2>Piezas</h2>
        <table>
          <tr><th>Pieza</th><th>Medidas</th><th>Cant.</th></tr>
          ${piecesRows}
        </table>
        <h2>Accesorios</h2>
        <table>
          <tr><th>Accesorio</th><th>Cant.</th><th>Costo</th></tr>
          ${accessoryRows}
        </table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function renderTemplatesList() {
  const container = el("#templates-list");
  container.innerHTML = "";
  if (data.templates.length === 0) {
    container.innerHTML = "<p class=\"muted\">Sin plantillas.</p>";
    return;
  }
  const list = document.createElement("div");
  list.className = "list";
  data.templates.forEach((template) => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div>
        <strong>${template.name}</strong>
        <span class="muted">${template.pieces.length} piezas - ${template.accessoriesRules.length} accesorios</span>
      </div>
      <button data-id="${template.id}" class="ghost">Editar</button>
    `;
    list.appendChild(item);
  });
  container.appendChild(list);

  list.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    const template = data.templates.find((t) => t.id === btn.dataset.id);
    if (template) {
      templateDraft = structuredClone(template);
      currentTemplateId = template.id;
      renderTemplateEditor();
    }
  });
}

function renderTemplateEditor() {
  el("#tpl-name").value = templateDraft.name || "";
  el("#param-ancho").value = templateDraft.params.ANCHO || 0;
  el("#param-alto").value = templateDraft.params.ALTO || 0;
  el("#param-prof").value = templateDraft.params.PROF || 0;
  el("#param-espesor").value = templateDraft.params.ESPESOR || 0;
  el("#param-holgura").value = templateDraft.params.HOLGURA || 0;
  el("#param-ancho").oninput = handleTemplateParamInput;
  el("#param-alto").oninput = handleTemplateParamInput;
  el("#param-prof").oninput = handleTemplateParamInput;
  el("#param-espesor").oninput = handleTemplateParamInput;
  el("#param-holgura").oninput = handleTemplateParamInput;

  renderTemplatePieces();
  renderTemplateAccessories();
}

function handleTemplateParamInput() {
  templateDraft.params.ANCHO = toNumber(el("#param-ancho").value, 0);
  templateDraft.params.ALTO = toNumber(el("#param-alto").value, 0);
  templateDraft.params.PROF = toNumber(el("#param-prof").value, 0);
  templateDraft.params.ESPESOR = toNumber(el("#param-espesor").value, 0);
  templateDraft.params.HOLGURA = toNumber(el("#param-holgura").value, 0);
  renderTemplatePieces();
}

function evaluateTemplatePiece(piece) {
  const length = evalExpr(piece.exprL, templateDraft.params);
  const width = evalExpr(piece.exprW, templateDraft.params);
  const qty = evalExpr(piece.qtyExpr || "1", templateDraft.params);
  if (!Number.isFinite(length) || !Number.isFinite(width) || !Number.isFinite(qty)) {
    return { ok: false, message: "Expresion invalida o sin resultado numerico." };
  }
  if (length <= 0 || width <= 0 || qty <= 0) {
    return {
      ok: false,
      message: `Resultado invalido: ${formatNumber(length, 2)} x ${formatNumber(width, 2)} / qty ${formatNumber(qty, 2)}`
    };
  }
  return {
    ok: true,
    message: `Preview: ${formatNumber(length, 1)} x ${formatNumber(width, 1)} mm | qty ${formatNumber(qty, 2)}`
  };
}

function renderTemplatePieces() {
  const container = el("#tpl-pieces");
  container.innerHTML = "";
  if (templateDraft.pieces.length === 0) {
    container.innerHTML = "<p class=\"muted\">Agrega piezas parametricas.</p>";
    return;
  }
  templateDraft.pieces.forEach((piece, index) => {
    const preview = evaluateTemplatePiece(piece);
    const row = document.createElement("div");
    row.className = "form-grid three";
    row.innerHTML = `
      <label>Nombre<input data-field="name" data-index="${index}" value="${piece.name || ""}" /></label>
      <label>Material
        <select data-field="materialId" data-index="${index}">
          ${data.catalogs.boards
            .map(
              (b) =>
                `<option value="${b.id}" ${piece.materialId === b.id ? "selected" : ""}>${b.name}</option>`
            )
            .join("")}
        </select>
      </label>
      <label>Largo expr<input data-field="exprL" data-index="${index}" value="${piece.exprL || ""}" /></label>
      <label>Ancho expr<input data-field="exprW" data-index="${index}" value="${piece.exprW || ""}" /></label>
      <label>Cant expr<input data-field="qtyExpr" data-index="${index}" value="${piece.qtyExpr || "1"}" /></label>
      <label>Tapacanto
        <select data-field="edgeBandId" data-index="${index}">
          <option value="">Sin tapacanto</option>
          ${data.catalogs.edgebands
            .map(
              (e) =>
                `<option value="${e.id}" ${piece.edgeBandId === e.id ? "selected" : ""}>${e.name}</option>`
            )
            .join("")}
        </select>
      </label>
      <label>Notas<input data-field="notes" data-index="${index}" value="${piece.notes || ""}" /></label>
      <div class="edge-grid">
        <label><input type="checkbox" data-field="edges.l1" data-index="${index}" ${piece.edges?.l1 ? "checked" : ""} /> L1</label>
        <label><input type="checkbox" data-field="edges.l2" data-index="${index}" ${piece.edges?.l2 ? "checked" : ""} /> L2</label>
        <label><input type="checkbox" data-field="edges.w1" data-index="${index}" ${piece.edges?.w1 ? "checked" : ""} /> C1</label>
        <label><input type="checkbox" data-field="edges.w2" data-index="${index}" ${piece.edges?.w2 ? "checked" : ""} /> C2</label>
        <button data-action="remove" data-index="${index}" class="ghost">Quitar</button>
      </div>
      <div class="form-preview ${preview.ok ? "" : "error"}">${preview.message}</div>
    `;
    container.appendChild(row);
  });

  container.querySelectorAll("input, select").forEach((input) => {
    input.addEventListener("input", handleTemplatePieceChange);
    input.addEventListener("change", handleTemplatePieceChange);
  });
  container.querySelectorAll("button[data-action=\"remove\"]").forEach((btn) => {
    btn.addEventListener("click", handleTemplatePieceRemove);
  });
}

function handleTemplatePieceChange(event) {
  const index = Number(event.target.dataset.index);
  const field = event.target.dataset.field;
  if (!field) return;
  const piece = templateDraft.pieces[index];
  if (!piece) return;
  if (field.startsWith("edges.")) {
    const edgeField = field.split(".")[1];
    piece.edges = piece.edges || { l1: false, l2: false, w1: false, w2: false };
    piece.edges[edgeField] = event.target.checked;
  } else {
    piece[field] = event.target.value;
  }
  const row = event.target.closest(".form-grid.three");
  const previewEl = row ? row.querySelector(".form-preview") : null;
  if (previewEl) {
    const preview = evaluateTemplatePiece(piece);
    previewEl.textContent = preview.message;
    previewEl.classList.toggle("error", !preview.ok);
  }
}

function handleTemplatePieceRemove(event) {
  const index = Number(event.target.dataset.index);
  if (Number.isNaN(index)) return;
  templateDraft.pieces.splice(index, 1);
  renderTemplatePieces();
}

function renderTemplateAccessories() {
  const container = el("#tpl-accessories");
  container.innerHTML = "";
  if (templateDraft.accessoriesRules.length === 0) {
    container.innerHTML = "<p class=\"muted\">Agrega reglas de accesorios.</p>";
    return;
  }
  templateDraft.accessoriesRules.forEach((rule, index) => {
    const row = document.createElement("div");
    row.className = "form-grid three";
    row.innerHTML = `
      <label>Accesorio
        <select data-field="accessoryId" data-index="${index}">
          ${data.catalogs.accessories
            .map(
              (a) =>
                `<option value="${a.id}" ${rule.accessoryId === a.id ? "selected" : ""}>${a.name}</option>`
            )
            .join("")}
        </select>
      </label>
      <label>Cant expr<input data-field="qtyExpr" data-index="${index}" value="${rule.qtyExpr || "1"}" /></label>
      <label>Notas<input data-field="notes" data-index="${index}" value="${rule.notes || ""}" /></label>
      <button data-action="remove" data-index="${index}" class="ghost">Quitar</button>
    `;
    container.appendChild(row);
  });
  container.querySelectorAll("input, select, button").forEach((input) => {
    input.addEventListener("input", handleTemplateAccessoryChange);
    input.addEventListener("change", handleTemplateAccessoryChange);
    input.addEventListener("click", handleTemplateAccessoryChange);
  });
}

function handleTemplateAccessoryChange(event) {
  const index = Number(event.target.dataset.index);
  const field = event.target.dataset.field;
  const rule = templateDraft.accessoriesRules[index];
  if (!rule) return;
  if (event.target.dataset.action === "remove") {
    templateDraft.accessoriesRules.splice(index, 1);
    renderTemplateAccessories();
    return;
  }
  if (field) {
    rule[field] = event.target.value;
  }
}

function renderCatalogs() {
  renderBoardsList();
  renderEdgebandsList();
  renderAccessoriesList();
  refreshCatalogFormState();
  updateBoardSizesHint();
}

function renderBoardsList() {
  const container = el("#boards-list");
  container.innerHTML = "";
  const list = document.createElement("div");
  list.className = "list";
  data.catalogs.boards.forEach((board) => {
    const item = document.createElement("div");
    item.className = "list-item";
    const sizes = board.sizes.map((s) => `${s.width}x${s.height}`).join(", ");
    const usage = getBoardUsage(board.id);
    item.innerHTML = `
      <div>
        <strong>${board.name}</strong>
        <span class="muted">${board.thickness}mm - ${sizes}</span>
        <span class="badge">en uso: ${usage}</span>
      </div>
      <div class="actions">
        <button data-action="edit" data-id="${board.id}" class="ghost">Editar</button>
        <button data-action="delete" data-id="${board.id}" class="ghost">Eliminar</button>
      </div>
    `;
    list.appendChild(item);
  });
  container.appendChild(list);
  list.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    const board = data.catalogs.boards.find((b) => b.id === btn.dataset.id);
    if (!board) return;
    if (btn.dataset.action === "delete") {
      const usage = getBoardUsage(board.id);
      if (
        !confirm(
          usage
            ? `Esta placa esta en uso en ${usage} elemento(s). Eliminarla puede romper plantillas/proyectos. Continuar?`
            : "Eliminar placa?"
        )
      ) {
        return;
      }
      data.catalogs.boards = data.catalogs.boards.filter((b) => b.id !== board.id);
      saveData(data);
      renderCatalogs();
      renderProjectView();
      showToast("Placa eliminada");
      return;
    }
    editingBoardId = board.id;
    el("#board-name").value = board.name;
    el("#board-thickness").value = board.thickness;
    el("#board-cost").value = board.cost;
    el("#board-waste").value = board.wastePct;
    el("#board-sizes").value = board.sizes.map((s) => `${s.width}x${s.height}`).join(",");
    refreshCatalogFormState();
    updateBoardSizesHint();
  });
}

function renderEdgebandsList() {
  const container = el("#edgebands-list");
  container.innerHTML = "";
  const list = document.createElement("div");
  list.className = "list";
  data.catalogs.edgebands.forEach((band) => {
    const item = document.createElement("div");
    item.className = "list-item";
    const usage = getEdgebandUsage(band.id);
    item.innerHTML = `
      <div>
        <strong>${band.name}</strong>
        <span class="muted">${band.width}mm - ${formatCurrency(band.costPerM)}/m</span>
        <span class="badge">en uso: ${usage}</span>
      </div>
      <div class="actions">
        <button data-action="edit" data-id="${band.id}" class="ghost">Editar</button>
        <button data-action="delete" data-id="${band.id}" class="ghost">Eliminar</button>
      </div>
    `;
    list.appendChild(item);
  });
  container.appendChild(list);
  list.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    const band = data.catalogs.edgebands.find((b) => b.id === btn.dataset.id);
    if (!band) return;
    if (btn.dataset.action === "delete") {
      const usage = getEdgebandUsage(band.id);
      if (
        !confirm(
          usage
            ? `Este tapacanto esta en uso en ${usage} elemento(s). Eliminarlo puede romper plantillas/proyectos. Continuar?`
            : "Eliminar tapacanto?"
        )
      ) {
        return;
      }
      data.catalogs.edgebands = data.catalogs.edgebands.filter((b) => b.id !== band.id);
      saveData(data);
      renderCatalogs();
      renderProjectView();
      showToast("Tapacanto eliminado");
      return;
    }
    editingEdgebandId = band.id;
    el("#edgeband-name").value = band.name;
    el("#edgeband-width").value = band.width;
    el("#edgeband-cost").value = band.costPerM;
    el("#edgeband-waste").value = band.wastePct;
    refreshCatalogFormState();
  });
}

function renderAccessoriesList() {
  const container = el("#accessories-list");
  container.innerHTML = "";
  const list = document.createElement("div");
  list.className = "list";
  data.catalogs.accessories.forEach((acc) => {
    const item = document.createElement("div");
    item.className = "list-item";
    const usage = getAccessoryUsage(acc.id);
    item.innerHTML = `
      <div>
        <strong>${acc.name}</strong>
        <span class="muted">${acc.unit} - ${formatCurrency(acc.cost)}</span>
        <span class="badge">en uso: ${usage}</span>
      </div>
      <div class="actions">
        <button data-action="edit" data-id="${acc.id}" class="ghost">Editar</button>
        <button data-action="delete" data-id="${acc.id}" class="ghost">Eliminar</button>
      </div>
    `;
    list.appendChild(item);
  });
  container.appendChild(list);
  list.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    const acc = data.catalogs.accessories.find((a) => a.id === btn.dataset.id);
    if (!acc) return;
    if (btn.dataset.action === "delete") {
      const usage = getAccessoryUsage(acc.id);
      if (
        !confirm(
          usage
            ? `Este accesorio esta en uso en ${usage} elemento(s). Eliminarlo puede romper plantillas/proyectos. Continuar?`
            : "Eliminar accesorio?"
        )
      ) {
        return;
      }
      data.catalogs.accessories = data.catalogs.accessories.filter((a) => a.id !== acc.id);
      saveData(data);
      renderCatalogs();
      renderProjectView();
      showToast("Accesorio eliminado");
      return;
    }
    editingAccessoryId = acc.id;
    el("#acc-name").value = acc.name;
    el("#acc-unit").value = acc.unit;
    el("#acc-cost").value = acc.cost;
    refreshCatalogFormState();
  });
}

function fillSettingsForm() {
  el("#set-kerf").value = data.settings.kerf;
  el("#set-margin").value = data.settings.marginPct;
  el("#set-labor-mode").value = data.settings.laborMode;
  el("#set-labor-hour").value = data.settings.laborRatePerHour;
  el("#set-labor-m2").value = data.settings.laborRatePerM2;
  el("#set-time-piece").value = data.settings.laborTimePerPieceMin;
  el("#set-time-module").value = data.settings.laborTimePerModuleMin;
  allowRotate = data.settings.allowRotate !== false;
  syncLaborFields();
}

function syncLaborFields() {
  const mode = el("#set-labor-mode").value;
  const byHour = mode === "hour";
  el("#set-labor-hour").disabled = !byHour;
  el("#set-time-piece").disabled = !byHour;
  el("#set-time-module").disabled = !byHour;
  el("#set-labor-m2").disabled = byHour;
}

const projectsBoard = el("#projects-board");
if (projectsBoard) {
  projectsBoard.addEventListener("click", handleProjectBoardClick);
}

el("#projects-search").addEventListener("input", (event) => {
  projectFilters.search = event.target.value || "";
  renderProjectsList();
});

el("#projects-status-filter").addEventListener("change", (event) => {
  projectFilters.status = event.target.value || "";
  renderProjectsList();
});

el("#nest-allow-rotate").addEventListener("change", (event) => {
  allowRotate = Boolean(event.target.checked);
  data.settings.allowRotate = allowRotate;
  saveData(data);
  renderProjectView();
});

el("#set-labor-mode").addEventListener("change", () => {
  syncLaborFields();
});

el("#board-sizes").addEventListener("input", () => {
  updateBoardSizesHint();
});

el("#btn-cancel-board-edit").addEventListener("click", () => {
  resetBoardForm();
  refreshCatalogFormState();
});

el("#btn-cancel-edgeband-edit").addEventListener("click", () => {
  resetEdgebandForm();
  refreshCatalogFormState();
});

el("#btn-cancel-accessory-edit").addEventListener("click", () => {
  resetAccessoryForm();
  refreshCatalogFormState();
});

el("#btn-new-project").addEventListener("click", () => {
  currentProject = createEmptyProject();
  boardSizeChoices = {};
  setActiveView("project");
});

el("#btn-save-project").addEventListener("click", () => {
  updateProjectFromForm();
  const saved = saveCurrentProject({ force: true, silent: false });
  if (saved) {
    showToast("Proyecto guardado");
  }
});

el("#btn-reset-project").addEventListener("click", () => {
  if (!confirm("Limpiar el proyecto actual?")) return;
  currentProject = createEmptyProject();
  boardSizeChoices = {};
  renderProjectView();
});

el("#btn-add-template").addEventListener("click", () => {
  updateProjectFromForm();
  const templateId = el("#tpl-select").value;
  const template = data.templates.find((t) => t.id === templateId);
  if (!template) {
    showToast("No hay plantilla seleccionada", "error");
    return;
  }
  const params = {};
  elAll("#tpl-params input").forEach((input) => {
    params[input.dataset.param] = Number(input.value);
  });
  const qty = asPositiveInt(el("#tpl-qty").value || 1);
  if (qty <= 0) {
    showToast("La cantidad de modulos debe ser mayor a 0", "error");
    return;
  }
  currentProject.items.push({
    id: generateId("item"),
    type: "template",
    templateId,
    params,
    qty
  });
  showToast("Plantilla agregada");
  renderProjectView();
});

el("#btn-add-manual").addEventListener("click", () => {
  updateProjectFromForm();
  const length = toNumber(el("#manual-length").value, 0);
  const width = toNumber(el("#manual-width").value, 0);
  const qty = asPositiveInt(el("#manual-qty").value || 1);
  if (length <= 0 || width <= 0) {
    showToast("Largo y ancho deben ser mayores a 0", "error");
    return;
  }
  if (qty <= 0) {
    showToast("La cantidad debe ser mayor a 0", "error");
    return;
  }
  const piece = {
    id: generateId("piece"),
    name: el("#manual-name").value.trim() || "Pieza",
    materialId: el("#manual-material").value,
    length,
    width,
    qty,
    edgeBandId: el("#manual-edgeband").value || null,
    edges: {
      l1: el("#edge-l1").checked,
      l2: el("#edge-l2").checked,
      w1: el("#edge-w1").checked,
      w2: el("#edge-w2").checked
    },
    notes: el("#manual-notes").value.trim()
  };
  currentProject.items.push({
    id: generateId("item"),
    type: "piece",
    piece
  });
  el("#manual-length").value = "";
  el("#manual-width").value = "";
  el("#manual-qty").value = "1";
  el("#manual-notes").value = "";
  el("#edge-l1").checked = false;
  el("#edge-l2").checked = false;
  el("#edge-w1").checked = false;
  el("#edge-w2").checked = false;
  showToast("Pieza manual agregada");
  renderProjectView();
});

el("#btn-add-manual-accessory").addEventListener("click", () => {
  updateProjectFromForm();
  const accessoryId = el("#manual-accessory").value;
  if (!accessoryId) {
    showToast("Selecciona un accesorio", "error");
    return;
  }
  const qty = asPositiveInt(el("#manual-accessory-qty").value || 1);
  if (qty <= 0) {
    showToast("La cantidad del accesorio debe ser mayor a 0", "error");
    return;
  }
  const notes = el("#manual-accessory-notes").value.trim();
  currentProject.manualAccessories.push({
    id: generateId("manacc"),
    accessoryId,
    qty,
    notes
  });
  el("#manual-accessory-qty").value = "1";
  el("#manual-accessory-notes").value = "";
  showToast("Accesorio agregado");
  renderProjectView();
});

el("#btn-export-cutlist").addEventListener("click", () => {
  updateProjectFromForm();
  const summary = buildSummary();
  if (!summary.pieces.length) {
    showToast("No hay piezas para exportar", "error");
    return;
  }
  exportCutListCSV(summary);
  showToast("CutList CSV exportado");
});

el("#btn-export-cutlist-pdf").addEventListener("click", () => {
  updateProjectFromForm();
  const summary = buildSummary();
  if (!summary.pieces.length) {
    showToast("No hay piezas para exportar", "error");
    return;
  }
  exportCutListPDF(summary);
});

el("#btn-export-pdf").addEventListener("click", () => {
  updateProjectFromForm();
  const summary = buildSummary();
  if (!summary.pieces.length) {
    showToast("El presupuesto no tiene piezas", "error");
    return;
  }
  exportBudgetPDF(summary);
});

el("#btn-new-template").addEventListener("click", () => {
  templateDraft = createEmptyTemplate();
  currentTemplateId = templateDraft.id;
  renderTemplateEditor();
  showToast("Plantilla nueva lista para editar");
});

el("#btn-add-tpl-piece").addEventListener("click", () => {
  templateDraft.pieces.push({
    id: generateId("piece"),
    name: "",
    materialId: data.catalogs.boards[0]?.id || "",
    exprL: "",
    exprW: "",
    qtyExpr: "1",
    edgeBandId: data.catalogs.edgebands[0]?.id || "",
    edges: { l1: false, l2: false, w1: false, w2: false },
    notes: ""
  });
  renderTemplatePieces();
});

el("#btn-add-tpl-accessory").addEventListener("click", () => {
  templateDraft.accessoriesRules.push({
    id: generateId("rule"),
    accessoryId: data.catalogs.accessories[0]?.id || "",
    qtyExpr: "1",
    notes: ""
  });
  renderTemplateAccessories();
});

el("#btn-save-template").addEventListener("click", () => {
  templateDraft.name = el("#tpl-name").value.trim() || "Plantilla";
  templateDraft.params.ANCHO = Number(el("#param-ancho").value || 0);
  templateDraft.params.ALTO = Number(el("#param-alto").value || 0);
  templateDraft.params.PROF = Number(el("#param-prof").value || 0);
  templateDraft.params.ESPESOR = Number(el("#param-espesor").value || 0);
  templateDraft.params.HOLGURA = Number(el("#param-holgura").value || 0);
  if (
    templateDraft.params.ANCHO <= 0 ||
    templateDraft.params.ALTO <= 0 ||
    templateDraft.params.PROF <= 0
  ) {
    showToast("ANCHO, ALTO y PROF deben ser mayores a 0", "error");
    return;
  }
  for (const piece of templateDraft.pieces) {
    const validation = evaluateTemplatePiece(piece);
    if (!validation.ok) {
      showToast(
        `Revisa pieza "${piece.name || "Sin nombre"}": ${validation.message}`,
        "error"
      );
      return;
    }
    const materialExists = data.catalogs.boards.some((board) => board.id === piece.materialId);
    if (!materialExists) {
      showToast(
        `La pieza "${piece.name || "Sin nombre"}" tiene un material no valido.`,
        "error"
      );
      return;
    }
  }
  const index = data.templates.findIndex((t) => t.id === templateDraft.id);
  if (index >= 0) {
    data.templates[index] = structuredClone(templateDraft);
  } else {
    data.templates.push(structuredClone(templateDraft));
  }
  saveData(data);
  currentTemplateId = templateDraft.id;
  renderTemplatesList();
  renderTemplateSelector();
  showToast("Plantilla guardada");
});

el("#btn-delete-template").addEventListener("click", () => {
  if (!currentTemplateId) return;
  if (!confirm("Eliminar plantilla?")) return;
  data.templates = data.templates.filter((t) => t.id !== currentTemplateId);
  saveData(data);
  templateDraft = createEmptyTemplate();
  currentTemplateId = templateDraft.id;
  renderTemplatesList();
  renderTemplateEditor();
  renderTemplateSelector();
  showToast("Plantilla eliminada");
});

el("#btn-add-board").addEventListener("click", () => {
  const sizes = parseBoardSizes(el("#board-sizes").value)
    .map((entry) => ({ width: entry.width, height: entry.height }))
    .filter((s) => s.width && s.height);
  if (sizes.length === 0) {
    sizes.push({ width: 2750, height: 1830 });
  }
  const board = {
    id: editingBoardId || generateId("board"),
    name: el("#board-name").value.trim() || "Placa",
    thickness: Number(el("#board-thickness").value || 0),
    cost: Number(el("#board-cost").value || 0),
    wastePct: Number(el("#board-waste").value || 0),
    sizes
  };
  if (board.thickness <= 0) {
    showToast("El espesor de placa debe ser mayor a 0", "error");
    return;
  }
  if (board.cost < 0) {
    showToast("El costo de placa no puede ser negativo", "error");
    return;
  }
  if (board.wastePct < 0 || board.wastePct > 100) {
    showToast("El % de desperdicio debe estar entre 0 y 100", "error");
    return;
  }
  const index = data.catalogs.boards.findIndex((b) => b.id === board.id);
  if (index >= 0) {
    data.catalogs.boards[index] = board;
  } else {
    data.catalogs.boards.push(board);
  }
  resetBoardForm();
  saveData(data);
  renderCatalogs();
  renderTemplateEditor();
  renderProjectView();
  showToast("Placa guardada");
});

el("#btn-add-edgeband").addEventListener("click", () => {
  const band = {
    id: editingEdgebandId || generateId("edge"),
    name: el("#edgeband-name").value.trim() || "Tapacanto",
    width: Number(el("#edgeband-width").value || 0),
    costPerM: Number(el("#edgeband-cost").value || 0),
    wastePct: Number(el("#edgeband-waste").value || 0)
  };
  if (band.width <= 0) {
    showToast("El ancho de tapacanto debe ser mayor a 0", "error");
    return;
  }
  if (band.costPerM < 0) {
    showToast("El costo por metro no puede ser negativo", "error");
    return;
  }
  if (band.wastePct < 0 || band.wastePct > 100) {
    showToast("El % de merma debe estar entre 0 y 100", "error");
    return;
  }
  const index = data.catalogs.edgebands.findIndex((b) => b.id === band.id);
  if (index >= 0) {
    data.catalogs.edgebands[index] = band;
  } else {
    data.catalogs.edgebands.push(band);
  }
  resetEdgebandForm();
  saveData(data);
  renderCatalogs();
  renderTemplateEditor();
  renderProjectView();
  showToast("Tapacanto guardado");
});

el("#btn-add-accessory").addEventListener("click", () => {
  const acc = {
    id: editingAccessoryId || generateId("acc"),
    name: el("#acc-name").value.trim() || "Accesorio",
    unit: el("#acc-unit").value.trim() || "u",
    cost: Number(el("#acc-cost").value || 0)
  };
  if (acc.cost < 0) {
    showToast("El costo del accesorio no puede ser negativo", "error");
    return;
  }
  const index = data.catalogs.accessories.findIndex((a) => a.id === acc.id);
  if (index >= 0) {
    data.catalogs.accessories[index] = acc;
  } else {
    data.catalogs.accessories.push(acc);
  }
  resetAccessoryForm();
  saveData(data);
  renderCatalogs();
  renderTemplateEditor();
  renderProjectView();
  showToast("Accesorio guardado");
});

el("#btn-save-settings").addEventListener("click", () => {
  data.settings.kerf = Math.max(0, toNumber(el("#set-kerf").value, 0));
  data.settings.marginPct = Math.max(
    0,
    Math.min(100, toNumber(el("#set-margin").value, 0))
  );
  data.settings.laborMode = el("#set-labor-mode").value;
  data.settings.laborRatePerHour = Math.max(0, toNumber(el("#set-labor-hour").value, 0));
  data.settings.laborRatePerM2 = Math.max(0, toNumber(el("#set-labor-m2").value, 0));
  data.settings.laborTimePerPieceMin = Math.max(
    0,
    toNumber(el("#set-time-piece").value, 0)
  );
  data.settings.laborTimePerModuleMin = Math.max(
    0,
    toNumber(el("#set-time-module").value, 0)
  );
  data.settings.allowRotate = allowRotate;
  saveData(data);
  fillSettingsForm();
  renderProjectView();
  showToast("Configuracion guardada");
});

el("#btn-export-json").addEventListener("click", () => {
  const json = exportData();
  downloadFile(json, "appMuebles-backup.json", "application/json");
  showToast("Backup JSON exportado");
});

el("#btn-preset-basic").addEventListener("click", () => {
  applySettingsPreset("basic");
  showToast("Perfil 'Taller base' aplicado");
});

el("#btn-preset-fast").addEventListener("click", () => {
  applySettingsPreset("fast");
  showToast("Perfil 'Produccion rapida' aplicado");
});

el("#import-json").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      data = importData(reader.result);
      currentProject = createEmptyProject();
      boardSizeChoices = {};
      projectFilters = { search: "", status: "" };
      renderAll();
      showToast("Backup importado");
    } catch (error) {
      showToast("JSON invalido", "error");
    }
  };
  reader.readAsText(file);
});

function renderAll() {
  fillProjectsStatusFilter();
  el("#projects-search").value = projectFilters.search;
  el("#projects-status-filter").value = projectFilters.status;
  renderProjectsList();
  renderProjectView();
  renderTemplatesList();
  renderTemplateEditor();
  renderCatalogs();
  fillSettingsForm();
}

renderAll();
