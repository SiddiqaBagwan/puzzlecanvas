/**
 * ResultModal.jsx
 * Shown when puzzle is complete — displays time, score, moves, and play-again options.
 */

import { useEffect, useRef } from 'react';
import { formatTime, formatScore } from '../engine/scoring';

export default function ResultModal({ state, onPlayAgain, onNewCategory }) {
  const { finalScore, elapsedSeconds, moves, rotations, checkAttempts, lastCheckResult } = state;
  const dialogRef = useRef(null);

  useEffect(() => {
    // Focus the modal for accessibility
    dialogRef.current?.focus();
  }, []);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Puzzle complete!">
      <div className="result-modal" ref={dialogRef} tabIndex={-1}>
        {/* Confetti particles */}
        <div className="confetti-container" aria-hidden="true">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="confetti-dot" style={{
              '--delay': `${i * 0.1}s`,
              '--x': `${(i * 37) % 100}%`,
              '--color': `hsl(${i * 18}, 80%, 60%)`,
            }} />
          ))}
        </div>

        <div className="result-star">🌟</div>
        <h2 className="result-title">PUZZLE COMPLETE!</h2>
        <p className="result-subtitle">You solved it!</p>

        <div className="result-stats">
          <div className="result-stat">
            <span className="result-stat-icon">⏱</span>
            <span className="result-stat-label">TIME</span>
            <span className="result-stat-value">{formatTime(elapsedSeconds)}</span>
          </div>
          <div className="result-stat highlight">
            <span className="result-stat-icon">⭐</span>
            <span className="result-stat-label">SCORE</span>
            <span className="result-stat-value score-value">{formatScore(finalScore)}</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-icon">🤚</span>
            <span className="result-stat-label">MOVES</span>
            <span className="result-stat-value">{moves}</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-icon">🔄</span>
            <span className="result-stat-label">ROTATIONS</span>
            <span className="result-stat-value">{rotations}</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-icon">🎯</span>
            <span className="result-stat-label">ACCURACY</span>
            <span className="result-stat-value">100%</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-icon">🔍</span>
            <span className="result-stat-label">CHECKS</span>
            <span className="result-stat-value">{checkAttempts}</span>
          </div>
        </div>

        <div className="result-actions">
          <button
            className="result-btn primary"
            onClick={onPlayAgain}
            id="btn-play-again"
            aria-label="Play again with same category"
          >
            🔄 PLAY AGAIN
          </button>
          <button
            className="result-btn secondary"
            onClick={onNewCategory}
            id="btn-new-category"
            aria-label="Choose a new category"
          >
            🏠 NEW CATEGORY
          </button>
        </div>
      </div>
    </div>
  );
}
