import React, { useRef, useState } from 'react';
import {
  UploadIcon,
  CameraIcon,
  FileIcon,
  XIcon,
  AlertCircleIcon,
  CheckIcon,
  PlusIcon,
  EyeIcon,
  DownloadIcon,
} from '../ui/icons';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { compressImage, formatFileSize } from '../../utils/dsr';

/**
 * BefUI compliant attachment uploader for Daily Site Reports.
 * Supports image compression, multiple photo selection, PDF document uploads,
 * drag-and-drop, and inline captions.
 */
export function DsrAttachmentUploader({
  attachments = [],
  onChange,
  disabled = false,
  userName = 'You',
  maxFiles = 15,
}) {
  const photoInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMessage('');

    if (attachments.length + fileList.length > maxFiles) {
      setErrorMessage(`You can upload a maximum of ${maxFiles} photos or documents per entry.`);
      return;
    }

    setProcessing(true);
    try {
      const newAttachments = [];
      for (const file of Array.from(fileList)) {
        // Enforce max raw file size (25MB)
        if (file.size > 25 * 1024 * 1024) {
          setErrorMessage(`"${file.name}" exceeds the 25MB limit.`);
          continue;
        }

        const processed = await compressImage(file, 1400, 0.82);
        const isImage = processed.type.startsWith('image/');
        const isPdf = processed.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

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
          isPdf,
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
      if (photoInputRef.current) photoInputRef.current.value = '';
      if (pdfInputRef.current) pdfInputRef.current.value = '';
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
      {/* Hidden file inputs with multiple support */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        disabled={disabled || processing}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        disabled={disabled || processing}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.txt"
        multiple
        disabled={disabled || processing}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Header bar with direct upload triggers */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <CameraIcon className="size-4 text-primary" />
          <span>Site Photos & PDF Documents</span>
          <span className="text-[11px] font-normal text-muted-foreground">
            ({attachments.length}/{maxFiles})
          </span>
        </label>

        {/* Dedicated Photo & PDF upload buttons */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => photoInputRef.current?.click()}
            disabled={disabled || processing || attachments.length >= maxFiles}
            className="gap-1 text-primary border-primary/30 hover:bg-primary/5"
          >
            <CameraIcon className="size-3 text-primary" />
            <span>+ Add Photos</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => pdfInputRef.current?.click()}
            disabled={disabled || processing || attachments.length >= maxFiles}
            className="gap-1 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/5"
          >
            <FileIcon className="size-3 text-rose-500" />
            <span>+ Upload PDF</span>
          </Button>
        </div>
      </div>

      {/* Upload Box Container with Inline Attached Items */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative border border-dashed rounded-xl p-3.5 sm:p-4 transition-all duration-150 ${
          isDragging
            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
            : 'border-border bg-card'
        }`}
      >
        {processing ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <Spinner size="md" />
            <span className="text-xs font-medium text-foreground">
              Optimizing and processing files...
            </span>
          </div>
        ) : attachments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-4 px-2 text-center">
            <div className="flex items-center gap-2">
              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <CameraIcon className="size-5" />
              </div>
              <div className="size-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20">
                <FileIcon className="size-5" />
              </div>
            </div>

            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground">
                Upload multiple site photos or PDF inspection reports
              </p>
              <p className="text-[11px] text-muted-foreground">
                Drag and drop files here, or choose an upload option below (up to {maxFiles} files)
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90 transition-all cursor-pointer"
              >
                <CameraIcon className="size-3.5" />
                <span>Add Multiple Photos</span>
              </button>

              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-card border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 shadow-2xs transition-all cursor-pointer"
              >
                <FileIcon className="size-3.5 text-rose-500" />
                <span>Upload PDF File</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
              {attachments.map((att, idx) => {
                const isImg = att.type?.startsWith('image/') || att.isImage;
                const isPdf = att.isPdf || att.type === 'application/pdf' || att.name?.toLowerCase().endsWith('.pdf');

                return (
                  <div
                    key={att.id || idx}
                    className="rounded-lg border border-border bg-background p-2.5 shadow-2xs flex flex-col gap-2 text-left relative group hover:border-border/80 transition-colors"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {/* Thumbnail or PDF / Document Badge */}
                      <div className="size-13 rounded-md bg-muted border border-border shrink-0 overflow-hidden flex items-center justify-center relative">
                        {isImg && att.url ? (
                          <img
                            src={att.url}
                            alt={att.caption || att.name}
                            className="size-full object-cover"
                          />
                        ) : isPdf ? (
                          <div className="flex flex-col items-center justify-center text-rose-500 bg-rose-500/10 size-full p-1">
                            <FileIcon className="size-5" />
                            <span className="text-[9px] font-bold font-mono tracking-tight text-rose-600 dark:text-rose-400">
                              PDF
                            </span>
                          </div>
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
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            {isPdf && (
                              <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 mb-0.5">
                                PDF DOCUMENT
                              </span>
                            )}
                            <span className="text-xs font-semibold text-foreground truncate block" title={att.name}>
                              {att.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {att.url && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(att.url, '_blank');
                                }}
                                className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors cursor-pointer"
                                title="Open / Preview"
                              >
                                <EyeIcon className="size-3.5" />
                              </button>
                            )}
                            {!disabled && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeAttachment(att.id);
                                }}
                                className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors cursor-pointer"
                                aria-label="Remove attachment"
                                title="Remove file"
                              >
                                <XIcon className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <span className="text-[10px] text-muted-foreground block mt-0.5">
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
                        placeholder={isPdf ? 'Add PDF note (e.g. site inspection report, drawing)...' : 'Add photo caption (e.g. ceiling framing, wiring)...'}
                        className="w-full text-[11px] px-2 py-1 rounded bg-muted/60 border border-border/80 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:bg-card"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {attachments.length < maxFiles && (
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={disabled}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer py-1 px-2.5 rounded-md hover:bg-primary/5 transition-colors"
                >
                  <CameraIcon className="size-3.5" />
                  <span>+ Add More Photos</span>
                </button>

                <span className="text-border text-xs hidden sm:inline">•</span>

                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={disabled}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer py-1 px-2.5 rounded-md hover:bg-rose-500/5 transition-colors"
                >
                  <FileIcon className="size-3.5 text-rose-500" />
                  <span>+ Upload PDF Document</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2.5">
          <AlertCircleIcon className="size-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}

export default DsrAttachmentUploader;
