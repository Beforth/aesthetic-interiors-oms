import React, { useState, useRef, useEffect } from 'react';
import Icon from './Icon';

/**
 * Accessible Dropdown action menu with click-outside dismissal.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.trigger - Custom trigger element
 * @param {Array<{label?: string, icon?: string, onClick?: function, danger?: boolean, disabled?: boolean, divider?: boolean}>} props.items
 * @param {'right'|'left'} [props.align='right']
 * @param {string} [props.className]
 */
export function Dropdown({
  trigger,
  items = [],
  align = 'right',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      <div onClick={() => setIsOpen((prev) => !prev)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-1 w-52 rounded bg-surface border border-border shadow-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-100`}
        >
          {items.map((item, index) => {
            if (item.divider) {
              return <div key={`div-${index}`} className="my-1 border-t border-border" />;
            }

            return (
              <button
                key={item.label || index}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setIsOpen(false);
                  if (item.onClick) item.onClick();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition-colors min-h-[44px] sm:min-h-0
                  ${
                    item.danger
                      ? 'text-danger hover:bg-danger-light'
                      : 'text-text-main hover:bg-brand-50'
                  }
                  ${item.disabled ? 'opacity-40 cursor-not-allowed' : ''}
                `}
              >
                {item.icon && (
                  <Icon
                    name={item.icon}
                    size={15}
                    className={item.danger ? 'text-danger' : 'text-text-muted'}
                  />
                )}
                <span className="flex-1 truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Dropdown;
