/**
 * GameHeader.jsx
 * Top bar shown during gameplay: title, category, timer, piece count.
 */

import { formatTime } from '../engine/scoring';

export default function GameHeader({ category, elapsedSeconds, totalPieces, correctCount }) {
  return (
    <header className="game-header" role="banner">
      <div className="game-header-left">
        <span className="game-logo">🧩</span>
        <span className="game-title-small">PUZZLECANVAS</span>
      </div>

      <div className="game-header-center">
        <div className="stat-pill">
          <span className="stat-label">Category</span>
          <span className="stat-value">{category}</span>
        </div>
      </div>

      <div className="game-header-right">
        <div className="stat-pill" aria-label={`Time elapsed: ${formatTime(elapsedSeconds)}`}>
          <span className="stat-label">⏱</span>
          <span className="stat-value timer-value">{formatTime(elapsedSeconds)}</span>
        </div>
        <div className="stat-pill" aria-label={`${correctCount} of ${totalPieces} pieces correct`}>
          <span className="stat-label">🧩</span>
          <span className="stat-value">{correctCount}/{totalPieces}</span>
        </div>
      </div>
    </header>
  );
}
