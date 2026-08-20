export function albumHref(slug: string) {
  return `/albums/${encodeURIComponent(slug)}`;
}
