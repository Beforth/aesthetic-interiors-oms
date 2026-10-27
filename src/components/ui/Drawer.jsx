import React, { useEffect } from 'react';
import IconButton from './IconButton';

/**
 * Slide-over drawer component for contextual details and mobile menus.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {function(): void} props.onClose
 * @param {string} [props.title]
 * @param {string} [props.subtitle]
 * @param {'right'|'left'} [props.placement='right']
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {React.ReactNode} props.children
 * @param {React.ReactNode} [props.footer]
 */
export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  placement = 'right',
  size = 'md',
  children,
  footer,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-xs',
    md: 'max-w-md',
    lg: 'max-w-xl',
  };

  const isRight = placement === 'right';

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`fixed inset-y-0 ${
          isRight ? 'right-0' : 'left-0'
        } flex max-w-full`}
      >
        <div
          className={`w-screen ${sizeClasses[size] || sizeClasses.md} bg-card border-border shadow-2xl flex flex-col ${
            isRight ? 'border-l' : 'border-r'
          } animate-in ${isRight ? 'slide-in-from-right' : 'slide-in-from-left'} duration-200`}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-5 py-4 border-b border-border bg-card">
            <div>
              {title && (
                <h3 className="text-base font-bold text-foreground">{title}</h3>
              )}
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
              )}
            </div>
            <IconButton
              icon="close"
              ariaLabel="Close drawer"
              size="sm"
              onClick={onClose}
              className="-mr-1 -mt-1 text-muted-foreground hover:text-foreground"
            />
          </div>

          {/* Content */}
          <div className="flex-1 p-5 overflow-y-auto">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-border bg-muted/40">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Drawer;
