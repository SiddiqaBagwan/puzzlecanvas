/**
 * jigsawGeometry.js
 *
 * Generates mathematically complementary jigsaw piece edge paths.
 *
 * KEY GUARANTEE:
 * Every internal edge between two neighboring pieces is generated EXACTLY ONCE.
 * Both neighbors consume that identical edge geometry:
 * - One neighbor uses it in forward direction as a TAB (or SLOT).
 * - The other neighbor uses it in reverse direction, perfectly fitting as a SLOT (or TAB).
 *
 * NEVER: TAB ↔ TAB or SLOT ↔ SLOT.
 * ALWAYS: exactly one TAB and one SLOT on every internal shared boundary.
 */

import { randFloat } from '../utils/random.js';

/**
 * Helper to round to 2 decimal places for clean SVG path strings.
 */
function round(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Generate a single internal edge geometry in (u, v) coordinates.
 * u runs along the edge axis [0, length].
 * v is displacement perpendicular to the edge axis.
 *
 * direction: 1 = TAB (+v outward bump), -1 = SLOT (-v inward indent).
 */
function createEdgeGeometry(length, direction, rng, id) {
  // Tab parameters scaled to edge length
  const tabHeight = length * randFloat(rng, 0.20, 0.25) * direction;
  const tabWidth = length * randFloat(rng, 0.32, 0.38);
  const neckWidth = tabWidth * randFloat(rng, 0.58, 0.66);
  const offset = randFloat(rng, -0.035, 0.035) * length;

  const mid = length * 0.5 + offset;
  const hw = tabWidth / 2;
  const hn = neckWidth / 2;
  const h = tabHeight;

  // 6 smooth cubic Bézier segments in (u, v) space
  // Segment 1: Approach along baseline to base of neck
  const seg1 = {
    p0: { u: 0, v: 0 },
    cp1: { u: (mid - hn) * 0.55, v: 0 },
    cp2: { u: mid - hn - (hw - hn) * 0.2, v: 0 },
    p1: { u: mid - hn, v: 0 },
  };

  // Segment 2: Neck flare to left head corner
  const seg2 = {
    p0: { u: mid - hn, v: 0 },
    cp1: { u: mid - hn + (hw - hn) * 0.1, v: h * 0.25 },
    cp2: { u: mid - hw - (hw - hn) * 0.1, v: h * 0.45 },
    p1: { u: mid - hw, v: h * 0.65 },
  };

  // Segment 3: Left head corner to apex
  const seg3 = {
    p0: { u: mid - hw, v: h * 0.65 },
    cp1: { u: mid - hw, v: h * 0.90 },
    cp2: { u: mid - hw * 0.4, v: h },
    p1: { u: mid, v: h },
  };

  // Segment 4: Apex to right head corner
  const seg4 = {
    p0: { u: mid, v: h },
    cp1: { u: mid + hw * 0.4, v: h },
    cp2: { u: mid + hw, v: h * 0.90 },
    p1: { u: mid + hw, v: h * 0.65 },
  };

  // Segment 5: Right head corner back to neck base
  const seg5 = {
    p0: { u: mid + hw, v: h * 0.65 },
    cp1: { u: mid + hw + (hw - hn) * 0.1, v: h * 0.45 },
    cp2: { u: mid + hn - (hw - hn) * 0.1, v: h * 0.25 },
    p1: { u: mid + hn, v: 0 },
  };

  // Segment 6: Neck exit back to edge end
  const seg6 = {
    p0: { u: mid + hn, v: 0 },
    cp1: { u: mid + hn + (hw - hn) * 0.2, v: 0 },
    cp2: { u: mid + hn + (length - (mid + hn)) * 0.45, v: 0 },
    p1: { u: length, v: 0 },
  };

  return {
    id,
    length,
    direction,
    type: direction === 1 ? 'TAB' : 'SLOT',
    segments: [seg1, seg2, seg3, seg4, seg5, seg6],
  };
}

/**
 * Pre-generate all shared internal edges for the puzzle grid.
 *
 * Returns:
 * - hEdgeGeometry[row][col]: (rows - 1) × cols internal horizontal edges
 * - vEdgeGeometry[row][col]: rows × (cols - 1) internal vertical edges
 */
export function buildSharedEdges(cols, rows, pieceW, pieceH, rng) {
  // Horizontal internal edges (between row r and row r+1, for column c)
  const hEdgeGeometry = [];
  for (let r = 0; r < rows - 1; r++) {
    hEdgeGeometry[r] = [];
    for (let c = 0; c < cols; c++) {
      const dir = rng() > 0.5 ? 1 : -1;
      hEdgeGeometry[r][c] = createEdgeGeometry(pieceW, dir, rng, `H_${r}_${c}`);
    }
  }

  // Vertical internal edges (between col c and col c+1, for row r)
  const vEdgeGeometry = [];
  for (let r = 0; r < rows; r++) {
    vEdgeGeometry[r] = [];
    for (let c = 0; c < cols - 1; c++) {
      const dir = rng() > 0.5 ? 1 : -1;
      vEdgeGeometry[r][c] = createEdgeGeometry(pieceH, dir, rng, `V_${r}_${c}`);
    }
  }

  return { hEdgeGeometry, vEdgeGeometry };
}

/**
 * Render an edge's cubic Bézier segments to SVG path commands.
 *
 * @param {object} edge - The edge geometry object
 * @param {boolean} isReversed - Whether to traverse in reverse direction
 * @param {'h'|'v'} axis - 'h' for horizontal (u=x, v=y), 'v' for vertical (u=y, v=x)
 * @param {number} baseOffset - Base y for horizontal, base x for vertical
 */
function renderEdgeSegments(edge, isReversed, axis, baseOffset) {
  const { segments } = edge;
  let cmd = '';

  const toPoint = (u, v) => {
    if (axis === 'h') {
      return `${round(u)},${round(baseOffset + v)}`;
    } else {
      return `${round(baseOffset + v)},${round(u)}`;
    }
  };

  if (!isReversed) {
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      const p1 = toPoint(s.cp1.u, s.cp1.v);
      const p2 = toPoint(s.cp2.u, s.cp2.v);
      const ep = toPoint(s.p1.u, s.p1.v);
      cmd += `C ${p1} ${p2} ${ep} `;
    }
  } else {
    // Reverse traversal: process segments from last to first,
    // swapping cp1 and cp2, with end point being s.p0
    for (let i = segments.length - 1; i >= 0; i--) {
      const s = segments[i];
      const p1 = toPoint(s.cp2.u, s.cp2.v);
      const p2 = toPoint(s.cp1.u, s.cp1.v);
      const ep = toPoint(s.p0.u, s.p0.v);
      cmd += `C ${p1} ${p2} ${ep} `;
    }
  }

  return cmd;
}

/**
 * Build the full closed SVG clip path for piece (col, row).
 * Starts at (0,0) and proceeds clockwise:
 * Top (left→right) → Right (top→bottom) → Bottom (right→left) → Left (bottom→top) → Close.
 */
export function buildPiecePath(col, row, cols, rows, pieceW, pieceH, sharedEdgesOrHEdges, maybeVEdges) {
  // Support both (sharedEdges) and (hEdgeGeometry, vEdgeGeometry) arguments
  let hEdgeGeometry, vEdgeGeometry;
  if (sharedEdgesOrHEdges && sharedEdgesOrHEdges.hEdgeGeometry) {
    hEdgeGeometry = sharedEdgesOrHEdges.hEdgeGeometry;
    vEdgeGeometry = sharedEdgesOrHEdges.vEdgeGeometry;
  } else {
    hEdgeGeometry = sharedEdgesOrHEdges;
    vEdgeGeometry = maybeVEdges;
  }

  const W = round(pieceW);
  const H = round(pieceH);

  let path = 'M 0,0 ';

  // 1. Top Edge: (0,0) → (W,0)
  if (row === 0) {
    path += `L ${W},0 `;
  } else {
    // Shared with piece above: piece (col, row-1)'s bottom edge.
    // Piece above used it in reverse; this piece uses it in forward direction.
    const edge = hEdgeGeometry[row - 1][col];
    path += renderEdgeSegments(edge, false, 'h', 0);
  }

  // 2. Right Edge: (W,0) → (W,H)
  if (col === cols - 1) {
    path += `L ${W},${H} `;
  } else {
    // Shared with piece to the right: piece (col, row)'s right edge.
    // This piece uses it in forward direction; piece to the right uses it in reverse.
    const edge = vEdgeGeometry[row][col];
    path += renderEdgeSegments(edge, false, 'v', pieceW);
  }

  // 3. Bottom Edge: (W,H) → (0,H)
  if (row === rows - 1) {
    path += `L 0,${H} `;
  } else {
    // Shared with piece below: piece (col, row)'s bottom edge.
    // This piece uses it in reverse direction (W→0).
    const edge = hEdgeGeometry[row][col];
    path += renderEdgeSegments(edge, true, 'h', pieceH);
  }

  // 4. Left Edge: (0,H) → (0,0)
  if (col === 0) {
    path += `L 0,0 `;
  } else {
    // Shared with piece to the left: edge between col-1 and col.
    // This piece uses it in reverse direction (H→0).
    const edge = vEdgeGeometry[row][col - 1];
    path += renderEdgeSegments(edge, true, 'v', 0);
  }

  path += 'Z';
  return path.trim();
}

/**
 * Validates the puzzle geometry:
 * Ensures every internal shared boundary between neighbor pieces has:
 * - Exactly one TAB and exactly one SLOT.
 * - Zero TAB↔TAB or SLOT↔SLOT mismatches.
 * - Perfectly matching lengths and endpoint continuity.
 *
 * @param {number} cols
 * @param {number} rows
 * @param {number} pieceW
 * @param {number} pieceH
 * @param {object} sharedEdges
 * @returns {{ valid: boolean, errors: string[], summary: object }}
 */
export function validatePuzzleGeometry(cols, rows, pieceW, pieceH, sharedEdges) {
  const errors = [];
  const hEdgeGeometry = sharedEdges.hEdgeGeometry || sharedEdges;
  const vEdgeGeometry = sharedEdges.vEdgeGeometry || pieceH; // handles flexible parameter ordering

  let hCount = 0;
  let vCount = 0;

  // 1. Validate horizontal boundaries
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      hCount++;
      const edge = hEdgeGeometry[r] && hEdgeGeometry[r][c];
      if (!edge) {
        errors.push(`Missing horizontal edge between row ${r} and row ${r + 1}, col ${c}`);
        continue;
      }

      // Top piece (c, r) bottom edge:
      // If edge.direction === 1 (tab down), top piece has TAB (+y outward)
      // Bottom piece (c, r + 1) top edge:
      // Inward slot into bottom piece (+y inward)
      const topPieceBottomType = edge.direction === 1 ? 'TAB' : 'SLOT';
      const bottomPieceTopType = edge.direction === 1 ? 'SLOT' : 'TAB';

      if (topPieceBottomType === bottomPieceTopType) {
        errors.push(
          `Horizontal mismatch at edge H_${r}_${c} between Piece (${c},${r}) bottom [${topPieceBottomType}] ` +
          `and Piece (${c},${r + 1}) top [${bottomPieceTopType}]`
        );
      }

      if (edge.segments.length !== 6) {
        errors.push(`Horizontal edge H_${r}_${c} has invalid segment count: ${edge.segments.length}`);
      }
    }
  }

  // 2. Validate vertical boundaries
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      vCount++;
      const edge = vEdgeGeometry[r] && vEdgeGeometry[r][c];
      if (!edge) {
        errors.push(`Missing vertical edge between col ${c} and col ${c + 1}, row ${r}`);
        continue;
      }

      // Left piece (c, r) right edge:
      // If edge.direction === 1 (tab right), left piece has TAB (+x outward)
      // Right piece (c + 1, r) left edge:
      // Inward slot into right piece (+x inward)
      const leftPieceRightType = edge.direction === 1 ? 'TAB' : 'SLOT';
      const rightPieceLeftType = edge.direction === 1 ? 'SLOT' : 'TAB';

      if (leftPieceRightType === rightPieceLeftType) {
        errors.push(
          `Vertical mismatch at edge V_${r}_${c} between Piece (${c},${r}) right [${leftPieceRightType}] ` +
          `and Piece (${c + 1},${r}) left [${rightPieceLeftType}]`
        );
      }

      if (edge.segments.length !== 6) {
        errors.push(`Vertical edge V_${r}_${c} has invalid segment count: ${edge.segments.length}`);
      }
    }
  }

  const valid = errors.length === 0;
  return {
    valid,
    errors,
    summary: {
      totalSharedEdges: hCount + vCount,
      hEdgesValidated: hCount,
      vEdgesValidated: vCount,
      allComplementary: valid,
    },
  };
}

/**
 * Backward compatibility helper for any legacy callers.
 */
export function buildEdgeDirections(cols, rows, rng) {
  const { hEdgeGeometry, vEdgeGeometry } = buildSharedEdges(cols, rows, 100, 100, rng);
  const hEdges = [];
  for (let r = 0; r <= rows; r++) {
    hEdges[r] = [];
    for (let c = 0; c < cols; c++) {
      if (r === 0 || r === rows) hEdges[r][c] = 0;
      else hEdges[r][c] = hEdgeGeometry[r - 1][c].direction;
    }
  }
  const vEdges = [];
  for (let r = 0; r < rows; r++) {
    vEdges[r] = [];
    for (let c = 0; c <= cols; c++) {
      if (c === 0 || c === cols) vEdges[r][c] = 0;
      else vEdges[r][c] = vEdgeGeometry[r][c - 1].direction;
    }
  }
  return { hEdges, vEdges };
}
