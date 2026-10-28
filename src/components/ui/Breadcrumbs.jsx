import React from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';

/**
 * Breadcrumb navigation hierarchy.
 *
 * @param {Object} props
 * @param {Array<{label: string, path?: string}>} props.items
 * @param {string} [props.className]
 */
export function Breadcrumbs({ items = [], className = '' }) {
  const filteredItems = items.filter(
    (b) =>
      b?.label &&
      b.label.toLowerCase() !== 'operations' &&
      b.label.toLowerCase() !== 'hrms'
  );
  if (!filteredItems || filteredItems.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center text-xs text-muted-foreground ${className}`}>
      <ol className="flex items-center gap-1.5 flex-wrap">
        {filteredItems.map((item, index) => {
          const isLast = index === filteredItems.length - 1;

          return (
            <li key={item.label || index} className="flex items-center gap-1.5">
              {index > 0 && <Icon name="chevron-right" size={12} className="text-border" />}
              {item.path && !isLast ? (
                <Link
                  to={item.path}
                  className="hover:text-primary transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={isLast ? 'font-medium text-foreground' : ''}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
