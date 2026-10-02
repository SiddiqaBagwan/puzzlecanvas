/**
 * puzzleValidator.js
 *
 * Evaluates whether each piece is correctly placed.
 *
 * Rules:
 * - Position tolerance: piece center must be within POSITION_TOLERANCE px
 *   of its correct position (relative to puzzle origin).
 * - Rotation must be exactly 0° (with 10° tolerance for future analog rotation).
 *
 * Does NOT reveal correct positions to the UI — only counts.
 */

// How far (in px) a piece center can be from correct and still count as placed
const POSITION_TOLERANCE = 40;

// Rotation tolerance in degrees
const ROTATION_TOLERANCE = 10;

/**
 * Normalize rotation to [0, 360)
 */
function normalizeAngle(deg) {
  return ((deg % 360) + 360) % 360;
}

/**
 * Check if two angles are "close enough" (within tolerance).
 * Handles wrap-around (e.g. 350° vs 10°).
 */
function anglesMatch(a, b, tolerance = ROTATION_TOLERANCE) {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return diff <= tolerance || diff >= 360 - tolerance;
}

/**
 * Validate all pieces against their correct positions.
 *
 * @param {object[]} pieces - Current piece states
 * @param {object} puzzle - Puzzle metadata (originX, originY, etc.)
 * @returns {{ correctCount: number, total: number, results: object[] }}
 */
export function validatePuzzle(pieces, puzzle) {
  const { originX, originY } = puzzle;
  let correctCount = 0;

  const results = pieces.map((piece) => {
    // The correct canvas position = puzzle origin + piece's correct offset
    const targetX = originX + piece.correctX;
    const targetY = originY + piece.correctY;

    const dx = piece.currentX - targetX;
    const dy = piece.currentY - targetY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const positionOk = distance <= POSITION_TOLERANCE;
    const rotationOk = anglesMatch(piece.currentRotation, piece.correctRotation);
    const isCorrect = positionOk && rotationOk;

    if (isCorrect) correctCount++;

    return {
      id: piece.id,
      isCorrect,
      positionOk,
      rotationOk,
      distance: Math.round(distance),
    };
  });

  return {
    correctCount,
    total: pieces.length,
    results,
    isComplete: correctCount === pieces.length,
  };
}
