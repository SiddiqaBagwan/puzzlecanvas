/**
 * puzzleGenerator.js
 *
 * Creates the full puzzle state from a category and image.
 * Separates all generation logic from React components.
 *
 * Piece layout: 6 columns × 4 rows = 24 pieces
 */

import { createRng, seedFromString } from '../utils/random.js';
import { buildSharedEdges, buildPiecePath, validatePuzzleGeometry } from './jigsawGeometry.js';

// Default difficulty settings — easily configurable for future modes
export const DIFFICULTY = {
  easy:   { cols: 4, rows: 3 },   // 12 pieces
  normal: { cols: 6, rows: 4 },   // 24 pieces
  hard:   { cols: 8, rows: 6 },   // 48 pieces
  insane: { cols: 10, rows: 10 }, // 100 pieces
};

const DEFAULT_DIFFICULTY = 'normal';

/**
 * Generate a unique puzzle ID from category + timestamp.
 */
export function generatePuzzleId(category) {
  return `${category}_${Date.now()}`;
}

/**
 * Generate the full puzzle data structure.
 *
 * @param {string} category - Selected category name
 * @param {string} puzzleId - Unique puzzle identifier (used as seed base)
 * @param {number} canvasW - Canvas width in px
 * @param {number} canvasH - Canvas height in px
 * @param {string} difficulty - 'normal' | 'easy' | 'hard' | 'insane'
 * @returns {object} puzzle state
 */
export function generatePuzzle(category, puzzleId, canvasW, canvasH, difficulty = DEFAULT_DIFFICULTY) {
  const { cols, rows } = DIFFICULTY[difficulty] || DIFFICULTY[DEFAULT_DIFFICULTY];
  const totalPieces = cols * rows;

  // Seeded RNG for deterministic layout
  const seed = seedFromString(puzzleId);
  const rng = createRng(seed);

  // The "solved" image fits in an area leaving margin for scattered pieces
  // We keep puzzle pieces at a comfortable size
  const MARGIN = 60;
  const maxPuzzleW = Math.min(canvasW * 0.75, canvasW - MARGIN * 2);
  const maxPuzzleH = Math.min(canvasH * 0.75, canvasH - MARGIN * 2);

  // Keep 4:3 aspect to match image
  const aspectRatio = 4 / 3;
  let puzzleW = maxPuzzleW;
  let puzzleH = puzzleW / aspectRatio;
  if (puzzleH > maxPuzzleH) {
    puzzleH = maxPuzzleH;
    puzzleW = puzzleH * aspectRatio;
  }

  const pieceW = puzzleW / cols;
  const pieceH = puzzleH / rows;

  // Build complementary shared edges (each internal edge generated ONCE)
  const geometryRng = createRng(seed + 1);
  const sharedEdges = buildSharedEdges(cols, rows, pieceW, pieceH, geometryRng);

  // Strictly validate geometry before piece generation
  const validation = validatePuzzleGeometry(cols, rows, pieceW, pieceH, sharedEdges);
  if (!validation.valid) {
    console.error('[PuzzleGenerator] Geometry validation failed:', validation.errors);
    throw new Error('Puzzle geometry validation failed: ' + validation.errors.join('; '));
  } else {
    console.log(`[PuzzleGenerator] Geometry validated: ${validation.summary.totalSharedEdges} shared edges are 100% complementary.`);
  }

  // Build pieces
  const pieces = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = row * cols + col;

      // Correct position (center of piece in canvas space, if puzzle were solved at 0,0)
      const correctX = col * pieceW + pieceW / 2;
      const correctY = row * pieceH + pieceH / 2;

      // Build the clip path for this piece (local coordinates) from shared edges
      const clipPath = buildPiecePath(col, row, cols, rows, pieceW, pieceH, sharedEdges);

      // Random scatter position (avoiding UI bars at top/bottom)
      const scatterX = rng() * (canvasW - pieceW) + pieceW / 2;
      const scatterY = rng() * (canvasH - pieceH - 80) + pieceH / 2 + 60;

      // Random rotation: 0, 90, 180, or 270 degrees
      const rotations = [0, 90, 180, 270];
      const randomRotation = rotations[Math.floor(rng() * 4)];

      pieces.push({
        id,
        row,
        col,
        // "Correct" position is expressed as offset from puzzle origin (top-left corner)
        correctX,
        correctY,
        correctRotation: 0, // always 0 — the correct orientation
        // Current (scattered) position and rotation
        currentX: scatterX,
        currentY: scatterY,
        currentRotation: randomRotation,
        // Geometry
        clipPath,
        pieceW,
        pieceH,
        // Image crop: which section of the source image this piece shows
        imageCropX: col * pieceW,
        imageCropY: row * pieceH,
        // Group metadata for physical piece joining
        groupId: `group-${id}`,
        neighbors: {
          top: row > 0 ? (row - 1) * cols + col : null,
          bottom: row < rows - 1 ? (row + 1) * cols + col : null,
          left: col > 0 ? row * cols + (col - 1) : null,
          right: col < cols - 1 ? row * cols + (col + 1) : null,
        },
        // z-index
        zIndex: id,
      });
    }
  }

  return {
    id: puzzleId,
    category,
    difficulty,
    cols,
    rows,
    totalPieces,
    puzzleW,
    puzzleH,
    pieceW,
    pieceH,
    pieces,
    // The puzzle origin in canvas space — where pieces would be if solved
    // This gets set to center the solved puzzle on canvas
    originX: 0,
    originY: 0,
    createdAt: Date.now(),
  };
}

/**
 * Center the puzzle origin so the solved image would sit in the middle of the canvas.
 */
export function centerPuzzleOrigin(puzzle, canvasW, canvasH) {
  const originX = (canvasW - puzzle.puzzleW) / 2;
  const originY = (canvasH - puzzle.puzzleH) / 2;
  return { ...puzzle, originX, originY };
}
