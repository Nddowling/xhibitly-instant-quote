/* ============================================
   Mega Menu Component - Nimlok Style
   ============================================ */

/* Container */
.mega-menu-container {
  background: #ffffff;
  border-bottom: 2px solid #e5e7eb;
  position: relative;
  z-index: 1000;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

/* Mobile Toggle Button */
.mobile-menu-toggle {
  display: none;
  background: none;
  border: none;
  padding: 1rem;
  cursor: pointer;
  flex-direction: column;
  gap: 5px;
}

.mobile-menu-toggle span {
  display: block;
  width: 25px;
  height: 3px;
  background: #1f2937;
  transition: all 0.3s ease;
}

/* Main Menu List */
.mega-menu {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 0;
  max-width: 1400px;
  margin: 0 auto;
}

/* Menu Items */
.menu-item {
  position: relative;
  flex-shrink: 0;
}

.menu-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1.25rem 1.5rem;
  color: #1f2937;
  text-decoration: none;
  font-weight: 500;
  font-size: 0.95rem;
  transition: all 0.2s ease;
  white-space: nowrap;
  cursor: pointer;
}

.menu-link:hover {
  color: #2563eb;
  background: #f3f4f6;
}

.menu-item.active .menu-link {
  color: #2563eb;
  background: #eff6ff;
}

/* Menu Icons */
.menu-icon {
  font-size: 1.1rem;
}

/* Dropdown Arrow */
.dropdown-arrow {
  font-size: 0.75rem;
  margin-left: 0.25rem;
  transition: transform 0.2s ease;
}

.menu-item.active .dropdown-arrow {
  transform: rotate(180deg);
}

/* ============================================
   Mega Dropdown Panel
   ============================================ */

.mega-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 650px;
  background: white;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  border-radius: 0 0 8px 8px;
  padding: 2.5rem;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-15px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  max-height: 85vh;
  overflow-y: auto;
}

/* Show dropdown on hover */
.menu-item.has-dropdown:hover .mega-dropdown,
.menu-item.has-dropdown.active .mega-dropdown {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  pointer-events: all;
}

/* Dropdown Content Grid */
.mega-dropdown-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2.5rem;
}

/* ============================================
   Columns & Subcategories
   ============================================ */

.mega-column {
  min-width: 200px;
}

.column-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.75px;
  margin: 0 0 1rem 0;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #e5e7eb;
}

/* Subcategory List */
.subcategory-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.subcategory-list li {
  margin-bottom: 0.75rem;
}

.subcategory-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #374151;
  text-decoration: none;
  font-size: 0.9rem;
  padding: 0.4rem 0.5rem;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.subcategory-link:hover {
  color: #2563eb;
  background: #eff6ff;
  padding-left: 0.75rem;
}

.subcategory-name {
  flex: 1;
}

/* Product Count Badge */
.product-count {
  color: #9ca3af;
  font-size: 0.8rem;
  font-weight: 500;
  background: #f3f4f6;
  padding: 0.1rem 0.5rem;
  border-radius: 12px;
  margin-left: 0.5rem;
}

.subcategory-link:hover .product-count {
  background: #dbeafe;
  color: #2563eb;
}

/* Subcategory Description */
.subcategory-description {
  font-size: 0.75rem;
  color: #9ca3af;
  margin: 0.25rem 0 0 0.5rem;
  line-height: 1.3;
}

/* ============================================
   Featured Product Section (Optional)
   ============================================ */

.mega-featured {
  grid-column: span 1;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1.5rem;
  border-radius: 8px;
  text-align: center;
}

.mega-featured img {
  width: 100%;
  height: 150px;
  object-fit: cover;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.mega-featured h5 {
  margin: 0.5rem 0;
  font-size: 1rem;
}

.mega-featured a {
  color: white;
  text-decoration: none;
  font-weight: 600;
  display: inline-block;
  margin-top: 0.5rem;
}

/* ============================================
   Mobile Responsive
   ============================================ */

@media (max-width: 1024px) {
  .mega-dropdown {
    min-width: 500px;
  }

  .mega-dropdown-content {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }
}

@media (max-width: 768px) {
  /* Show mobile toggle */
  .mobile-menu-toggle {
    display: flex;
  }

  /* Hide menu by default on mobile */
  .mega-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    background: white;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease;
  }

  .mega-menu.mobile-open {
    max-height: 80vh;
    overflow-y: auto;
  }

  /* Full width menu items */
  .menu-item {
    width: 100%;
    border-bottom: 1px solid #e5e7eb;
  }

  .menu-link {
    width: 100%;
    justify-content: space-between;
  }

  /* Dropdown behavior on mobile */
  .mega-dropdown {
    position: static;
    min-width: 100%;
    box-shadow: none;
    border-radius: 0;
    padding: 1rem;
    background: #f9fafb;
  }

  .mega-dropdown-content {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  /* Don't show dropdown on hover on mobile */
  .menu-item.has-dropdown:hover .mega-dropdown {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }

  /* Only show when explicitly active (clicked) */
  .menu-item.has-dropdown.active .mega-dropdown {
    opacity: 1;
    visibility: visible;
    transform: none;
    pointer-events: all;
  }

  .column-title {
    font-size: 0.8rem;
  }
}

/* ============================================
   Dark Mode Support
   ============================================ */

@media (prefers-color-scheme: dark) {
  .mega-menu-container {
    background: #1f2937;
    border-bottom-color: #374151;
  }

  .menu-link {
    color: #e5e7eb;
  }

  .menu-link:hover {
    background: #374151;
    color: #60a5fa;
  }

  .mega-dropdown {
    background: #111827;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  }

  .column-title {
    color: #9ca3af;
    border-bottom-color: #374151;
  }

  .subcategory-link {
    color: #d1d5db;
  }

  .subcategory-link:hover {
    background: #1f2937;
    color: #60a5fa;
  }

  .product-count {
    background: #374151;
    color: #9ca3af;
  }

  .subcategory-link:hover .product-count {
    background: #1e3a8a;
    color: #60a5fa;
  }
}

/* ============================================
   Accessibility
   ============================================ */

.menu-link:focus,
.subcategory-link:focus {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

/* Keyboard navigation support */
.menu-item:focus-within .mega-dropdown {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  pointer-events: all;
}

/* ============================================
   Animations
   ============================================ */

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-15px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.mega-dropdown {
  animation: slideDown 0.3s ease;
}

/* Smooth scroll for mobile */
.mega-menu.mobile-open {
  scroll-behavior: smooth;
}