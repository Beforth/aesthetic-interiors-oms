'use client';

import * as React from 'react';
import { FileIcon, UploadIcon, XIcon } from './icons';
import { cn } from '../../lib/utils';

/** Drag and drop file area that also opens the file picker on click or Enter. You own the File[] state. */
export function Dropzone({
  files,
  onFilesChange,
  accept,
  multiple = true,
  maxSizeMB = 10,
  hint = 'Drop files here or click to browse',
  className,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  hint?: string;
  className?: string;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const [error, setError] = React.useState('');

  const add = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const ok = incoming.filter((f) => f.size <= maxSizeMB * 1024 * 1024);
    setError(ok.length < incoming.length ? `Files over ${maxSizeMB} MB were skipped` : '');
    onFilesChange(multiple ? [...files, ...ok] : ok.slice(0, 1));
  };

  return (
    <div className={cn('grid gap-3', className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.current?.click())}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
        className={cn(
          'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center outline-none transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-[var(--dur-base)] hover:border-primary/50 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50',
          over && 'scale-[1.01] border-primary bg-accent',
        )}
      >
        <span className={cn('grid size-10 place-items-center rounded-full bg-secondary text-muted-foreground transition-transform duration-[var(--dur-base)]', over && '-translate-y-1 bg-primary text-primary-foreground')}>
          <UploadIcon className="size-5" />
        </span>
        <span className="text-sm font-medium">{hint}</span>
        <span className="text-xs text-muted-foreground">Up to {maxSizeMB} MB each</span>
        <input ref={input} type="file" hidden accept={accept} multiple={multiple} onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {files.length > 0 && (
        <ul className="grid gap-1.5">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex animate-pop items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
              <FileIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{(f.size / 1024).toFixed(f.size > 1048576 ? 0 : 1)} KB</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onFilesChange(files.filter((_, j) => j !== i))} className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
                <XIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
