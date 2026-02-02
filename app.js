import {
  loadData,
  saveData,
  exportData,
  importData,
  generateId
} from "./storage/repository.js";
import { buildProjectSummary } from "./services/projectService.js";

let data = loadData();
let currentProject = createEmptyProject();
let currentTemplateId = null;
let editingBoardId = null;
let editingEdgebandId = null;
let editingAccessoryId = null;
let boardSizeChoices = {};
let templateDraft = createEmptyTemplate();

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
    navButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const view = btn.dataset.view;
    views.forEach((section) => {
      section.classList.toggle("active", section.id === `view-${view}`);
    });
    if (view === "project") renderProjectView();
    if (view === "projects") renderProjectsList();
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

function openModal(id) {
  const modal = el(`#${id}`);
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(id) {
  const modal = el(`#${id}`);
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

function resetBoardForm() {
  editingBoardId = null;
  el("#board-name").value = "";
  el("#board-thickness").value = "";
  el("#board-cost").value = "";
  el("#board-waste").value = "";
  el("#board-sizes").value = "";
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
  if (btn.dataset.action === "delete") {
    if (!confirm("Eliminar proyecto?")) return;
    data.projects = data.projects.filter((p) => p.id !== id);
    saveData(data);
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
    statusCounts[project.status] = (statusCounts[project.status] || 0) + 1;
  });
  if (needsSave) saveData(data);

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
  }

  const zoneByStatus = new Map(
    Array.from(board.querySelectorAll(".kanban-dropzone")).map((zone) => [
      zone.dataset.status,
      zone
    ])
  );

  data.projects.forEach((project) => {
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
      <div class="list-item"><strong>Total</strong><span>${formatCurrency(summary.costs.total)}</span></div>
    </div>
  `;
}

function renderNesting(summary) {
  const container = el("#nesting-view");
  container.innerHTML = "";
  if (!summary || summary.nesting.length === 0) {
    container.innerHTML = "<p class=\"muted\">Sin piezas para optimizar.</p>";
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

  renderProjectItems();
  renderManualAccessories();
  renderTemplateSelector();
  renderManualSelectors();

  updateProjectFromForm();
  const summary = buildProjectSummary(currentProject, data, {
    boardSizeById: boardSizeChoices
  });
  renderCutList(summary);
  renderEdgebands(summary);
  renderAccessories(summary);
  renderCostSummary(summary);
  renderNesting(summary);
}

function renderTemplateSelector() {
  const select = el("#tpl-select");
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

  renderTemplatePieces();
  renderTemplateAccessories();
}

function renderTemplatePieces() {
  const container = el("#tpl-pieces");
  container.innerHTML = "";
  if (templateDraft.pieces.length === 0) {
    container.innerHTML = "<p class=\"muted\">Agrega piezas parametricas.</p>";
    return;
  }
  templateDraft.pieces.forEach((piece, index) => {
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
    item.innerHTML = `
      <div>
        <strong>${board.name}</strong>
        <span class="muted">${board.thickness}mm - ${sizes}</span>
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
      data.catalogs.boards = data.catalogs.boards.filter((b) => b.id !== board.id);
      saveData(data);
      renderCatalogs();
      return;
    }
    editingBoardId = board.id;
    el("#board-name").value = board.name;
    el("#board-thickness").value = board.thickness;
    el("#board-cost").value = board.cost;
    el("#board-waste").value = board.wastePct;
    el("#board-sizes").value = board.sizes.map((s) => `${s.width}x${s.height}`).join(",");
    openModal("modal-board");
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
    item.innerHTML = `
      <div>
        <strong>${band.name}</strong>
        <span class="muted">${band.width}mm - ${formatCurrency(band.costPerM)}/m</span>
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
      data.catalogs.edgebands = data.catalogs.edgebands.filter((b) => b.id !== band.id);
      saveData(data);
      renderCatalogs();
      return;
    }
    editingEdgebandId = band.id;
    el("#edgeband-name").value = band.name;
    el("#edgeband-width").value = band.width;
    el("#edgeband-cost").value = band.costPerM;
    el("#edgeband-waste").value = band.wastePct;
    openModal("modal-edgeband");
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
    item.innerHTML = `
      <div>
        <strong>${acc.name}</strong>
        <span class="muted">${acc.unit} - ${formatCurrency(acc.cost)}</span>
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
      data.catalogs.accessories = data.catalogs.accessories.filter((a) => a.id !== acc.id);
      saveData(data);
      renderCatalogs();
      return;
    }
    editingAccessoryId = acc.id;
    el("#acc-name").value = acc.name;
    el("#acc-unit").value = acc.unit;
    el("#acc-cost").value = acc.cost;
    openModal("modal-accessory");
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
}

const projectsBoard = el("#projects-board");
if (projectsBoard) {
  projectsBoard.addEventListener("click", handleProjectBoardClick);
}

const boardModalBtn = el("#btn-open-board-modal");
if (boardModalBtn) {
  boardModalBtn.addEventListener("click", () => {
    resetBoardForm();
    openModal("modal-board");
  });
}

const edgebandModalBtn = el("#btn-open-edgeband-modal");
if (edgebandModalBtn) {
  edgebandModalBtn.addEventListener("click", () => {
    resetEdgebandForm();
    openModal("modal-edgeband");
  });
}

const accessoryModalBtn = el("#btn-open-accessory-modal");
if (accessoryModalBtn) {
  accessoryModalBtn.addEventListener("click", () => {
    resetAccessoryForm();
    openModal("modal-accessory");
  });
}

elAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.close;
    if (id) closeModal(id);
  });
});

el("#btn-new-project").addEventListener("click", () => {
  currentProject = createEmptyProject();
  setActiveView("project");
});

el("#btn-save-project").addEventListener("click", () => {
  updateProjectFromForm();
  saveCurrentProject({ force: true, silent: false });
  alert("Proyecto guardado");
});

el("#btn-reset-project").addEventListener("click", () => {
  currentProject = createEmptyProject();
  renderProjectView();
});

el("#btn-add-template").addEventListener("click", () => {
  updateProjectFromForm();
  const templateId = el("#tpl-select").value;
  const template = data.templates.find((t) => t.id === templateId);
  if (!template) return;
  const params = {};
  elAll("#tpl-params input").forEach((input) => {
    params[input.dataset.param] = Number(input.value);
  });
  const qty = Number(el("#tpl-qty").value || 1);
  currentProject.items.push({
    id: generateId("item"),
    type: "template",
    templateId,
    params,
    qty
  });
  renderProjectView();
});

el("#btn-add-manual").addEventListener("click", () => {
  updateProjectFromForm();
  const piece = {
    id: generateId("piece"),
    name: el("#manual-name").value.trim() || "Pieza",
    materialId: el("#manual-material").value,
    length: Number(el("#manual-length").value || 0),
    width: Number(el("#manual-width").value || 0),
    qty: Number(el("#manual-qty").value || 1),
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
  renderProjectView();
});

el("#btn-add-manual-accessory").addEventListener("click", () => {
  updateProjectFromForm();
  const accessoryId = el("#manual-accessory").value;
  if (!accessoryId) return;
  const qty = Number(el("#manual-accessory-qty").value || 1);
  const notes = el("#manual-accessory-notes").value.trim();
  currentProject.manualAccessories.push({
    id: generateId("manacc"),
    accessoryId,
    qty,
    notes
  });
  renderProjectView();
});

el("#btn-export-cutlist").addEventListener("click", () => {
  updateProjectFromForm();
  const summary = buildProjectSummary(currentProject, data, {
    boardSizeById: boardSizeChoices
  });
  exportCutListCSV(summary);
});

el("#btn-export-cutlist-pdf").addEventListener("click", () => {
  updateProjectFromForm();
  const summary = buildProjectSummary(currentProject, data, {
    boardSizeById: boardSizeChoices
  });
  exportCutListPDF(summary);
});

el("#btn-export-pdf").addEventListener("click", () => {
  updateProjectFromForm();
  const summary = buildProjectSummary(currentProject, data, {
    boardSizeById: boardSizeChoices
  });
  exportBudgetPDF(summary);
});

el("#btn-new-template").addEventListener("click", () => {
  templateDraft = createEmptyTemplate();
  currentTemplateId = templateDraft.id;
  renderTemplateEditor();
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
  const index = data.templates.findIndex((t) => t.id === templateDraft.id);
  if (index >= 0) {
    data.templates[index] = structuredClone(templateDraft);
  } else {
    data.templates.push(structuredClone(templateDraft));
  }
  saveData(data);
  renderTemplatesList();
  renderTemplateSelector();
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
});

el("#btn-add-board").addEventListener("click", () => {
  const sizes = el("#board-sizes")
    .value.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [width, height] = entry.split("x").map((n) => Number(n.trim()));
      return { width, height };
    })
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
  const index = data.catalogs.boards.findIndex((b) => b.id === board.id);
  if (index >= 0) {
    data.catalogs.boards[index] = board;
  } else {
    data.catalogs.boards.push(board);
  }
  editingBoardId = null;
  saveData(data);
  renderCatalogs();
  renderTemplateEditor();
  renderProjectView();
  closeModal("modal-board");
});

el("#btn-add-edgeband").addEventListener("click", () => {
  const band = {
    id: editingEdgebandId || generateId("edge"),
    name: el("#edgeband-name").value.trim() || "Tapacanto",
    width: Number(el("#edgeband-width").value || 0),
    costPerM: Number(el("#edgeband-cost").value || 0),
    wastePct: Number(el("#edgeband-waste").value || 0)
  };
  const index = data.catalogs.edgebands.findIndex((b) => b.id === band.id);
  if (index >= 0) {
    data.catalogs.edgebands[index] = band;
  } else {
    data.catalogs.edgebands.push(band);
  }
  editingEdgebandId = null;
  saveData(data);
  renderCatalogs();
  renderTemplateEditor();
  renderProjectView();
  closeModal("modal-edgeband");
});

el("#btn-add-accessory").addEventListener("click", () => {
  const acc = {
    id: editingAccessoryId || generateId("acc"),
    name: el("#acc-name").value.trim() || "Accesorio",
    unit: el("#acc-unit").value.trim() || "u",
    cost: Number(el("#acc-cost").value || 0)
  };
  const index = data.catalogs.accessories.findIndex((a) => a.id === acc.id);
  if (index >= 0) {
    data.catalogs.accessories[index] = acc;
  } else {
    data.catalogs.accessories.push(acc);
  }
  editingAccessoryId = null;
  saveData(data);
  renderCatalogs();
  renderTemplateEditor();
  renderProjectView();
  closeModal("modal-accessory");
});

el("#btn-save-settings").addEventListener("click", () => {
  data.settings.kerf = Number(el("#set-kerf").value || 0);
  data.settings.marginPct = Number(el("#set-margin").value || 0);
  data.settings.laborMode = el("#set-labor-mode").value;
  data.settings.laborRatePerHour = Number(el("#set-labor-hour").value || 0);
  data.settings.laborRatePerM2 = Number(el("#set-labor-m2").value || 0);
  data.settings.laborTimePerPieceMin = Number(el("#set-time-piece").value || 0);
  data.settings.laborTimePerModuleMin = Number(el("#set-time-module").value || 0);
  saveData(data);
  renderProjectView();
  alert("Configuracion guardada");
});

el("#btn-export-json").addEventListener("click", () => {
  const json = exportData();
  downloadFile(json, "appMuebles-backup.json", "application/json");
});

el("#import-json").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      data = importData(reader.result);
      currentProject = createEmptyProject();
      renderAll();
    } catch (error) {
      alert("JSON invalido");
    }
  };
  reader.readAsText(file);
});

function renderAll() {
  renderProjectsList();
  renderProjectView();
  renderTemplatesList();
  renderTemplateEditor();
  renderCatalogs();
  fillSettingsForm();
}

renderAll();
