import React from 'react';
import { Label } from './befui-label';

/**
 * A label, its control and a hint or error, drawn like BefUI's Field (https://befui.vercel.app/#/components/label).
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
export function FormField({ label, htmlFor, required = false, error, helperText, children, className = '' }) {
  return (
    <div className={`grid content-start gap-1.5 ${className}`}>
      {label && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}

      {children}

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}

export default FormField;
