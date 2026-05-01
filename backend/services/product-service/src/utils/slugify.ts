/**
 * Converts a string to a URL-safe slug.
 * "Money Plants (XL)" → "money-plants-xl"
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')   // remove non-word chars (except hyphens)
    .replace(/[\s_]+/g, '-')    // spaces and underscores → hyphen
    .replace(/--+/g, '-')       // collapse repeated hyphens
    .replace(/^-|-$/g, '');     // strip leading/trailing hyphens
}

/** Appends a short random suffix to make a slug unique on collision. */
export function uniqueSlug(base: string): string {
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${slugify(base)}-${suffix}`;
}
