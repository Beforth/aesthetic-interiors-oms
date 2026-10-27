import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  XIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  TrashIcon,
  FileIcon,
} from '../ui/icons';
import Button from '../ui/Button';
import { formatFileSize } from '../../utils/dsr';

/**
 * BefUI Minimal-Size Popup Modal for previewing DSR photos and attachments.
 * Replaces the full-screen blackout overlay with a compact, centered modal dialog.
 */
export function DsrPhotoLightboxModal({
  isOpen,
  onClose,
  attachments = [],
  initialIndex = 0,
  canEdit = false,
  canDelete = false,
  onEditPhoto,
  onDeletePhoto,
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && attachments.length > 1) {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : attachments.length - 1));
      }
      if (e.key === 'ArrowRight' && attachments.length > 1) {
        setCurrentIndex((prev) => (prev < attachments.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, attachments.length, onClose]);

  if (!isOpen || attachments.length === 0) return null;

  const current = attachments[currentIndex] || attachments[0];
  const isImage = current.type?.startsWith('image/') || current.isImage;

  const handleDownload = () => {
    if (!current.url) return;
    const link = document.createElement('a');
    link.href = current.url;
    link.download = current.name || 'dsr-attachment';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Photo Preview Dialog"
      onClick={onClose}
    >
      {/* Centered Minimal Popup Card */}
      <div
        className="relative w-full max-w-lg rounded-2xl border border-border bg-card text-foreground shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            {attachments.length > 1 && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                {currentIndex + 1} / {attachments.length}
              </span>
            )}
            <div className="min-w-0">
              <h4 className="text-xs font-semibold truncate text-foreground" title={current.caption || current.name}>
                {current.caption || current.name}
              </h4>
              <span className="text-[10px] text-muted-foreground block truncate">
                {formatFileSize(current.size)}
                {current.uploadedBy && ` • Uploaded by ${current.uploadedBy}`}
              </span>
            </div>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Download file"
              aria-label="Download file"
            >
              <DownloadIcon className="size-4" />
            </button>

            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  onDeletePhoto?.(current);
                  if (attachments.length <= 1) onClose();
                }}
                className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                title="Delete photo"
                aria-label="Delete photo"
              >
                <TrashIcon className="size-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer ml-0.5"
              title="Close preview"
              aria-label="Close preview"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        </div>

        {/* Minimal Image / File Preview Box */}
        <div className="relative p-3 bg-muted/20 flex items-center justify-center min-h-[220px]">
          {isImage && current.url ? (
            <div className="relative flex items-center justify-center w-full">
              <img
                src={current.url}
                alt={current.caption || current.name}
                className="max-h-[340px] w-auto max-w-full rounded-xl object-contain border border-border/60 shadow-xs bg-background"
              />

              {/* Prev / Next controls inside the box */}
              {attachments.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : attachments.length - 1))}
                    className="absolute left-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-background/85 hover:bg-background border border-border text-foreground shadow-sm flex items-center justify-center transition-all cursor-pointer"
                    aria-label="Previous photo"
                  >
                    <ChevronLeftIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((prev) => (prev < attachments.length - 1 ? prev + 1 : 0))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-background/85 hover:bg-background border border-border text-foreground shadow-sm flex items-center justify-center transition-all cursor-pointer"
                    aria-label="Next photo"
                  >
                    <ChevronRightIcon className="size-4" />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-6 text-center text-foreground max-w-xs shadow-xs space-y-3">
              <div className="size-12 rounded-xl bg-muted mx-auto flex items-center justify-center text-muted-foreground">
                <FileIcon className="size-6" />
              </div>
              <div>
                <h4 className="text-xs font-semibold truncate text-foreground">
                  {current.name}
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Document file ({formatFileSize(current.size)})
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                leadingIcon="download"
                onClick={handleDownload}
              >
                Download Document
              </Button>
            </div>
          )}
        </div>

        {/* Footer info & close */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-card text-xs">
          <span className="text-[11px] text-muted-foreground truncate pr-2">
            {current.caption ? `"${current.caption}"` : current.name}
          </span>
          <Button variant="outline" size="xs" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default DsrPhotoLightboxModal;
