const STORAGE_KEY = "appMueblesData";

const defaultData = {
  catalogs: {
    boards: [
      {
        id: "board-1",
        name: "Melamina Blanca 18mm",
        sizes: [
          { width: 2750, height: 1830 },
          { width: 2440, height: 1220 }
        ],
        thickness: 18,
        cost: 100,
        wastePct: 8
      }
    ],
    edgebands: [
      {
        id: "edge-1",
        name: "Tapacanto 0.45mm",
        width: 18,
        costPerM: 0.8,
        wastePct: 5
      },
      {
        id: "edge-2",
        name: "Tapacanto 2mm",
        width: 18,
        costPerM: 1.2,
        wastePct: 5
      }
    ],
    accessories: [
      { id: "acc-1", name: "Bisagra cazoleta", unit: "u", cost: 1.5 },
      { id: "acc-2", name: "Corredera telescopica", unit: "par", cost: 8 },
      { id: "acc-3", name: "Tirador recto", unit: "u", cost: 2 },
      { id: "acc-4", name: "Pata regulable", unit: "u", cost: 1.2 },
      { id: "acc-5", name: "Tornillo 4x50", unit: "u", cost: 0.08 },
      { id: "acc-6", name: "Bisagra cierre suave", unit: "u", cost: 1.8 },
      { id: "acc-7", name: "Taco Fisher 10", unit: "u", cost: 1 },
      { id: "acc-8", name: "Tornillo 2 pulgadas", unit: "u", cost: 0.25 },
      { id: "acc-9", name: "Tornillo 1/4", unit: "u", cost: 0.05 },
      { id: "acc-10", name: "Tornillo 5/8", unit: "u", cost: 0.06 },
      { id: "acc-11", name: "Cortes", unit: "u", cost: 0.2 },
      { id: "acc-12", name: "Pegado de canto 0.45", unit: "m", cost: 0.3 },
      { id: "acc-13", name: "Pegado de canto 2mm", unit: "m", cost: 0.5 }
    ]
  },
  settings: {
    kerf: 3,
    marginPct: 20,
    laborMode: "hour",
    laborRatePerHour: 12,
    laborRatePerM2: 4,
    laborTimePerPieceMin: 6,
    laborTimePerModuleMin: 20
  },
  templates: [
    {
      id: "tpl-1",
      name: "Bajo mesada 60",
      params: {
        ANCHO: 600,
        ALTO: 720,
        PROF: 560,
        ESPESOR: 18,
        HOLGURA: 2
      },
      pieces: [
        {
          id: "tpl-1-p1",
          name: "Lateral",
          materialId: "board-1",
          exprL: "ALTO",
          exprW: "PROF",
          qtyExpr: "2",
          edgeBandId: "edge-1",
          edges: { l1: true, l2: false, w1: true, w2: false },
          notes: ""
        },
        {
          id: "tpl-1-p2",
          name: "Base",
          materialId: "board-1",
          exprL: "ANCHO - 2*ESPESOR",
          exprW: "PROF",
          qtyExpr: "1",
          edgeBandId: "edge-1",
          edges: { l1: true, l2: false, w1: false, w2: false },
          notes: ""
        },
        {
          id: "tpl-1-p3",
          name: "Puerta",
          materialId: "board-1",
          exprL: "ALTO - HOLGURA",
          exprW: "(ANCHO - 2*HOLGURA)/2",
          qtyExpr: "2",
          edgeBandId: "edge-1",
          edges: { l1: true, l2: true, w1: true, w2: true },
          notes: ""
        }
      ],
      accessoriesRules: [
        {
          id: "tpl-1-a1",
          accessoryId: "acc-1",
          qtyExpr: "(ALTO > 900 ? 3 : 2) * 2",
          notes: "Bisagras por puerta"
        },
        {
          id: "tpl-1-a2",
          accessoryId: "acc-5",
          qtyExpr: "20",
          notes: "Tornillos estimados"
        }
      ]
    },
    {
      id: "tpl-2",
      name: "Alacena 80",
      params: {
        ANCHO: 800,
        ALTO: 700,
        PROF: 350,
        ESPESOR: 18,
        HOLGURA: 2
      },
      pieces: [
        {
          id: "tpl-2-p1",
          name: "Lateral",
          materialId: "board-1",
          exprL: "ALTO",
          exprW: "PROF",
          qtyExpr: "2",
          edgeBandId: "edge-1",
          edges: { l1: true, l2: false, w1: true, w2: false },
          notes: ""
        },
        {
          id: "tpl-2-p2",
          name: "Tapa",
          materialId: "board-1",
          exprL: "ANCHO - 2*ESPESOR",
          exprW: "PROF",
          qtyExpr: "1",
          edgeBandId: "edge-1",
          edges: { l1: true, l2: false, w1: false, w2: false },
          notes: ""
        },
        {
          id: "tpl-2-p3",
          name: "Puerta",
          materialId: "board-1",
          exprL: "ALTO - HOLGURA",
          exprW: "(ANCHO - 2*HOLGURA)/2",
          qtyExpr: "2",
          edgeBandId: "edge-1",
          edges: { l1: true, l2: true, w1: true, w2: true },
          notes: ""
        }
      ],
      accessoriesRules: [
        {
          id: "tpl-2-a1",
          accessoryId: "acc-1",
          qtyExpr: "(ALTO > 900 ? 3 : 2) * 2",
          notes: "Bisagras por puerta"
        },
        {
          id: "tpl-2-a2",
          accessoryId: "acc-3",
          qtyExpr: "2",
          notes: "Tiradores"
        }
      ]
    },
    {
      id: "tpl-3",
      name: "Vanitory 2 puertas",
      visibleParams: ["ANCHO", "ALTO", "PROF"],
      params: {
        ANCHO: 700,
        ALTO: 500,
        PROF: 500,
        ESPESOR: 18,
        HOLGURA: 2
      },
      pieces: [
        {
          id: "tpl-3-p1",
          name: "Faja",
          materialId: "board-1",
          exprL: "PROF",
          exprW: "80",
          qtyExpr: "2",
          edgeBandId: "edge-1",
          edges: { l1: true, l2: false, w1: false, w2: false },
          notes: ""
        },
        {
          id: "tpl-3-p2",
          name: "Base",
          materialId: "board-1",
          exprL: "ANCHO - 4*ESPESOR",
          exprW: "PROF - 20",
          qtyExpr: "1",
          edgeBandId: "edge-1",
          edges: { l1: true, l2: true, w1: true, w2: false },
          notes: ""
        },
        {
          id: "tpl-3-p3",
          name: "Lateral",
          materialId: "board-1",
          exprL: "ALTO",
          exprW: "PROF - 20",
          qtyExpr: "2",
          edgeBandId: "edge-1",
          edges: { l1: true, l2: false, w1: true, w2: false },
          notes: ""
        },
        {
          id: "tpl-3-p4",
          name: "Larguero",
          materialId: "board-1",
          exprL: "ANCHO - 4*ESPESOR",
          exprW: "85",
          qtyExpr: "1",
          edgeBandId: "edge-1",
          edges: { l1: true, l2: true, w1: false, w2: false },
          notes: ""
        },
        {
          id: "tpl-3-p5",
          name: "Tirador Manija",
          materialId: "board-1",
          exprL: "ANCHO - 4*ESPESOR",
          exprW: "75",
          qtyExpr: "2",
          edgeBandId: "edge-1",
          edges: { l1: true, l2: true, w1: false, w2: false },
          notes: ""
        },
        {
          id: "tpl-3-p6",
          name: "Puerta",
          materialId: "board-1",
          exprL: "ALTO - 2*ESPESOR + 2",
          exprW: "(ANCHO - 4*ESPESOR) / 2 + 10",
          qtyExpr: "2",
          edgeBandId: "edge-2",
          edges: { l1: true, l2: true, w1: true, w2: true },
          notes: ""
        }
      ],
      accessoriesRules: [
        {
          id: "tpl-3-a1",
          accessoryId: "acc-6",
          qtyExpr: "(ALTO > 900 ? 3 : 2) * 2",
          notes: "Bisagras por puerta"
        },
        {
          id: "tpl-3-a2",
          accessoryId: "acc-7",
          qtyExpr: "4",
          notes: ""
        },
        {
          id: "tpl-3-a3",
          accessoryId: "acc-10",
          qtyExpr: "(ALTO > 900 ? 3 : 2) * 2 * 4",
          notes: "Tornillos bisagra"
        },
        {
          id: "tpl-3-a4",
          accessoryId: "acc-8",
          qtyExpr: "14",
          notes: ""
        },
        {
          id: "tpl-3-a5",
          accessoryId: "acc-9",
          qtyExpr: "6",
          notes: ""
        },
        {
          id: "tpl-3-a6",
          accessoryId: "acc-11",
          qtyExpr: "30",
          notes: ""
        },
        {
          id: "tpl-3-a7",
          accessoryId: "acc-12",
          qtyExpr: "(5*PROF + 2*ALTO + 8*ANCHO - 32*ESPESOR - 60) / 1000",
          notes: "Metros"
        },
        {
          id: "tpl-3-a8",
          accessoryId: "acc-13",
          qtyExpr:
            "4 * ((ALTO - 2*ESPESOR + 2) + ((ANCHO - 4*ESPESOR) / 2 + 10)) / 1000",
          notes: "Metros"
        }
      ]
    }
  ],
  projects: []
};

export function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    saveData(defaultData);
    return structuredClone(defaultData);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("Storage parse error", error);
    saveData(defaultData);
    return structuredClone(defaultData);
  }
}

export function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function updateData(mutator) {
  const data = loadData();
  mutator(data);
  saveData(data);
  return data;
}

export function resetData() {
  saveData(defaultData);
  return structuredClone(defaultData);
}

export function exportData() {
  const data = loadData();
  return JSON.stringify(data, null, 2);
}

export function importData(jsonText) {
  const parsed = JSON.parse(jsonText);
  saveData(parsed);
  return parsed;
}

export function generateId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getDefaultData() {
  return structuredClone(defaultData);
}
