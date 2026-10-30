const MAX_SLUG_LENGTH = 40;

/** Lowercase, hyphen-separated, ASCII-only, starting with a letter, at most 40 characters. */
export function slugify(text: string, fallback: string): string {
  const ascii = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const startsWithLetter = /^[a-z]/.test(ascii) ? ascii : ascii === '' ? '' : `n-${ascii}`;
  const base = startsWithLetter === '' ? fallback : startsWithLetter;
  return base.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, '');
}

/** Adds a numeric suffix to make `slug` unique within `taken`, staying inside the length limit. */
export function uniqueSlug(slug: string, taken: ReadonlySet<string>): string {
  if (!taken.has(slug)) {
    return slug;
  }
  for (let counter = 2; ; counter += 1) {
    const suffix = `-${String(counter)}`;
    const candidate = `${slug.slice(0, MAX_SLUG_LENGTH - suffix.length).replace(/-+$/g, '')}${suffix}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
}
