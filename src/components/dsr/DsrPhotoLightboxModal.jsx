import React, { useEffect, useState } from 'react';
import {
  XIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  TrashIcon,
  ZoomInIcon,
  FileIcon,
} from '../ui/icons';
import Button from '../ui/Button';
import IconButton from '../ui/IconButton';
import { formatFileSize } from '../../utils/dsr';

/**
 * BefUI Lightbox Modal for viewing, navigating, and managing DSR photos & files.
 * Provides Admin action triggers (Edit & Delete) and keyboard navigation.
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
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setIsZoomed(false);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Photo Preview Lightbox"
    >
      {/* Top Header Bar */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent text-white">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-white/10 text-white/90 border border-white/20">
            {currentIndex + 1} / {attachments.length}
          </span>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold truncate text-white">
              {current.caption || current.name}
            </h4>
            <span className="text-[11px] text-white/70 block truncate">
              {current.name} • {formatFileSize(current.size)}
              {current.uploadedBy && ` • Uploaded by ${current.uploadedBy}`}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isImage && (
            <button
              type="button"
              onClick={() => setIsZoomed((v) => !v)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title={isZoomed ? 'Fit to screen' : 'Zoom 100%'}
              aria-label="Toggle zoom"
            >
              <ZoomInIcon className="size-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleDownload}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Download file"
            aria-label="Download file"
          >
            <DownloadIcon className="size-4" />
          </button>

          {canDelete && (
            <button
              type="button"
              onClick={() => onDeletePhoto?.(current)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/80 hover:bg-rose-600 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              title="Delete photo"
            >
              <TrashIcon className="size-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-white/15 hover:bg-white/30 text-white transition-colors cursor-pointer ml-1"
            aria-label="Close preview"
          >
            <XIcon className="size-4.5" />
          </button>
        </div>
      </div>

      {/* Main Image / Document Canvas */}
      <div className="relative size-full flex items-center justify-center p-4 pt-16 pb-20 select-none overflow-hidden">
        {isImage && current.url ? (
          <div
            className={`transition-all duration-200 max-h-full max-w-full flex items-center justify-center ${
              isZoomed ? 'cursor-zoom-out overflow-auto' : 'cursor-zoom-in'
            }`}
            onClick={() => setIsZoomed((v) => !v)}
          >
            <img
              src={current.url}
              alt={current.caption || current.name}
              className={`rounded-lg shadow-2xl object-contain transition-transform duration-200 ${
                isZoomed ? 'max-w-none scale-125' : 'max-h-[80vh] max-w-[90vw]'
              }`}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-white/20 bg-white/10 p-8 text-center text-white max-w-md shadow-2xl backdrop-blur-md space-y-4">
            <div className="size-16 rounded-2xl bg-white/10 mx-auto flex items-center justify-center text-white">
              <FileIcon className="size-8" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white truncate">
                {current.name}
              </h3>
              <p className="text-xs text-white/70 mt-1">
                Document file ({formatFileSize(current.size)})
              </p>
            </div>
            {current.caption && (
              <p className="text-xs italic text-white/90 bg-white/5 rounded-lg p-3 border border-white/10">
                "{current.caption}"
              </p>
            )}
            <div className="flex justify-center pt-2">
              <Button
                variant="primary"
                size="md"
                leadingIcon="download"
                onClick={handleDownload}
              >
                Download Document
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Left / Right Arrow Controls */}
      {attachments.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex((prev) => (prev > 0 ? prev - 1 : attachments.length - 1));
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 size-11 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm shadow-lg hover:scale-105"
            aria-label="Previous photo"
          >
            <ChevronLeftIcon className="size-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex((prev) => (prev < attachments.length - 1 ? prev + 1 : 0));
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 size-11 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm shadow-lg hover:scale-105"
            aria-label="Next photo"
          >
            <ChevronRightIcon className="size-6" />
          </button>
        </>
      )}

      {/* Bottom Thumbnail Strip (if more than 1 attachment) */}
      {attachments.length > 1 && (
        <div className="absolute bottom-3 inset-x-0 z-20 flex justify-center px-4">
          <div className="flex items-center gap-2 p-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/15 max-w-[90vw] overflow-x-auto">
            {attachments.map((att, idx) => {
              const isThumbImg = att.type?.startsWith('image/') || att.isImage;
              const isSelected = idx === currentIndex;
              return (
                <button
                  key={att.id || idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`size-12 rounded-lg overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/40 scale-105'
                      : 'border-white/20 opacity-60 hover:opacity-100'
                  }`}
                >
                  {isThumbImg && att.url ? (
                    <img
                      src={att.url}
                      alt={att.caption || att.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="size-full bg-white/10 flex items-center justify-center text-white">
                      <FileIcon className="size-4" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default DsrPhotoLightboxModal;
