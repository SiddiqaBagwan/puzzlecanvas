/**
 * PuzzlePiece.jsx
 *
 * Renders a single jigsaw piece using an SVG clip path over the puzzle image.
 * Handles pointer events for dragging (mouse, touch, stylus).
 *
 * IMPORTANT:
 * - Uses pointer events (not mouse events) for cross-device support
 * - Prevents default to stop mobile scroll while dragging
 * - Piece is positioned by its CENTER (currentX, currentY)
 * - The clip path is in piece-local coords (0,0 → pieceW×pieceH)
 *   but tabs extend slightly outside, so we use overflow:visible SVG
 */

import { useRef, useCallback, useId } from 'react';

export default function PuzzlePiece({
  piece,
  imageData,
  puzzle,
  isSelected,
  debugMode = false,
  isProximityCandidate = false,
  isRecentlyAttached = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) {
  const { id, currentX, currentY, currentRotation, clipPath, pieceW, pieceH,
          imageCropX, imageCropY, zIndex } = piece;
  const { originX, originY, puzzleW, puzzleH } = puzzle;

  const clipId = `clip-${id}`;

  // Image src
  const imgSrc = imageData?.url
    ? imageData.url
    : imageData?.data
    ? `data:${imageData.mimeType || 'image/png'};base64,${imageData.data}`
    : null;

  // How much the piece extends beyond its bounding box due to tabs
  // We add generous padding so tabs are never clipped by SVG overflow
  const PAD = Math.max(pieceW, pieceH) * 0.35;

  // Total SVG dimensions
  const svgW = pieceW + PAD * 2;
  const svgH = pieceH + PAD * 2;

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    onPointerDown(e, piece);
  }, [onPointerDown, piece]);

  return (
    <div
      className={`puzzle-piece-wrapper ${isSelected ? 'selected' : ''}`}
      style={{
        position: 'absolute',
        left: currentX - pieceW / 2 - PAD,
        top: currentY - pieceH / 2 - PAD,
        width: svgW,
        height: svgH,
        zIndex: isSelected ? 9999 : zIndex,
        transform: `rotate(${currentRotation}deg)`,
        transformOrigin: `${svgW / 2}px ${svgH / 2}px`,
        cursor: 'grab',
        willChange: 'transform',
        // Selected / Proximity / Snap glow filters
        filter: isRecentlyAttached
          ? 'drop-shadow(0 0 16px rgba(56, 189, 248, 0.95))'
          : isProximityCandidate
          ? 'drop-shadow(0 0 12px rgba(52, 211, 153, 0.85))'
          : isSelected
          ? 'drop-shadow(0 8px 24px rgba(0,0,0,0.55))'
          : 'drop-shadow(0 2px 6px rgba(0,0,0,0.30))',
        transition: 'filter 0.15s ease',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        overflow="visible"
        style={{ display: 'block', overflow: 'visible' }}
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clipId}>
            {/* Translate path by PAD so piece occupies PAD..PAD+pieceW */}
            <path d={translatePath(clipPath, PAD, PAD)} />
          </clipPath>
        </defs>

        {/* Piece background (slight tint for depth) */}
        <path
          d={translatePath(clipPath, PAD, PAD)}
          fill="rgba(30,30,50,0.15)"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.5"
        />

        {/* Image clipped to piece shape */}
        {imgSrc && (
          <image
            href={imgSrc}
            x={PAD - imageCropX}
            y={PAD - imageCropY}
            width={puzzleW}
            height={puzzleH}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="none"
            crossOrigin="anonymous"
          />
        )}

        {/* Piece border overlay for jigsaw look */}
        <path
          d={translatePath(clipPath, PAD, PAD)}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Selected highlight ring */}
        {isSelected && (
          <path
            d={translatePath(clipPath, PAD, PAD)}
            fill="rgba(130,100,255,0.12)"
            stroke="rgba(160,130,255,0.7)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        )}

        {/* Attachment snap flash ring */}
        {isRecentlyAttached && (
          <path
            d={translatePath(clipPath, PAD, PAD)}
            fill="rgba(56, 189, 248, 0.18)"
            stroke="#38bdf8"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        )}

        {/* Proximity magnetic candidate glow */}
        {isProximityCandidate && (
          <path
            d={translatePath(clipPath, PAD, PAD)}
            fill="rgba(52, 211, 153, 0.12)"
            stroke="#34d399"
            strokeWidth="2.5"
            strokeDasharray="6 3"
            strokeLinejoin="round"
          />
        )}

        {/* Debug mode: outline + label */}
        {debugMode && (
          <>
            <path
              d={translatePath(clipPath, PAD, PAD)}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2"
              strokeDasharray="4 2"
              strokeLinejoin="round"
            />
            <rect
              x={PAD + pieceW / 2 - 28}
              y={PAD + pieceH / 2 - 12}
              width="56"
              height="24"
              rx="4"
              fill="rgba(15, 23, 42, 0.85)"
              stroke="#06b6d4"
              strokeWidth="1"
            />
            <text
              x={PAD + pieceW / 2}
              y={PAD + pieceH / 2 + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#38bdf8"
              fontSize="11"
              fontWeight="bold"
              fontFamily="monospace"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              #{id} [{piece.row},{piece.col}]
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

/**
 * Translate all coordinates in an SVG path string by (dx, dy).
 * Handles M, L, C, Z commands produced by buildPiecePath.
 */
function translatePath(pathStr, dx, dy) {
  // Replace all numeric coordinate pairs (x,y) that appear in path commands
  return pathStr.replace(
    /([MLCZ])\s*([^MLCZ]*)/g,
    (match, cmd, coords) => {
      if (cmd === 'Z') return 'Z ';
      const translated = coords.replace(
        /([-\d.e+]+),([-\d.e+]+)/g,
        (m, x, y) => `${parseFloat(x) + dx},${parseFloat(y) + dy}`
      );
      return `${cmd} ${translated}`;
    }
  );
}

