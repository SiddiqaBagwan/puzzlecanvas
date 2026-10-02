/**
 * PreviewScreen.jsx
 * Shows the generated image for 5 seconds with countdown, then starts the puzzle.
 */

import { useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';

export default function PreviewScreen() {
  const { state, startCountdown, startPlaying } = useGame();
  const { imageData, category, previewCountdown, isUsingFallback } = state;
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    startCountdown(() => {
      startPlaying();
    });
  }, [startCountdown, startPlaying]);

  // Build image src
  const imgSrc = imageData?.url
    ? imageData.url
    : imageData?.data
    ? `data:${imageData.mimeType || 'image/png'};base64,${imageData.data}`
    : null;

  return (
    <div className="preview-screen">
      <div className="preview-overlay-top">
        <div className="preview-badge">
          <span>📸</span>
          <span>MEMORIZE THIS IMAGE</span>
        </div>
        {isUsingFallback && (
          <div className="fallback-notice">Using placeholder image (Gemini unavailable)</div>
        )}
      </div>

      <div className="preview-image-wrapper">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={`Puzzle image for category ${category}`}
            className="preview-image"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="preview-no-image">No image available</div>
        )}

        <div className="preview-vignette" />
      </div>

      <div className="preview-overlay-bottom">
        <div className="preview-countdown-wrap">
          <div
            className="preview-countdown"
            aria-live="polite"
            aria-label={`Puzzle starts in ${previewCountdown} seconds`}
          >
            {previewCountdown}
          </div>
          <p className="preview-countdown-label">Puzzle starts in…</p>
        </div>

        <div className="preview-category-badge">
          Category: <strong>{category}</strong>
        </div>
      </div>
    </div>
  );
}
