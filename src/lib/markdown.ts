import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import { Marked } from "marked";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { slugify } from "./slug";

export interface Heading {
  id: string;
  text: string;
  depth: 2 | 3;
}

export interface Wikilink {
  target: string;
  slug: string;
  alias: string | null;
}

export interface RenderedPage {
  html: string;
  headings: Heading[];
  wikilinks: Wikilink[];
}

const notion = new Client({ auth: import.meta.env.NOTION_TOKEN });

const n2m = new NotionToMarkdown({
  notionClient: notion,
  config: { parseChildPages: false },
});

n2m.setCustomTransformer("image", async (block) => {
  // @ts-expect-error notion-to-md type defs are loose
  const image = block.image;
  let url = "";
  let caption = "";

  if (image?.type === "external") url = image.external.url;
  else if (image?.type === "file") url = image.file.url;

  if (Array.isArray(image?.caption) && image.caption.length > 0) {
    caption = image.caption
      .map((t: { plain_text: string }) => t.plain_text)
      .join("");
  }

  if (!url) return "";

  try {
    // @ts-expect-error block.id is real
    const localPath = await downloadImage(url, block.id);
    return `![${caption}](${localPath})`;
  } catch (err) {
    console.warn(`[notion] No pude descargar ${url}:`, (err as Error).message);
    return `![${caption}](${url})`;
  }
});

async function downloadImage(url: string, blockId: string): Promise<string> {
  const ext = extname(new URL(url).pathname) || ".png";
  const flatId = blockId.replaceAll("-", "");
  const filename = `${flatId}${ext}`;
  const publicPath = `/images/notion/${filename}`;

  // En build, Astro copia public/ → dist/ antes de que corra el SSG (donde se
  // dispara este transformer), así que escribimos directo al outDir. En dev,
  // public/ es lo que sirve astro dev.
  const baseDir = import.meta.env.PROD ? "dist/images/notion" : "public/images/notion";
  const dir = resolve(process.cwd(), baseDir);
  const fullPath = resolve(dir, filename);

  if (existsSync(fullPath)) return publicPath;

  await mkdir(dir, { recursive: true });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(fullPath, buffer);
  return publicPath;
}

const WIKILINK_RE = /\[\[([^\]|\n]+?)(?:\|([^\]\n]+?))?\]\]/g;

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Build a per-render marked instance with the wikilink extension.
function buildMarked(): Marked {
  const m = new Marked({ gfm: true, breaks: false });
  m.use({
    extensions: [
      {
        name: "wikilink",
        level: "inline",
        start(src: string) {
          const i = src.indexOf("[[");
          return i === -1 ? undefined : i;
        },
        tokenizer(src: string) {
          WIKILINK_RE.lastIndex = 0;
          const match = /^\[\[([^\]|\n]+?)(?:\|([^\]\n]+?))?\]\]/.exec(src);
          if (!match) return;
          return {
            type: "wikilink",
            raw: match[0],
            target: match[1]!.trim(),
            alias: match[2]?.trim() ?? null,
          };
        },
        renderer(token) {
          const target = (token as unknown as { target: string }).target;
          const alias = (token as unknown as { alias: string | null }).alias;
          const slug = slugify(target);
          const label = alias ?? target;
          return `<a href="/wiki/${slug}/" class="wikilink">${escapeHtml(label)}</a>`;
        },
      },
    ],
  });
  return m;
}

function extractWikilinks(md: string): Wikilink[] {
  // Remove fenced code + inline code so we don't pick up bracketed text inside them.
  const cleaned = md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]*`/g, "");

  const seen = new Set<string>();
  const out: Wikilink[] = [];
  WIKILINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WIKILINK_RE.exec(cleaned))) {
    const target = match[1]!.trim();
    const alias = match[2]?.trim() ?? null;
    const slug = slugify(target);
    const dedupeKey = `${slug}|${alias ?? ""}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({ target, slug, alias });
  }
  return out;
}

function injectHeadingIds(html: string): { html: string; headings: Heading[] } {
  const headings: Heading[] = [];
  const usedIds = new Map<string, number>();

  const newHtml = html.replace(
    /<h([23])>([\s\S]+?)<\/h\1>/g,
    (_match, level, inner) => {
      const depth = Number(level) as 2 | 3;
      const text = (inner as string).replace(/<[^>]+>/g, "").trim();
      let id = slugify(text);
      if (!id) id = `heading-${headings.length + 1}`;
      const count = usedIds.get(id) ?? 0;
      usedIds.set(id, count + 1);
      if (count > 0) id = `${id}-${count + 1}`;
      headings.push({ id, text, depth });
      return `<h${level} id="${id}">${inner}</h${level}>`;
    },
  );

  return { html: newHtml, headings };
}

export async function pageToRendered(pageId: string): Promise<RenderedPage> {
  const blocks = await n2m.pageToMarkdown(pageId);
  const md = n2m.toMarkdownString(blocks).parent ?? "";
  const wikilinks = extractWikilinks(md);

  const marked = buildMarked();
  const rawHtml = (await marked.parse(md)) as string;
  const { html, headings } = injectHeadingIds(rawHtml);

  return { html, headings, wikilinks };
}
