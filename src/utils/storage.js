/**
 * localStorage / sessionStorage helper with JSON serialization.
 * Falls back gracefully if storage is unavailable.
 */

const PREFIX = 'puzzlecanvas_';

export const storage = {
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage write failed:', e);
    }
  },

  get(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('Storage read failed:', e);
      return null;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch (e) {
      console.warn('Storage remove failed:', e);
    }
  },

  clear() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(PREFIX))
        .forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn('Storage clear failed:', e);
    }
  },
};

// Keys used throughout the app
export const STORAGE_KEYS = {
  ACTIVE_PUZZLE: 'active_puzzle',
  PUZZLE_IMAGE: 'puzzle_image',
  PUZZLE_STATE: 'puzzle_state',
};
