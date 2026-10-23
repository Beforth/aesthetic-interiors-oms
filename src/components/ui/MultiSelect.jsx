import React, { useState, useRef, useEffect, useId } from 'react';
import Icon from './Icon';
import FormField from './FormField';

/**
 * MultiSelect component allowing multiple item selection with searchable menu,
 * selected item pills, and keyboard / click-outside support.
 *
 * @param {Object} props
 * @param {string} [props.label]
 * @param {Array<{value: string|number, label: string, subtitle?: string, icon?: string}>} props.options
 * @param {Array<string|number>} props.value - Array of selected keys
 * @param {function(Array<string|number>): void} props.onChange
 * @param {string} [props.placeholder='Select options...']
 * @param {string} [props.error]
 * @param {string} [props.helperText]
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.className]
 */
export function MultiSelect({
  label,
  options = [],
  value = [],
  onChange,
  placeholder = 'Select options...',
  error,
  helperText,
  disabled = false,
  className = '',
  id,
}) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (itemValue) => {
    if (disabled) return;
    const exists = value.includes(itemValue);
    let next;
    if (exists) {
      next = value.filter((v) => v !== itemValue);
    } else {
      next = [...value, itemValue];
    }
    onChange && onChange(next);
  };

  const handleRemove = (e, itemValue) => {
    e.stopPropagation();
    if (disabled) return;
    const next = value.filter((v) => v !== itemValue);
    onChange && onChange(next);
  };

  const filteredOptions = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(search.toLowerCase()) ||
      (opt.subtitle && opt.subtitle.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedOptions = options.filter((opt) => value.includes(opt.value));

  const baseControl = (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <div
        id={selectId}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full min-h-[44px] bg-surface border rounded text-sm text-text-main p-1.5 pr-8 flex flex-wrap items-center gap-1.5 cursor-pointer transition-colors
          ${
            error
              ? 'border-danger focus:border-danger'
              : 'border-border focus:border-brand-500'
          }
          ${disabled ? 'bg-brand-50 opacity-60 cursor-not-allowed' : 'hover:border-brand-500'}
        `}
      >
        {selectedOptions.length === 0 ? (
          <span className="text-text-muted px-2 py-1 text-sm select-none">
            {placeholder}
          </span>
        ) : (
          selectedOptions.map((opt) => (
            <span
              key={opt.value}
              className="inline-flex items-center gap-1 text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded font-medium"
            >
              <span className="truncate max-w-[150px]">{opt.label}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => handleRemove(e, opt.value)}
                  className="hover:text-danger rounded p-0.5 transition-colors"
                  aria-label={`Remove ${opt.label}`}
                >
                  <Icon name="close" size={12} />
                </button>
              )}
            </span>
          ))
        )}

        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
          <Icon name="chevron-down" size={16} />
        </div>
      </div>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded shadow-lg z-30 max-h-60 overflow-y-auto p-1 animate-in fade-in zoom-in-95 duration-100"
        >
          {options.length > 5 && (
            <div className="p-1 mb-1 border-b border-border sticky top-0 bg-surface">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search options..."
                className="w-full text-xs px-2.5 py-1.5 border border-border rounded bg-brand-50 focus:outline-none focus:border-brand-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {filteredOptions.length === 0 ? (
            <div className="text-xs text-text-muted text-center py-3 select-none">
              No matching options
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected = value.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleToggle(opt.value)}
                  className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer select-none transition-colors min-h-[38px]
                    ${
                      isSelected
                        ? 'bg-brand-50 text-brand-700 font-semibold'
                        : 'text-text-main hover:bg-brand-50'
                    }
                  `}
                >
                  <div className="min-w-0 pr-2">
                    <div className="truncate">{opt.label}</div>
                    {opt.subtitle && (
                      <div className="text-[11px] text-text-muted truncate">
                        {opt.subtitle}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <Icon name="check" size={14} className="text-brand-600 shrink-0" />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );

  if (label || helperText || error) {
    return (
      <FormField label={label} error={error} helperText={helperText}>
        {baseControl}
      </FormField>
    );
  }

  return baseControl;
}

export default MultiSelect;
