/**
 * Home.jsx
 * Landing screen — shows title, 8 category cards, and Surprise Me button.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import CategoryCard from './CategoryCard';

const CATEGORIES = [
  { name: 'Nature',       icon: '🌿', description: 'Mountains, lakes & dramatic skies' },
  { name: 'Animals',      icon: '🐾', description: 'Wildlife from around the world' },
  { name: 'Space',        icon: '🚀', description: 'Nebulae, planets & the cosmos' },
  { name: 'Fantasy',      icon: '🧙', description: 'Magic, dragons & enchanted worlds' },
  { name: 'Cartoon',      icon: '🎨', description: 'Original colorful cartoon scenes' },
  { name: 'Food',         icon: '🍕', description: 'Gourmet feasts & culinary art' },
  { name: 'Travel',       icon: '🌍', description: 'Iconic landmarks & destinations' },
  { name: 'Everyday Life',icon: '☕', description: 'Cozy moments & neighborhood charm' },
];

export default function Home() {
  const { startPuzzle, state, clearError } = useGame();
  const [selected, setSelected] = useState(null);
  const [surpriseAnim, setSurpriseAnim] = useState(false);
  const canvasRef = useRef(null);

  const handleSelect = useCallback((categoryName) => {
    setSelected(categoryName);
    clearError();
    const w = window.innerWidth;
    const h = window.innerHeight;
    startPuzzle(categoryName, w, h);
  }, [startPuzzle, clearError]);

  const handleSurprise = useCallback(() => {
    setSurpriseAnim(true);
    setTimeout(() => setSurpriseAnim(false), 600);
    const random = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    handleSelect(random.name);
  }, [handleSelect]);

  return (
    <div className="home-screen">
      {/* Animated background blobs */}
      <div className="bg-blob blob-1" />
      <div className="bg-blob blob-2" />
      <div className="bg-blob blob-3" />

      <header className="home-header">
        <div className="logo-mark">🧩</div>
        <h1 className="home-title">PUZZLECANVAS</h1>
        <p className="home-subtitle">Build the picture. Find your way.</p>
      </header>

      {state.error && (
        <div className="error-banner" role="alert">
          <span>⚠️ {state.error}</span>
          <button onClick={clearError} aria-label="Dismiss error">✕</button>
        </div>
      )}

      <main className="home-main">
        <h2 className="section-title">CHOOSE YOUR WORLD</h2>

        <div className="categories-grid" role="list">
          {CATEGORIES.map((cat) => (
            <CategoryCard
              key={cat.name}
              category={cat.name}
              icon={cat.icon}
              description={cat.description}
              isSelected={selected === cat.name}
              onClick={() => handleSelect(cat.name)}
            />
          ))}
        </div>

        <div className="surprise-section">
          <button
            className={`surprise-btn ${surpriseAnim ? 'anim' : ''}`}
            onClick={handleSurprise}
            id="btn-surprise-me"
            aria-label="Randomly select a category"
          >
            <span className="surprise-dice">🎲</span>
            SURPRISE ME
          </button>
          <p className="surprise-hint">Let us pick a category for you</p>
        </div>
      </main>

      <footer className="home-footer">
        <span>PuzzleCanvas • Powered by Gemini AI</span>
      </footer>
    </div>
  );
}
