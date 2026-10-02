/**
 * GameContext.jsx
 *
 * Central state management for PuzzleCanvas.
 * Keeps ALL game state in one place; components subscribe via useGame().
 *
 * STATE FLOW:
 * home → loading → preview → playing → complete
 */

import { createContext, useContext, useReducer, useRef, useCallback } from 'react';
import { generatePuzzleImage, getErrorMessage } from '../services/gemini';
import { generatePuzzle, generatePuzzleId, centerPuzzleOrigin } from '../engine/puzzleGenerator';
import { validatePuzzle } from '../engine/puzzleValidator';
import { calculateScore } from '../engine/scoring';
import { storage, STORAGE_KEYS } from '../utils/storage';
import {
  rotateGroup,
  bringGroupToFront,
  resolveAllAttachments,
  moveGroup as moveGroupUtil,
} from '../engine/groupManager.js';
import { playSnapSound } from '../utils/audio.js';

// ---------------------------------------------------------------------------
// Fallback placeholder images (used when Gemini fails / no API key)
// ---------------------------------------------------------------------------
const FALLBACK_IMAGES = [
  'https://picsum.photos/seed/nature1/800/600',
  'https://picsum.photos/seed/animals1/800/600',
  'https://picsum.photos/seed/space1/800/600',
  'https://picsum.photos/seed/fantasy1/800/600',
];

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------
const INITIAL_STATE = {
  screen: 'home',           // 'home' | 'loading' | 'preview' | 'playing' | 'complete'
  category: null,
  puzzle: null,
  imageData: null,           // { data: base64, mimeType } or { url: string } for fallback
  previewCountdown: 5,
  // Game stats
  startTime: null,
  elapsedSeconds: 0,
  moves: 0,
  rotations: 0,
  checkAttempts: 0,
  lastCheckResult: null,     // { correctCount, total, isComplete }
  finalScore: null,
  // Error
  error: null,
  isUsingFallback: false,
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------
function reducer(state, action) {
  switch (action.type) {
    case 'START_LOADING':
      return {
        ...INITIAL_STATE,
        screen: 'loading',
        category: action.category,
      };

    case 'IMAGE_READY':
      return {
        ...state,
        imageData: action.imageData,
        puzzle: action.puzzle,
        screen: 'preview',
        previewCountdown: 5,
        isUsingFallback: action.isUsingFallback || false,
      };

    case 'COUNTDOWN_TICK':
      return {
        ...state,
        previewCountdown: state.previewCountdown - 1,
      };

    case 'START_PLAYING':
      return {
        ...state,
        screen: 'playing',
        startTime: Date.now(),
        elapsedSeconds: 0,
        moves: 0,
        rotations: 0,
        checkAttempts: 0,
        lastCheckResult: null,
        finalScore: null,
      };

    case 'TICK':
      return { ...state, elapsedSeconds: action.seconds };

    case 'UPDATE_PIECE': {
      if (!state.puzzle) return state;
      const pieces = state.puzzle.pieces.map((p) =>
        p.id === action.piece.id ? action.piece : p
      );
      return {
        ...state,
        puzzle: { ...state.puzzle, pieces },
        moves: action.countMove ? state.moves + 1 : state.moves,
      };
    }

    case 'MOVE_GROUP': {
      if (!state.puzzle) return state;
      const pieces = moveGroupUtil(
        action.groupId,
        action.deltaX,
        action.deltaY,
        action.initialPositions,
        state.puzzle.pieces
      );
      return {
        ...state,
        puzzle: { ...state.puzzle, pieces },
        moves: action.countMove ? state.moves + 1 : state.moves,
      };
    }

    case 'UPDATE_PIECES': {
      if (!state.puzzle) return state;
      return {
        ...state,
        puzzle: { ...state.puzzle, pieces: action.pieces },
        moves: action.countMove ? state.moves + 1 : state.moves,
      };
    }

    case 'ROTATE_PIECE': {
      if (!state.puzzle) return state;
      const targetPiece = state.puzzle.pieces.find((p) => p.id === action.pieceId);
      if (!targetPiece) return state;

      // Rotate the entire group that this piece belongs to
      const pieces = targetPiece.groupId
        ? rotateGroup(targetPiece.groupId, action.delta, state.puzzle.pieces)
        : state.puzzle.pieces.map((p) => {
            if (p.id !== action.pieceId) return p;
            const newRot = ((p.currentRotation + action.delta) % 360 + 360) % 360;
            return { ...p, currentRotation: newRot };
          });

      return {
        ...state,
        puzzle: { ...state.puzzle, pieces },
        rotations: state.rotations + 1,
      };
    }

    case 'BRING_TO_FRONT': {
      if (!state.puzzle) return state;
      const targetPiece = state.puzzle.pieces.find((p) => p.id === action.pieceId);
      if (!targetPiece) return state;

      // Bring the entire group of pieces to front together
      const pieces = targetPiece.groupId
        ? bringGroupToFront(targetPiece.groupId, state.puzzle.pieces)
        : state.puzzle.pieces.map((p) => {
            const maxZ = Math.max(...state.puzzle.pieces.map((x) => x.zIndex));
            return p.id === action.pieceId ? { ...p, zIndex: maxZ + 1 } : p;
          });

      return { ...state, puzzle: { ...state.puzzle, pieces } };
    }

    case 'CHECK_RESULT':
      return {
        ...state,
        checkAttempts: state.checkAttempts + 1,
        lastCheckResult: action.result,
      };

    case 'COMPLETE': {
      const score = calculateScore({
        secondsElapsed: state.elapsedSeconds,
        moves: state.moves,
        rotations: state.rotations,
        checkAttempts: state.checkAttempts + 1,
        correctCount: action.result.correctCount,
        totalPieces: action.result.total,
      });
      return {
        ...state,
        screen: 'complete',
        finalScore: score,
        lastCheckResult: action.result,
        checkAttempts: state.checkAttempts + 1,
      };
    }

    case 'ERROR':
      return { ...state, screen: 'home', error: action.message };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    case 'GO_HOME':
      return { ...INITIAL_STATE };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);

  // -------------------------------------------------------------------------
  // Start a new puzzle for the selected category
  // -------------------------------------------------------------------------
  const startPuzzle = useCallback(async (category, canvasW, canvasH) => {
    dispatch({ type: 'START_LOADING', category });

    // Always generate a fresh puzzle — never restore an old image.
    // The user requested that every "New Puzzle" produces a completely new
    // AI-generated image with a different scene, even within the same category.
    // We still write to localStorage so an in-progress game can be crash-recovered
    // within the same browser tab session, but we never READ the cache here to
    // skip the Gemini call.
    const puzzleId = generatePuzzleId(category);
    let imageData = null;
    let isUsingFallback = false;

    try {
      // Pass puzzleId so gemini.js can seed-pick a unique scene variant
      imageData = await generatePuzzleImage(category, puzzleId);
    } catch (err) {
      // Fall back to placeholder image — do NOT throw, do NOT retry
      console.warn('Gemini image generation failed, using fallback:', err.message);
      const fallbackUrl = FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)];
      imageData = { url: fallbackUrl, isFallback: true };
      isUsingFallback = true;
    }

    // Generate puzzle layout
    const rawPuzzle = generatePuzzle(category, puzzleId, canvasW, canvasH);
    const puzzle = centerPuzzleOrigin(rawPuzzle, canvasW, canvasH);

    // Cache to localStorage for crash recovery during THIS session only
    storage.set(STORAGE_KEYS.ACTIVE_PUZZLE, { ...puzzle, createdAt: Date.now(), isUsingFallback });
    storage.set(STORAGE_KEYS.PUZZLE_IMAGE, imageData);

    dispatch({ type: 'IMAGE_READY', imageData, puzzle, isUsingFallback });
  }, []);

  // -------------------------------------------------------------------------
  // Begin gameplay (called after countdown ends)
  // -------------------------------------------------------------------------
  const startPlaying = useCallback(() => {
    dispatch({ type: 'START_PLAYING' });

    // Start game timer
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      dispatch({ type: 'TICK', seconds: Math.floor((Date.now() - startTime) / 1000) });
    }, 1000);

    // Save puzzle state to localStorage
    storage.set(STORAGE_KEYS.PUZZLE_STATE, { startedAt: Date.now() });
  }, []);

  // -------------------------------------------------------------------------
  // Start countdown during preview
  // -------------------------------------------------------------------------
  const startCountdown = useCallback((onDone) => {
    let count = 5;
    countdownRef.current = setInterval(() => {
      count--;
      dispatch({ type: 'COUNTDOWN_TICK' });
      if (count <= 0) {
        clearInterval(countdownRef.current);
        onDone();
      }
    }, 1000);
  }, []);

  // -------------------------------------------------------------------------
  // Move a piece
  // -------------------------------------------------------------------------
  const movePiece = useCallback((piece, newX, newY) => {
    dispatch({
      type: 'UPDATE_PIECE',
      piece: { ...piece, currentX: newX, currentY: newY },
      countMove: true,
    });
  }, []);

  // -------------------------------------------------------------------------
  // Move an entire group of pieces
  // -------------------------------------------------------------------------
  const moveGroup = useCallback((groupId, deltaX, deltaY, initialPositions, countMove = false) => {
    dispatch({
      type: 'MOVE_GROUP',
      groupId,
      deltaX,
      deltaY,
      initialPositions,
      countMove,
    });
  }, []);

  // -------------------------------------------------------------------------
  // Check and physically attach any neighbor pieces / groups
  // -------------------------------------------------------------------------
  const attachGroup = useCallback((groupId) => {
    if (!state.puzzle) return { attached: false, mergedPieceIds: [] };
    const result = resolveAllAttachments(groupId, state.puzzle.pieces);
    if (result.attached) {
      dispatch({
        type: 'UPDATE_PIECES',
        pieces: result.pieces,
        countMove: true,
      });
      playSnapSound();
    }
    return result;
  }, [state.puzzle]);

  // -------------------------------------------------------------------------
  // Rotate selected piece
  // -------------------------------------------------------------------------
  const rotatePiece = useCallback((pieceId, direction = 1) => {
    dispatch({ type: 'ROTATE_PIECE', pieceId, delta: direction * 90 });
  }, []);

  // -------------------------------------------------------------------------
  // Bring piece to front
  // -------------------------------------------------------------------------
  const bringToFront = useCallback((pieceId) => {
    dispatch({ type: 'BRING_TO_FRONT', pieceId });
  }, []);

  // -------------------------------------------------------------------------
  // Check puzzle
  // -------------------------------------------------------------------------
  const checkPuzzle = useCallback((puzzle) => {
    const result = validatePuzzle(puzzle.pieces, puzzle);

    if (result.isComplete) {
      clearInterval(timerRef.current);
      dispatch({ type: 'COMPLETE', result });
      storage.remove(STORAGE_KEYS.ACTIVE_PUZZLE);
      storage.remove(STORAGE_KEYS.PUZZLE_IMAGE);
    } else {
      dispatch({ type: 'CHECK_RESULT', result });
    }

    return result;
  }, []);

  // -------------------------------------------------------------------------
  // Go home / quit
  // -------------------------------------------------------------------------
  const goHome = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(countdownRef.current);
    storage.remove(STORAGE_KEYS.ACTIVE_PUZZLE);
    storage.remove(STORAGE_KEYS.PUZZLE_IMAGE);
    dispatch({ type: 'GO_HOME' });
  }, []);

  // -------------------------------------------------------------------------
  // Play again (same category)
  // -------------------------------------------------------------------------
  const playAgain = useCallback((canvasW, canvasH) => {
    clearInterval(timerRef.current);
    clearInterval(countdownRef.current);
    storage.remove(STORAGE_KEYS.ACTIVE_PUZZLE);
    storage.remove(STORAGE_KEYS.PUZZLE_IMAGE);
    // Read category from the stateRef pattern to avoid stale closure
    // state.category is captured at time of useCallback creation, but since
    // we call this from the complete screen, it should be valid
    const cat = state.category;
    if (cat) {
      startPuzzle(cat, canvasW, canvasH);
    }
  }, [state.category, startPuzzle]);

  const clearError = useCallback(() => dispatch({ type: 'CLEAR_ERROR' }), []);

  const value = {
    state,
    startPuzzle,
    startPlaying,
    startCountdown,
    movePiece,
    moveGroup,
    attachGroup,
    rotatePiece,
    bringToFront,
    checkPuzzle,
    goHome,
    playAgain,
    clearError,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
