/**
 * GameBoard.jsx
 *
 * The main puzzle playing area.
 * Manages the free-form canvas, piece dragging (via pointer events),
 * keyboard shortcuts, and wires up controls.
 *
 * Design principles:
 * - NO auto-snap, NO ghost outlines, NO placement hints
 * - Pieces go where the player releases them
 * - Touch/mouse/stylus all work via pointer events
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { findProximityHint, getGroupSummary } from '../engine/groupManager.js';
import PuzzlePiece from './PuzzlePiece';
import GameHeader from './GameHeader';
import GameControls from './GameControls';
import ResultModal from './ResultModal';

export default function GameBoard() {
  const { state, moveGroup, attachGroup, rotatePiece, bringToFront, checkPuzzle, goHome, playAgain } = useGame();
  const { puzzle, imageData, category, elapsedSeconds, moves, rotations, checkAttempts, lastCheckResult, screen } = state;

  const canvasRef = useRef(null);
  const [selectedPieceId, setSelectedPieceId] = useState(null);
  const [proximityHintPieceId, setProximityHintPieceId] = useState(null);
  const [snappedPieceIds, setSnappedPieceIds] = useState([]);

  const isDebugEnv = import.meta.env.VITE_DEBUG_PUZZLE === 'true';
  const [debugMode, setDebugMode] = useState(isDebugEnv);

  // Drag state stored in a ref (avoids re-renders during drag)
  const drag = useRef({
    active: false,
    pieceId: null,
    groupId: null,
    pointerId: null,
    startPointerX: 0,
    startPointerY: 0,
    initialPositions: [],
  });

  // Correct piece count from last check
  const correctCount = lastCheckResult?.correctCount ?? 0;

  // ---------------------------------------------------------------------------
  // Pointer Events — Group Drag handling
  // ---------------------------------------------------------------------------

  const handlePointerDown = useCallback((e, piece) => {
    e.preventDefault();
    e.stopPropagation();

    // Set pointer capture on the canvas so we receive events even if pointer leaves
    canvasRef.current?.setPointerCapture(e.pointerId);

    // Snapshot positions for all pieces in this piece's group
    const groupId = piece.groupId || `group-${piece.id}`;
    const groupPieces = puzzle.pieces.filter((p) => p.groupId === groupId);

    drag.current = {
      active: true,
      pieceId: piece.id,
      groupId,
      pointerId: e.pointerId,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      initialPositions: groupPieces.map((p) => ({
        id: p.id,
        startX: p.currentX,
        startY: p.currentY,
      })),
    };

    setSelectedPieceId(piece.id);
    bringToFront(piece.id);
  }, [puzzle, bringToFront]);

  const handlePointerMove = useCallback((e) => {
    if (!drag.current.active) return;
    if (e.pointerId !== drag.current.pointerId) return;
    e.preventDefault();

    const dx = e.clientX - drag.current.startPointerX;
    const dy = e.clientY - drag.current.startPointerY;

    // Move all pieces in the group together
    moveGroup(drag.current.groupId, dx, dy, drag.current.initialPositions);

    // Subtle proximity hint: check if any piece in group is close to its matching neighbor
    const hint = findProximityHint(drag.current.groupId, puzzle.pieces);
    setProximityHintPieceId(hint ? hint.pieceA.id : null);
  }, [puzzle, moveGroup]);

  const handlePointerUp = useCallback((e) => {
    if (!drag.current.active) return;
    const gid = drag.current.groupId;
    drag.current.active = false;
    drag.current.pieceId = null;
    setProximityHintPieceId(null);

    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch (_) {}

    // Check and physically attach to any matching neighbor pieces or groups
    if (gid) {
      const result = attachGroup(gid);
      if (result && result.attached) {
        setSnappedPieceIds(result.mergedPieceIds);
        setTimeout(() => setSnappedPieceIds([]), 450);
      }
    }
  }, [attachGroup]);

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleKey = (e) => {
      if (selectedPieceId === null) return;
      if (e.key === 'q' || e.key === 'Q') rotatePiece(selectedPieceId, -1);
      if (e.key === 'e' || e.key === 'E') rotatePiece(selectedPieceId, 1);
      if (e.key === 'Escape') setSelectedPieceId(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedPieceId, rotatePiece]);

  // Deselect when clicking blank canvas area
  const handleCanvasClick = useCallback((e) => {
    if (e.target === canvasRef.current) {
      setSelectedPieceId(null);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------------------
  const handleRotateLeft = useCallback(() => {
    if (selectedPieceId !== null) rotatePiece(selectedPieceId, -1);
  }, [selectedPieceId, rotatePiece]);

  const handleRotateRight = useCallback(() => {
    if (selectedPieceId !== null) rotatePiece(selectedPieceId, 1);
  }, [selectedPieceId, rotatePiece]);

  const handleCheck = useCallback(() => {
    if (puzzle) checkPuzzle(puzzle);
  }, [puzzle, checkPuzzle]);

  const handlePlayAgain = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    playAgain(w, h);
  }, [playAgain]);

  if (!puzzle) return null;

  // In debug mode, position pieces in their solved positions with rotation 0
  const piecesToRender = debugMode
    ? puzzle.pieces.map((piece) => ({
        ...piece,
        currentX: puzzle.originX + piece.correctX,
        currentY: puzzle.originY + piece.correctY,
        currentRotation: 0,
      }))
    : puzzle.pieces;

  // Sort pieces by zIndex for render order
  const sortedPieces = [...piecesToRender].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div className="game-board">
      <GameHeader
        category={category}
        elapsedSeconds={elapsedSeconds}
        totalPieces={puzzle.totalPieces}
        correctCount={correctCount}
      />

      {/* Free-form puzzle canvas */}
      <div
        ref={canvasRef}
        className="puzzle-canvas"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={handleCanvasClick}
        style={{ touchAction: 'none' }}
        aria-label="Puzzle canvas — drag pieces to assemble the puzzle"
        role="application"
      >
        {/* Canvas background texture */}
        <div className="canvas-texture" aria-hidden="true" />

        {/* Subtle center crosshair hint (very faint, just for reference) */}
        <div className="canvas-center-hint" aria-hidden="true" />

        {/* Debug mode toggle button (accessible in DEV or when VITE_DEBUG_PUZZLE is set) */}
        {(isDebugEnv || import.meta.env.DEV) && (
          <button
            className="debug-assembled-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setDebugMode((prev) => !prev);
            }}
            title="Toggle Assembled Debug View"
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              zIndex: 10000,
              background: debugMode ? 'rgba(6, 182, 212, 0.9)' : 'rgba(15, 23, 42, 0.85)',
              color: debugMode ? '#021a24' : '#38bdf8',
              border: '1px solid #06b6d4',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            }}
          >
            <span>🧩</span>
            <span>Debug Assembled: {debugMode ? 'ON' : 'OFF'}</span>
          </button>
        )}

        {/* Connected groups indicator badge */}
        {puzzle && (
          <div
            className="groups-status-badge"
            style={{
              position: 'absolute',
              top: 14,
              left: 14,
              zIndex: 100,
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: '#94a3b8',
              backdropFilter: 'blur(8px)',
              pointerEvents: 'none',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>🔗</span>
            <span>
              {(() => {
                const summary = getGroupSummary(puzzle.pieces);
                if (summary.totalGroups === 1) {
                  return <strong style={{ color: '#34d399' }}>All Pieces Connected!</strong>;
                }
                return (
                  <>
                    <span>Groups: <strong style={{ color: '#f8fafc' }}>{summary.totalGroups}</strong></span>
                    {summary.largestGroupSize > 1 && (
                      <span style={{ color: '#38bdf8' }}> · Largest: {summary.largestGroupSize}</span>
                    )}
                  </>
                );
              })()}
            </span>
          </div>
        )}

        {/* Render all pieces */}
        {sortedPieces.map((piece) => {
          const selectedPiece = puzzle.pieces.find((p) => p.id === selectedPieceId);
          const isGroupSelected = selectedPiece ? selectedPiece.groupId === piece.groupId : false;

          return (
            <PuzzlePiece
              key={piece.id}
              piece={piece}
              imageData={imageData}
              puzzle={puzzle}
              isSelected={isGroupSelected}
              isProximityCandidate={proximityHintPieceId === piece.id}
              isRecentlyAttached={snappedPieceIds.includes(piece.id)}
              debugMode={debugMode}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
          );
        })}

        {/* Keyboard hint overlay */}
        {selectedPieceId !== null && (
          <div className="keyboard-hint" aria-hidden="true">
            Q/E to rotate · ESC to deselect
          </div>
        )}
      </div>

      <GameControls
        selectedPieceId={selectedPieceId}
        onRotateLeft={handleRotateLeft}
        onRotateRight={handleRotateRight}
        onCheck={handleCheck}
        onQuit={goHome}
        lastCheckResult={lastCheckResult}
        checkAttempts={checkAttempts}
      />

      {/* Completion modal */}
      {screen === 'complete' && (
        <ResultModal
          state={state}
          onPlayAgain={handlePlayAgain}
          onNewCategory={goHome}
        />
      )}
    </div>
  );
}
