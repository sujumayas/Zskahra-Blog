const DIACRITICS = /[̀-ͯ]/g;

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveCollisions(slugs: string[]): string[] {
  const seen = new Map<string, number>();
  return slugs.map((s) => {
    const count = seen.get(s) ?? 0;
    seen.set(s, count + 1);
    return count === 0 ? s : `${s}-${count + 1}`;
  });
}
