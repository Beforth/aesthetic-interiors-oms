import React, { forwardRef, useId, useState } from 'react';
import Icon from './Icon';
import FormField from './FormField';

/**
 * File upload input component with clean drop-target styling and file name indicator.
 */
export const FileInput = forwardRef(function FileInput(
  {
    label,
    error,
    helperText,
    required = false,
    accept,
    multiple = false,
    onChange,
    disabled = false,
    className = '',
    id,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const fileInputId = id || generatedId;
  const [selectedFileNames, setSelectedFileNames] = useState([]);

  const handleChange = (e) => {
    const files = Array.from(e.target.files || []);
    setSelectedFileNames(files.map((f) => f.name));
    if (onChange) onChange(e);
  };

  const baseInput = (
    <div className="w-full">
      <label
        htmlFor={fileInputId}
        className={`flex items-center justify-between border border-dashed rounded-lg px-3 py-2 cursor-pointer bg-card hover:bg-muted transition-colors min-h-[44px]
          ${error ? 'border-destructive' : 'border-border'}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-muted' : ''}
          ${className}
        `}
      >
        <div className="flex items-center gap-2 overflow-hidden text-sm">
          <Icon name="upload" size={16} className="text-primary shrink-0" />
          <span className="truncate text-muted-foreground">
            {selectedFileNames.length > 0
              ? selectedFileNames.join(', ')
              : 'Choose file or drag & drop...'}
          </span>
        </div>
        <span className="text-xs font-medium text-primary shrink-0 ml-2">Browse</span>
      </label>
      <input
        ref={ref}
        id={fileInputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        required={required}
        onChange={handleChange}
        className="sr-only"
        {...rest}
      />
    </div>
  );

  if (label || helperText || error) {
    return (
      <FormField
        label={label}
        htmlFor={fileInputId}
        required={required}
        error={error}
        helperText={helperText}
      >
        {baseInput}
      </FormField>
    );
  }

  return baseInput;
});

export default FileInput;
