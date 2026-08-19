import type { GalleryPhoto } from "@/lib/gallery";
import { PhotoCard } from "./photo-card";

export function PhotoGrid({ photos }: { photos: GalleryPhoto[] }) {
  return (
    <div className="photo-grid">
      {photos.map((photo, index) => (
        <PhotoCard key={photo.id} photo={photo} index={index} priority={index < 2} />
      ))}
    </div>
  );
}
