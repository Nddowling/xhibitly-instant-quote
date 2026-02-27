import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function MegaMenu({ categories = [] }) {
  const [activeItem, setActiveItem] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="mega-menu-container">
      <button 
        className="mobile-menu-toggle" 
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <span />
        <span />
        <span />
      </button>

      <ul className={`mega-menu ${mobileOpen ? 'mobile-open' : ''}`}>
        {categories.map((category, idx) => (
          <li 
            key={idx} 
            className={`menu-item ${category.subcategories?.length ? 'has-dropdown' : ''} ${activeItem === idx ? 'active' : ''}`}
            onMouseEnter={() => setActiveItem(idx)}
            onMouseLeave={() => setActiveItem(null)}
          >
            <div 
              className="menu-link"
              onClick={(e) => {
                if (category.subcategories?.length) {
                  // Toggle on click for both mobile and desktop (if they click it)
                  if (activeItem === idx) {
                    setActiveItem(null);
                  } else {
                    setActiveItem(idx);
                  }
                }
              }}
            >
              <span>{category.name}</span>
              {category.subcategories?.length > 0 && (
                <ChevronDown className="dropdown-arrow w-4 h-4" />
              )}
            </div>

            {category.subcategories?.length > 0 && (
              <div className="mega-dropdown">
                <div className="mega-dropdown-content">
                  {category.subcategories.map((col, colIdx) => (
                    <div key={colIdx} className="mega-column">
                      <h4 className="column-title">{col.name}</h4>
                      {col.children && col.children.length > 0 && (
                        <ul className="subcategory-list">
                          {col.children.map((sub, subIdx) => (
                            <li key={subIdx}>
                              <Link 
                                to={`${createPageUrl('Product3DManager')}?category=${category.slug}&subcategory=${sub.slug}`}
                                className="subcategory-link"
                                onClick={() => setMobileOpen(false)}
                              >
                                <span className="subcategory-name">{sub.name}</span>
                                {/* Product counts removed to prevent confusion, as they were hardcoded. We now just show the subcategory name. */}
                              </Link>
                              {sub.description && (
                                <p className="subcategory-description">{sub.description}</p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}