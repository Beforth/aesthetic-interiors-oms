import React, { useRef, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Spinner from '../ui/Spinner';
import { CameraIcon, UploadIcon, FileIcon } from '../ui/icons';
import { compressImage, formatFileSize } from '../../utils/dsr';

/**
 * BefUI Modal for editing a DSR photo: update its caption and/or replace the file.
 * Used by Admin to curate, clarify, or update site photos.
 */
export function DsrEditPhotoModal({
  isOpen,
  onClose,
  photo,
  onSave,
}) {
  const fileInputRef = useRef(null);
  const [caption, setCaption] = useState(photo?.caption || '');
  const [previewUrl, setPreviewUrl] = useState(photo?.url || '');
  const [fileName, setFileName] = useState(photo?.name || '');
  const [fileSize, setFileSize] = useState(photo?.size || 0);
  const [fileType, setFileType] = useState(photo?.type || 'image/jpeg');
  const [isReplacing, setIsReplacing] = useState(false);
  const [compressing, setCompressing] = useState(false);

  // Sync state if photo prop changes
  React.useEffect(() => {
    if (photo) {
      setCaption(photo.caption || '');
      setPreviewUrl(photo.url || '');
      setFileName(photo.name || '');
      setFileSize(photo.size || 0);
      setFileType(photo.type || 'image/jpeg');
      setIsReplacing(false);
    }
  }, [photo, isOpen]);

  if (!isOpen || !photo) return null;

  const isImage = fileType?.startsWith('image/') || photo?.isImage;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    try {
      const processed = await compressImage(file, 1400, 0.85);
      setPreviewUrl(processed.url);
      setFileName(processed.name);
      setFileSize(processed.size);
      setFileType(processed.type);
      setIsReplacing(true);
    } catch (err) {
      console.error('Failed to replace photo:', err);
    } finally {
      setCompressing(false);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    onSave({
      ...photo,
      caption: caption.trim(),
      url: previewUrl,
      name: fileName,
      size: fileSize,
      type: fileType,
      modifiedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Site Photo / File"
      subtitle="Update the photo description or upload a replacement file."
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <Button variant="outline" size="sm" onClick={onClose} disabled={compressing}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="dsr-edit-photo-form"
            variant="primary"
            size="sm"
            disabled={compressing}
          >
            Save Changes
          </Button>
        </div>
      }
    >
      <form id="dsr-edit-photo-form" onSubmit={handleSave} className="space-y-4">
        {/* Preview Container */}
        <div className="rounded-xl border border-border bg-muted/30 p-3 flex flex-col items-center justify-center gap-2">
          {compressing ? (
            <div className="py-8 flex flex-col items-center gap-2">
              <Spinner size="md" />
              <span className="text-xs text-muted-foreground">Processing new file...</span>
            </div>
          ) : isImage && previewUrl ? (
            <div className="relative max-h-56 w-full rounded-lg overflow-hidden border border-border bg-card flex items-center justify-center">
              <img
                src={previewUrl}
                alt={caption || fileName}
                className="max-h-56 max-w-full object-contain"
              />
              {isReplacing && (
                <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-xs">
                  New File Selected
                </span>
              )}
            </div>
          ) : (
            <div className="p-6 rounded-lg bg-card border border-border text-center space-y-2 w-full">
              <FileIcon className="size-10 mx-auto text-muted-foreground" />
              <div className="text-xs font-semibold text-foreground truncate">{fileName}</div>
              <div className="text-[11px] text-muted-foreground">{formatFileSize(fileSize)}</div>
            </div>
          )}

          <div className="flex items-center justify-between w-full pt-1 text-[11px] text-muted-foreground">
            <span className="truncate">{fileName} ({formatFileSize(fileSize)})</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-primary hover:underline font-semibold cursor-pointer shrink-0 ml-2"
            >
              Replace Photo...
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              className="sr-only"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Caption Input */}
        <div>
          <label htmlFor="photo-caption" className="block text-xs font-semibold text-foreground mb-1.5">
            Photo Caption & Site Notes
          </label>
          <input
            id="photo-caption"
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="e.g. Master bedroom false ceiling framing verified"
            className="w-full text-xs px-3 py-2 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary shadow-xs"
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Provide clear context for the site work shown in this photo.
          </p>
        </div>
      </form>
    </Modal>
  );
}

export default DsrEditPhotoModal;
