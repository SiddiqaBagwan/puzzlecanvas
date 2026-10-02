/**
 * scoring.js
 *
 * Calculates puzzle score based on gameplay stats.
 * Formula is hidden from the player; only the final score is shown.
 */

const BASE_SCORE = 10000;

// Penalty rates
const PENALTIES = {
  secondsElapsed: 0.5,      // 0.5 pts per second
  moves: 3,                 // 3 pts per piece move
  rotations: 2,             // 2 pts per rotation
  checkAttempts: 150,       // 150 pts per extra check
};

/**
 * Calculate the final score.
 *
 * @param {object} stats
 * @param {number} stats.secondsElapsed
 * @param {number} stats.moves
 * @param {number} stats.rotations
 * @param {number} stats.checkAttempts
 * @param {number} stats.correctCount
 * @param {number} stats.totalPieces
 * @returns {number} score (min 0)
 */
export function calculateScore({ secondsElapsed, moves, rotations, checkAttempts, correctCount, totalPieces }) {
  let score = BASE_SCORE;

  score -= Math.floor(secondsElapsed * PENALTIES.secondsElapsed);
  score -= Math.floor(moves * PENALTIES.moves);
  score -= Math.floor(rotations * PENALTIES.rotations);
  score -= Math.floor(Math.max(0, checkAttempts - 1) * PENALTIES.checkAttempts);

  // Bonus for accuracy
  const accuracy = correctCount / totalPieces;
  if (accuracy === 1) score += 500; // perfect bonus

  return Math.max(0, Math.round(score));
}

/** Format seconds into MM:SS */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Format score with thousands separator */
export function formatScore(score) {
  return score.toLocaleString();
}
