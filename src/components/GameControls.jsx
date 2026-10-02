/**
 * GameControls.jsx
 * Bottom control bar: Rotate left/right, Check Puzzle, Quit.
 */

export default function GameControls({
  selectedPieceId,
  onRotateLeft,
  onRotateRight,
  onCheck,
  onQuit,
  lastCheckResult,
  checkAttempts,
}) {
  return (
    <div className="game-controls" role="toolbar" aria-label="Game controls">
      {/* Rotate controls */}
      <div className="controls-group rotate-group">
        <button
          className="ctrl-btn rotate-btn"
          onClick={onRotateLeft}
          disabled={selectedPieceId === null}
          aria-label="Rotate piece left 90 degrees"
          id="btn-rotate-left"
          title="Rotate Left (Q)"
        >
          ↺
        </button>
        <span className="ctrl-label">ROTATE</span>
        <button
          className="ctrl-btn rotate-btn"
          onClick={onRotateRight}
          disabled={selectedPieceId === null}
          aria-label="Rotate piece right 90 degrees"
          id="btn-rotate-right"
          title="Rotate Right (E)"
        >
          ↻
        </button>
      </div>

      {/* Check result mini display */}
      {lastCheckResult && !lastCheckResult.isComplete && (
        <div className="check-result-mini" aria-live="polite">
          <span className="check-result-num">
            {lastCheckResult.correctCount}
            <span className="check-result-sep">/</span>
            {lastCheckResult.total}
          </span>
          <span className="check-result-label">correct</span>
        </div>
      )}

      {/* Check Puzzle */}
      <button
        className="ctrl-btn check-btn"
        onClick={onCheck}
        id="btn-check-puzzle"
        aria-label="Check puzzle placement"
      >
        <span className="check-btn-icon">✓</span>
        CHECK PUZZLE
        {checkAttempts > 0 && (
          <span className="check-attempts-badge">{checkAttempts}</span>
        )}
      </button>

      {/* Quit */}
      <button
        className="ctrl-btn quit-btn"
        onClick={onQuit}
        id="btn-quit"
        aria-label="Quit and return to home"
        title="Quit"
      >
        ✕ QUIT
      </button>
    </div>
  );
}
