export type LightboxPhoto = {
  id: string;
  title: string;
  description: string | null;
  dateLabel: string;
  dimensionsLabel: string;
  cameraLabel: string | null;
  detailHref: string;
  fallbackUrl: string | null;
  sources: Array<{
    width: number;
    url: string;
    format: string;
  }>;
};
