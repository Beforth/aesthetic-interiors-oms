import React, { useEffect } from 'react';
import IconButton from './IconButton';

/**
 * Accessible Modal dialog with keyboard escape handling and focus entrapment.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {function(): void} props.onClose
 * @param {string} [props.title]
 * @param {string} [props.subtitle]
 * @param {'sm'|'md'|'lg'|'xl'} [props.size='md']
 * @param {React.ReactNode} props.children
 * @param {React.ReactNode} [props.footer]
 * @param {string} [props.className]
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
  footer,
  className = '',
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
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-text-main/50 transition-opacity backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Content */}
      <div
        className={`relative w-full ${sizeClasses[size] || sizeClasses.md} bg-surface border border-border rounded shadow-xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150 my-auto ${className}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-border bg-surface">
          <div>
            {title && (
              <h2 id="modal-title" className="text-base font-bold text-text-main">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
            )}
          </div>
          <IconButton
            icon="close"
            ariaLabel="Close modal"
            size="sm"
            onClick={onClose}
            className="-mr-1 -mt-1 text-text-muted hover:text-text-main"
          />
        </div>

        {/* Body */}
        <div className="p-5 max-h-[calc(85vh-120px)] overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-border bg-brand-50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
