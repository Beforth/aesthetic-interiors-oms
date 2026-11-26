import React from 'react';
import { Dropzone } from './befui-dropzone';

/**
 * BefUI's drop area (https://befui.vercel.app/#/components/dropzone) for choosing one file.
 * `onFile(fileList)` receives the chosen file; the screen shows its name or preview itself.
 */
export function FileDrop({ onFile, accept, hint, maxSizeMB = 25, className = '' }) {
  return (
    <Dropzone
      files={[]}
      multiple={false}
      accept={accept}
      maxSizeMB={maxSizeMB}
      hint={hint}
      className={`[&>[role=button]]:py-4 ${className}`}
      onFilesChange={(files) => files.length && onFile(files)}
    />
  );
}

export default FileDrop;
