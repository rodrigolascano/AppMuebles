export function evalExpr(expr, vars = {}) {
  if (expr === null || expr === undefined) {
    return 0;
  }
  if (typeof expr === "number") {
    return expr;
  }
  const trimmed = String(expr).trim();
  if (trimmed === "") {
    return 0;
  }
  const fns = {
    ceil: Math.ceil,
    floor: Math.floor,
    round: Math.round,
    min: Math.min,
    max: Math.max,
    abs: Math.abs
  };
  try {
    // Intentional: flexible expressions for local formulas.
    const fn = new Function("vars", "fns", `with(fns){with(vars){return ${trimmed};}}`);
    const value = fn(vars, fns);
    return Number.isFinite(value) ? value : 0;
  } catch (error) {
    console.warn("Expression error", expr, error);
    return 0;
  }
}

export function computePiecesForProject(project, data) {
  const boardMap = new Map(data.catalogs.boards.map((b) => [b.id, b]));
  const templates = new Map(data.templates.map((t) => [t.id, t]));
  const pieces = [];
  let moduleCount = 0;

  project.items.forEach((item) => {
    if (item.type === "template") {
      const template = templates.get(item.templateId);
      if (!template) return;
      const params = { ...template.params, ...item.params };
      const qty = Number(item.qty || 1);
      moduleCount += qty;

      template.pieces.forEach((piece) => {
        const length = evalExpr(piece.exprL, params);
        const width = evalExpr(piece.exprW, params);
        const perModuleQty = evalExpr(piece.qtyExpr || 1, params);
        const totalQty = Math.max(0, perModuleQty * qty);
        const board = boardMap.get(piece.materialId);
        pieces.push({
          id: `${item.id}-${piece.id}`,
          name: piece.name,
          materialId: piece.materialId,
          thickness: board ? board.thickness : params.ESPESOR || 0,
          length,
          width,
          qty: totalQty,
          edgeBandId: piece.edgeBandId || null,
          edges: piece.edges || { l1: false, l2: false, w1: false, w2: false },
          notes: piece.notes || "",
          source: template.name
        });
      });
    }

    if (item.type === "piece") {
      pieces.push({
        ...item.piece,
        source: "Manual"
      });
    }
  });

  return { pieces, moduleCount };
}

export function computeEdgebandTotals(pieces, edgebands) {
  const edgeMap = new Map(edgebands.map((e) => [e.id, e]));
  const totals = new Map();

  pieces.forEach((piece) => {
    if (!piece.edgeBandId) return;
    const band = edgeMap.get(piece.edgeBandId);
    if (!band) return;
    const perim =
      (piece.edges?.l1 ? piece.length : 0) +
      (piece.edges?.l2 ? piece.length : 0) +
      (piece.edges?.w1 ? piece.width : 0) +
      (piece.edges?.w2 ? piece.width : 0);
    const meters = (perim * piece.qty) / 1000;
    if (!totals.has(band.id)) {
      totals.set(band.id, { band, meters: 0 });
    }
    totals.get(band.id).meters += meters;
  });

  return Array.from(totals.values()).map((entry) => {
    const waste = entry.band.wastePct || 0;
    const totalMeters = entry.meters * (1 + waste / 100);
    return {
      id: entry.band.id,
      name: entry.band.name,
      width: entry.band.width,
      meters: totalMeters,
      costPerM: entry.band.costPerM,
      cost: totalMeters * entry.band.costPerM,
      wastePct: waste
    };
  });
}

export function computeAccessoryTotals(project, templates, accessories) {
  const accessoryMap = new Map(accessories.map((a) => [a.id, a]));
  const templateMap = new Map(templates.map((t) => [t.id, t]));
  const totals = new Map();
  const details = [];

  project.items.forEach((item) => {
    if (item.type === "template") {
      const template = templateMap.get(item.templateId);
      if (!template) return;
      const params = { ...template.params, ...item.params };
      const qty = Number(item.qty || 1);
      (template.accessoriesRules || []).forEach((rule) => {
        const baseQty = evalExpr(rule.qtyExpr, params);
        const totalQty = Math.max(0, baseQty * qty);
        const accessory = accessoryMap.get(rule.accessoryId);
        if (!accessory) return;
        if (!totals.has(accessory.id)) {
          totals.set(accessory.id, { accessory, qty: 0 });
        }
        totals.get(accessory.id).qty += totalQty;
        details.push({
          accessoryId: accessory.id,
          name: accessory.name,
          qty: totalQty,
          unit: accessory.unit,
          cost: totalQty * accessory.cost,
          calc: `${rule.qtyExpr} x ${qty}`,
          source: template.name
        });
      });
    }
  });

  (project.manualAccessories || []).forEach((entry) => {
    const accessory = accessoryMap.get(entry.accessoryId);
    if (!accessory) return;
    if (!totals.has(accessory.id)) {
      totals.set(accessory.id, { accessory, qty: 0 });
    }
    totals.get(accessory.id).qty += entry.qty;
    details.push({
      accessoryId: accessory.id,
      name: accessory.name,
      qty: entry.qty,
      unit: accessory.unit,
      cost: entry.qty * accessory.cost,
      calc: "Manual",
      source: "Manual"
    });
  });

  const summary = Array.from(totals.values()).map((entry) => ({
    id: entry.accessory.id,
    name: entry.accessory.name,
    unit: entry.accessory.unit,
    qty: entry.qty,
    cost: entry.qty * entry.accessory.cost,
    costUnit: entry.accessory.cost
  }));

  return { summary, details };
}

export function computeLaborCost(pieces, moduleCount, settings) {
  if (settings.laborMode === "m2") {
    const area = pieces.reduce(
      (acc, piece) => acc + piece.length * piece.width * piece.qty,
      0
    );
    const areaM2 = area / 1e6;
    return {
      mode: "m2",
      units: areaM2,
      cost: areaM2 * settings.laborRatePerM2
    };
  }
  const piecesCount = pieces.reduce((acc, piece) => acc + piece.qty, 0);
  const minutes =
    piecesCount * settings.laborTimePerPieceMin +
    moduleCount * settings.laborTimePerModuleMin;
  const hours = minutes / 60;
  return {
    mode: "hour",
    units: hours,
    cost: hours * settings.laborRatePerHour
  };
}
