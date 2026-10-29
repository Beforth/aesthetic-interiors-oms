import React, { useEffect } from 'react';
import IconButton from './IconButton';

/**
 * befui Dialog / Modal component conforming to https://befui.vercel.app/
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
  bodyClassName = '',
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
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Content */}
      <div
        className={`relative w-full ${sizeClasses[size] || sizeClasses.md} bg-card text-card-foreground border border-border rounded-xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150 my-auto ${className}`}
      >
        {/* Header */}
        {(title || subtitle) && (
          <div className="flex items-start justify-between px-5 py-4 border-b border-border/80 bg-muted/20">
            <div>
              {title && (
                <h2 id="modal-title" className="text-base font-semibold tracking-tight text-text-main">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
              )}
            </div>
            <IconButton
              icon="close"
              ariaLabel="Close modal"
              size="sm"
              onClick={onClose}
              className="-mr-1 -mt-1 text-muted-foreground hover:text-text-main"
            />
          </div>
        )}

        {/* Body */}
        <div className={`p-5 max-h-[calc(90vh-70px)] overflow-y-auto ${bodyClassName}`}>{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-border/80 bg-muted/20">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
