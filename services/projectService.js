import {
  computePiecesForProject,
  computeEdgebandTotals,
  computeAccessoryTotals,
  computeLaborCost
} from "../domain/calc.js";
import { nestPieces } from "../nesting/nesting.js";

export function buildProjectSummary(project, data, options = {}) {
  const { boardSizeById = {}, allowRotate = true } = options;
  const { pieces, moduleCount } = computePiecesForProject(project, data);

  const edgebands = computeEdgebandTotals(pieces, data.catalogs.edgebands);
  const accessories = computeAccessoryTotals(
    project,
    data.templates,
    data.catalogs.accessories
  );

  const boardsMap = new Map(data.catalogs.boards.map((b) => [b.id, b]));
  const piecesByBoard = new Map();
  pieces.forEach((piece) => {
    if (!piece.materialId) return;
    if (!piecesByBoard.has(piece.materialId)) {
      piecesByBoard.set(piece.materialId, []);
    }
    piecesByBoard.get(piece.materialId).push(piece);
  });

  const nesting = [];
  let boardsCost = 0;
  piecesByBoard.forEach((boardPieces, boardId) => {
    const board = boardsMap.get(boardId);
    if (!board) return;
    const sizeIndex = boardSizeById[boardId] ?? 0;
    const size = board.sizes[sizeIndex] || board.sizes[0];
    if (!size) return;
    const nestResult = nestPieces(boardPieces, size, data.settings.kerf, allowRotate);
    const purchaseBoards = Math.ceil(
      nestResult.totalBoards * (1 + (board.wastePct || 0) / 100)
    );
    const cost = purchaseBoards * board.cost;
    boardsCost += cost;
    nesting.push({
      board,
      size,
      result: nestResult,
      purchaseBoards,
      cost
    });
  });

  const edgebandCost = edgebands.reduce((acc, item) => acc + item.cost, 0);
  const accessoriesCost = accessories.summary.reduce((acc, item) => acc + item.cost, 0);
  const labor = computeLaborCost(pieces, moduleCount, data.settings);

  const materialsCost = boardsCost + edgebandCost + accessoriesCost;
  const subtotal = materialsCost + labor.cost;
  const total = subtotal * (1 + (data.settings.marginPct || 0) / 100);

  return {
    pieces,
    moduleCount,
    edgebands,
    accessories,
    nesting,
    costs: {
      boards: boardsCost,
      edgebands: edgebandCost,
      accessories: accessoriesCost,
      labor,
      materials: materialsCost,
      subtotal,
      total
    }
  };
}
