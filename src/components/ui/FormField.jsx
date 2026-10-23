import React from 'react';

/**
 * Accessible FormField wrapper that pairs labels, inputs, helpers, and error states.
 *
 * @param {Object} props
 * @param {string} [props.label]
 * @param {string} [props.htmlFor]
 * @param {boolean} [props.required=false]
 * @param {string} [props.error]
 * @param {string} [props.helperText]
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 */
export function FormField({
  label,
  htmlFor,
  required = false,
  error,
  helperText,
  children,
  className = '',
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-xs font-semibold text-text-main flex items-center gap-1 select-none"
        >
          {label}
          {required && <span className="text-danger" aria-hidden="true">*</span>}
        </label>
      )}

      {children}

      {error ? (
        <p className="text-xs text-danger font-medium flex items-center gap-1" role="alert">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-xs text-text-muted">{helperText}</p>
      ) : null}
    </div>
  );
}

export default FormField;
