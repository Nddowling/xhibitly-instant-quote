import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import './MegaMenu.css';

/**
 * Mega Menu Component - Nimlok-style navigation
 *
 * Features:
 * - Hover-activated mega dropdowns
 * - Multi-column subcategory layout
 * - Product counts per category
 * - Mobile responsive
 * - Smooth animations
 */

const MegaMenu = ({ categories }) => {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleMouseEnter = (index) => {
    setActiveDropdown(index);
  };

  const handleMouseLeave = () => {
    setActiveDropdown(null);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <nav className="mega-menu-container">
      {/* Mobile Hamburger */}
      <button
        className="mobile-menu-toggle"
        onClick={toggleMobileMenu}
        aria-label="Toggle menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* Main Menu */}
      <ul className={`mega-menu ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        {categories.map((category, index) => (
          <li
            key={category.slug}
            className={`menu-item ${category.subcategories ? 'has-dropdown' : ''} ${activeDropdown === index ? 'active' : ''}`}
            onMouseEnter={() => handleMouseEnter(index)}
            onMouseLeave={handleMouseLeave}
          >
            <Link
              to={`${createPageUrl('Product3DManager')}?category=${category.slug}`}
              className="menu-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              {category.icon && <span className="menu-icon">{category.icon}</span>}
              {category.name}
              {category.subcategories && (
                <span className="dropdown-arrow">▾</span>
              )}
            </Link>

            {/* Mega Dropdown */}
            {category.subcategories && (
              <div className="mega-dropdown">
                <div className="mega-dropdown-content">
                  {category.subcategories.map((subcat) => (
                    <div key={subcat.slug} className="mega-column">
                      <h4 className="column-title">{subcat.name}</h4>
                      <ul className="subcategory-list">
                        {subcat.children ? (
                          // Has nested children
                          subcat.children.map((child) => (
                            <li key={child.slug}>
                              <Link
                                to={`${createPageUrl('Product3DManager')}?category=${category.slug}&subcategory=${child.slug}`}
                                className="subcategory-link"
                                onClick={() => setMobileMenuOpen(false)}
                              >
                                <span className="subcategory-name">{child.name}</span>
                                {child.productCount && (
                                  <span className="product-count">({child.productCount})</span>
                                )}
                              </Link>
                              {child.description && (
                                <p className="subcategory-description">{child.description}</p>
                              )}
                            </li>
                          ))
                        ) : (
                          // Direct subcategory
                          <li>
                            <Link
                              to={`${createPageUrl('Product3DManager')}?category=${category.slug}&subcategory=${subcat.slug}`}
                              className="subcategory-link"
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              <span className="subcategory-name">{subcat.name}</span>
                              {subcat.productCount && (
                                <span className="product-count">({subcat.productCount})</span>
                              )}
                            </Link>
                            {subcat.description && (
                              <p className="subcategory-description">{subcat.description}</p>
                            )}
                          </li>
                        )}
                      </ul>
                    </div>
                  ))}
                </div>

                {/* Optional: Featured product/promo in dropdown */}
                {category.featured && (
                  <div className="mega-featured">
                    <img src={category.featured.image} alt={category.featured.title} />
                    <h5>{category.featured.title}</h5>
                    <Link to={`${createPageUrl('Product3DManager')}?category=${category.slug}`} onClick={() => setMobileMenuOpen(false)}>Learn More →</Link>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default MegaMenu;