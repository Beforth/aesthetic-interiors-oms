import React, { useRef, useState } from 'react';
import {
  UploadIcon,
  CameraIcon,
  FileIcon,
  XIcon,
  AlertCircleIcon,
  CheckIcon,
} from '../ui/icons';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { compressImage, formatFileSize } from '../../utils/dsr';

/**
 * BefUI compliant attachment uploader for Daily Site Reports.
 * Supports image compression, multi-file selection, drag-and-drop, and inline captions.
 */
export function DsrAttachmentUploader({
  attachments = [],
  onChange,
  disabled = false,
  userName = 'You',
  maxFiles = 10,
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMessage('');

    if (attachments.length + fileList.length > maxFiles) {
      setErrorMessage(`You can upload a maximum of ${maxFiles} photos/files per entry.`);
      return;
    }

    setProcessing(true);
    try {
      const newAttachments = [];
      for (const file of Array.from(fileList)) {
        // Enforce max raw file size (e.g. 25MB)
        if (file.size > 25 * 1024 * 1024) {
          setErrorMessage(`"${file.name}" exceeds the 25MB limit.`);
          continue;
        }

        const processed = await compressImage(file, 1400, 0.82);
        const isImage = processed.type.startsWith('image/');
        const newAtt = {
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: processed.name,
          url: processed.url,
          type: processed.type,
          size: processed.size,
          caption: '',
          uploadedAt: new Date().toISOString(),
          uploadedBy: userName,
          isImage,
        };
        newAttachments.push(newAtt);
      }

      if (newAttachments.length > 0) {
        onChange([...attachments, ...newAttachments]);
      }
    } catch (err) {
      console.error('Failed to process uploaded files:', err);
      setErrorMessage('Could not process selected files. Please try again.');
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || processing) return;
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled && !processing) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const removeAttachment = (id) => {
    onChange(attachments.filter((a) => a.id !== id));
  };

  const updateCaption = (id, newCaption) => {
    onChange(
      attachments.map((a) => (a.id === id ? { ...a, caption: newCaption } : a))
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <CameraIcon className="size-4 text-primary" />
          <span>Site Photos & Supporting Documents</span>
          <span className="text-[11px] font-normal text-muted-foreground">
            ({attachments.length}/{maxFiles})
          </span>
        </label>
        <span className="text-[10px] text-muted-foreground">
          JPG, PNG, WebP, PDF up to 25MB
        </span>
      </div>

      {/* Drop Target Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && !processing && fileInputRef.current?.click()}
        className={`relative border border-dashed rounded-xl p-4 sm:p-5 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-2 ${
          isDragging
            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
            : 'border-border bg-card hover:bg-muted/50 hover:border-border/80'
        } ${disabled || processing ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt"
          multiple
          disabled={disabled || processing}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {processing ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Spinner size="md" />
            <span className="text-xs font-medium text-foreground">
              Optimizing and preparing files...
            </span>
          </div>
        ) : (
          <>
            <div className="size-9 rounded-full bg-muted flex items-center justify-center text-primary border border-border/70">
              <UploadIcon className="size-4.5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-foreground">
                <span className="text-primary font-semibold hover:underline">
                  Click to upload
                </span>{' '}
                or drag & drop site photos & files
              </p>
              <p className="text-[11px] text-muted-foreground">
                Camera photos will be optimized automatically
              </p>
            </div>
          </>
        )}
      </div>

      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2.5">
          <AlertCircleIcon className="size-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Staged Attachments List */}
      {attachments.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Attached items ({attachments.length})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {attachments.map((att, idx) => {
              const isImg = att.type?.startsWith('image/') || att.isImage;
              return (
                <div
                  key={att.id || idx}
                  className="rounded-lg border border-border bg-card p-2.5 shadow-2xs flex flex-col gap-2 relative group"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    {/* Thumbnail or Document Icon */}
                    <div className="size-12 rounded-md bg-muted border border-border shrink-0 overflow-hidden flex items-center justify-center">
                      {isImg && att.url ? (
                        <img
                          src={att.url}
                          alt={att.caption || att.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground p-1">
                          <FileIcon className="size-5" />
                          <span className="text-[9px] font-mono font-bold uppercase truncate max-w-[36px]">
                            {att.name?.split('.').pop() || 'FILE'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-foreground truncate block">
                          {att.name}
                        </span>
                        {!disabled && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeAttachment(att.id);
                            }}
                            className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors"
                            aria-label="Remove attachment"
                          >
                            <XIcon className="size-3.5" />
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground block">
                        {formatFileSize(att.size)}
                        {att.uploadedBy && ` • ${att.uploadedBy}`}
                      </span>
                    </div>
                  </div>

                  {/* Caption input */}
                  <div className="relative">
                    <input
                      type="text"
                      disabled={disabled}
                      value={att.caption || ''}
                      onChange={(e) => updateCaption(att.id, e.target.value)}
                      placeholder="Add caption (e.g. framing snag, wall conduit)..."
                      className="w-full text-[11px] px-2 py-1 rounded bg-muted/60 border border-border/80 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:bg-card"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default DsrAttachmentUploader;
