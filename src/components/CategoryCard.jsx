/**
 * CategoryCard.jsx
 * One category selection card on the Home screen.
 */

export default function CategoryCard({ category, icon, description, onClick, isSelected }) {
  return (
    <button
      className={`category-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      aria-label={`Select ${category} category`}
      id={`category-${category.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <span className="category-icon" aria-hidden="true">{icon}</span>
      <span className="category-name">{category}</span>
      <span className="category-desc">{description}</span>
      <span className="category-arrow">→</span>
    </button>
  );
}
