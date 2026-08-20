import type { GalleryPhoto } from "@/lib/gallery";
import { toLightboxPhoto } from "@/lib/lightbox";
import { PhotoCard } from "./photo-card";
import { PhotoLightboxGallery } from "./photo-lightbox";

export function PhotoGrid({ photos }: { photos: GalleryPhoto[] }) {
  return (
    <PhotoLightboxGallery photos={photos.map(toLightboxPhoto)}>
      {photos.map((photo, index) => (
        <PhotoCard key={photo.id} photo={photo} index={index} priority={index < 2} />
      ))}
    </PhotoLightboxGallery>
  );
}
