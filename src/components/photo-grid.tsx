import { Fragment } from "react";
import type { GalleryPhoto } from "@/lib/gallery";
import { toLightboxPhoto } from "@/lib/lightbox";
import { GalleryDateAnchor, getGalleryMonth } from "./gallery-date-anchor";
import { PhotoCard } from "./photo-card";
import { PhotoLightboxGallery } from "./photo-lightbox";

export function PhotoGrid({
  photos,
  priorityCount = 0,
}: {
  photos: GalleryPhoto[];
  priorityCount?: number;
}) {
  return (
    <PhotoLightboxGallery
      photos={photos.map(toLightboxPhoto)}
      className="photo-grid photo-grid-justified"
    >
      {photos.map((photo, index) => {
        const month = getGalleryMonth(photo.takenAt);
        const previousMonth = index > 0 ? getGalleryMonth(photos[index - 1].takenAt) : null;

        return (
          <Fragment key={photo.id}>
            {!previousMonth || previousMonth.key !== month.key ? (
              <GalleryDateAnchor month={month} />
            ) : null}
            <PhotoCard photo={photo} index={index} priority={index < priorityCount} />
          </Fragment>
        );
      })}
    </PhotoLightboxGallery>
  );
}
