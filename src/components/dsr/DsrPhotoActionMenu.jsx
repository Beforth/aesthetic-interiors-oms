import React from 'react';
import { CameraIcon } from '../ui/icons';

/**
 * BefUI compliant Photo cell for DSR entries.
 * Displays a clean rounded image (size-9 / 36x36px).
 * Clicking the thumbnail directly opens the full photo in the Lightbox viewer.
 * When no photo is attached, shows a clean placeholder to attach a site photo.
 */
export function DsrPhotoActionMenu({
  entry,
  photo,
  allPhotos = [],
  canManage = false,
  onViewPhoto,
  onUploadPhoto,
}) {
  const photoCount = allPhotos.length || (photo ? 1 : 0);

  return (
    <div className="inline-block text-left">
      {photo ? (
        /* Small uploaded image thumbnail (36x36px with rounded-xl) */
        <div
          onClick={(e) => {
            e.stopPropagation();
            onViewPhoto?.(entry, 0);
          }}
          className="relative size-9 rounded-xl overflow-hidden border border-border/80 bg-muted cursor-pointer hover:ring-2 hover:ring-primary/40 hover:scale-105 transition-all shrink-0 shadow-xs group/thumb"
          title={photo.caption || photo.name || 'Click to view photo'}
        >
          <img
            src={photo.url}
            alt={photo.caption || photo.name || 'Site photo'}
            className="size-full object-cover"
          />
          {photoCount > 1 && (
            <span className="absolute bottom-0 right-0 bg-black/80 text-white text-[8px] font-bold px-1 rounded-tl-sm leading-tight">
              +{photoCount - 1}
            </span>
          )}
        </div>
      ) : (
        /* Placeholder box when no photo is attached yet */
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (canManage && onUploadPhoto) {
              onUploadPhoto();
            }
          }}
          className="relative size-9 rounded-xl border border-dashed border-border/80 bg-muted/40 hover:bg-primary/5 hover:border-primary/40 flex items-center justify-center transition-all shrink-0 cursor-pointer group/placeholder shadow-2xs"
          title={canManage ? 'Click to add site photo' : 'No photo uploaded'}
        >
          <CameraIcon className="size-4 text-muted-foreground/50 group-hover/placeholder:text-primary transition-colors" />
        </div>
      )}
    </div>
  );
}

export default DsrPhotoActionMenu;
