export function nestPieces(pieces, board, kerf = 0, allowRotate = true) {
  const cleanPieces = pieces
    .filter((p) => p.length > 0 && p.width > 0 && p.qty > 0)
    .flatMap((piece) =>
      Array.from({ length: Math.round(piece.qty) }, () => ({
        id: piece.id,
        name: piece.name,
        length: piece.length,
        width: piece.width
      }))
    );

  const sorted = cleanPieces.sort((a, b) =>
    b.length * b.width - a.length * a.width
  );

  const boards = [];
  const unplaced = [];

  const createBoard = () => ({
    placements: [],
    shelves: [],
    usedHeight: 0
  });

  const tryPlaceInBoard = (piece, boardState) => {
    for (const shelf of boardState.shelves) {
      const result = tryPlaceInShelf(piece, shelf, board, kerf, allowRotate);
      if (result) {
        boardState.placements.push(result);
        return true;
      }
    }

    const newShelf = createShelf(piece, boardState, board, kerf, allowRotate);
    if (newShelf) {
      boardState.shelves.push(newShelf.shelf);
      boardState.placements.push(newShelf.placement);
      boardState.usedHeight = newShelf.usedHeight;
      return true;
    }

    return false;
  };

  sorted.forEach((piece) => {
    let placed = false;
    for (const boardState of boards) {
      if (tryPlaceInBoard(piece, boardState)) {
        placed = true;
        break;
      }
    }
    if (!placed) {
      const newBoard = createBoard();
      if (tryPlaceInBoard(piece, newBoard)) {
        boards.push(newBoard);
      } else {
        unplaced.push(piece);
      }
    }
  });

  const boardArea = board.width * board.height;
  const resultBoards = boards.map((boardState) => {
    const usedArea = boardState.placements.reduce(
      (acc, p) => acc + p.width * p.height,
      0
    );
    const wastePct = boardArea > 0 ? ((boardArea - usedArea) / boardArea) * 100 : 0;
    return {
      placements: boardState.placements,
      usedArea,
      wastePct
    };
  });

  return {
    boards: resultBoards,
    totalBoards: resultBoards.length,
    boardArea,
    unplacedCount: unplaced.length,
    unplacedPieces: summarizeUnplaced(unplaced)
  };
}

function summarizeUnplaced(unplaced) {
  const map = new Map();
  unplaced.forEach((piece) => {
    const key = `${piece.id}-${piece.length}-${piece.width}`;
    if (!map.has(key)) {
      map.set(key, {
        id: piece.id,
        name: piece.name,
        length: piece.length,
        width: piece.width,
        qty: 0
      });
    }
    map.get(key).qty += 1;
  });
  return Array.from(map.values());
}

function tryPlaceInShelf(piece, shelf, board, kerf, allowRotate) {
  const orientations = getOrientations(piece, allowRotate);
  for (const orient of orientations) {
    const extra = shelf.usedWidth > 0 ? kerf : 0;
    const nextX = shelf.usedWidth + extra;
    if (nextX + orient.width <= board.width && orient.height <= shelf.height) {
      shelf.usedWidth = nextX + orient.width;
      return {
        ...orient,
        x: nextX,
        y: shelf.y
      };
    }
  }
  return null;
}

function createShelf(piece, boardState, board, kerf, allowRotate) {
  const orientations = getOrientations(piece, allowRotate);
  const y = boardState.usedHeight === 0 ? 0 : boardState.usedHeight + kerf;

  for (const orient of orientations) {
    if (orient.width <= board.width && y + orient.height <= board.height) {
      const shelf = {
        y,
        height: orient.height,
        usedWidth: orient.width
      };
      return {
        shelf,
        placement: {
          ...orient,
          x: 0,
          y
        },
        usedHeight: y + orient.height
      };
    }
  }
  return null;
}

function getOrientations(piece, allowRotate) {
  const base = [{ width: piece.width, height: piece.length, name: piece.name }];
  if (allowRotate && piece.width !== piece.length) {
    base.push({ width: piece.length, height: piece.width, name: piece.name });
  }
  return base;
}
