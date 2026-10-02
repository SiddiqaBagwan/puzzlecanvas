/**
 * LoadingScreen.jsx
 * Shown while Gemini generates the image.
 */

export default function LoadingScreen({ category }) {
  return (
    <div className="loading-screen">
      <div className="bg-blob blob-1" />
      <div className="bg-blob blob-2" />

      <div className="loading-content">
        <div className="loading-spinner">
          <div className="spinner-ring" />
          <div className="spinner-ring spinner-ring-2" />
          <div className="spinner-core">🧩</div>
        </div>

        <h2 className="loading-title">GENERATING YOUR PUZZLE</h2>
        <p className="loading-category">Category: <strong>{category}</strong></p>
        <p className="loading-subtitle">The AI is crafting a unique image just for you…</p>

        <div className="loading-dots">
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}
