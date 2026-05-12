import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import {
  getRichText,
  getTitle,
  mapCronicaMeta,
  type CronicaMeta,
} from "./notion-types";
import { resolveCollisions, slugify } from "./slug";
import { pageToRendered, type Heading, type RenderedPage, type Wikilink } from "./markdown";

export interface CronicaFull extends CronicaMeta {
  html: string;
  headings: Heading[];
  wikilinks: Wikilink[];
}

export interface WikiEntity {
  slug: string;
  name: string;
  mentions: Array<{ slug: string; title: string }>;
}

const NOTION_TOKEN = import.meta.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = import.meta.env.NOTION_DATABASE_ID;

if (!NOTION_TOKEN) throw new Error("Falta NOTION_TOKEN en el entorno");
if (!NOTION_DATABASE_ID)
  throw new Error("Falta NOTION_DATABASE_ID (corre `npm run setup:notion`)");

const notion = new Client({ auth: NOTION_TOKEN });

let metaCache: CronicaMeta[] | null = null;
const renderCache = new Map<string, RenderedPage>();
let wikiCache: Map<string, WikiEntity> | null = null;

async function fetchAllPublishedPages(): Promise<PageObjectResponse[]> {
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: { property: "Estado", select: { equals: "Publicado" } },
      sorts: [{ property: "Número de sesión", direction: "descending" }],
      start_cursor: cursor,
    });
    for (const page of res.results) {
      if ("properties" in page) pages.push(page as PageObjectResponse);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return pages;
}

export async function listPublishedCronicas(): Promise<CronicaMeta[]> {
  if (metaCache) return metaCache;

  const pages = await fetchAllPublishedPages();
  const rawSlugs = pages.map((page) => {
    const explicit = getRichText(page, "Slug").trim();
    return explicit ? slugify(explicit) : slugify(getTitle(page, "Título"));
  });
  const slugs = resolveCollisions(rawSlugs.map((s) => s || "sesion"));

  metaCache = pages.map((page, i) => mapCronicaMeta(page, slugs[i]!));
  return metaCache;
}

async function renderCronica(notionId: string): Promise<RenderedPage> {
  const cached = renderCache.get(notionId);
  if (cached) return cached;
  const rendered = await pageToRendered(notionId);
  renderCache.set(notionId, rendered);
  return rendered;
}

export async function getAllSlugs(): Promise<string[]> {
  const cronicas = await listPublishedCronicas();
  return cronicas.map((c) => c.slug);
}

export async function getCronicaBySlug(slug: string): Promise<CronicaFull | null> {
  const cronicas = await listPublishedCronicas();
  const meta = cronicas.find((c) => c.slug === slug);
  if (!meta) return null;
  const rendered = await renderCronica(meta.notionId);
  return { ...meta, ...rendered };
}

export async function getAdjacentCronicas(
  slug: string,
): Promise<{ prev: CronicaMeta | null; next: CronicaMeta | null }> {
  const cronicas = await listPublishedCronicas();
  const i = cronicas.findIndex((c) => c.slug === slug);
  if (i === -1) return { prev: null, next: null };
  // metaCache está ordenada por Número de sesión desc → la siguiente en lectura
  // cronológica es la anterior en el array
  return {
    prev: cronicas[i + 1] ?? null,
    next: cronicas[i - 1] ?? null,
  };
}

export async function getAllWikilinks(): Promise<Map<string, WikiEntity>> {
  if (wikiCache) return wikiCache;

  const cronicas = await listPublishedCronicas();
  const wikiMap = new Map<string, WikiEntity>();

  for (const cronica of cronicas) {
    const rendered = await renderCronica(cronica.notionId);
    for (const link of rendered.wikilinks) {
      const existing = wikiMap.get(link.slug) ?? {
        slug: link.slug,
        name: link.target,
        mentions: [],
      };
      if (!existing.mentions.some((m) => m.slug === cronica.slug)) {
        existing.mentions.push({ slug: cronica.slug, title: cronica.title });
      }
      wikiMap.set(link.slug, existing);
    }
  }

  wikiCache = wikiMap;
  return wikiMap;
}

export async function getWikilink(slug: string): Promise<WikiEntity | null> {
  const all = await getAllWikilinks();
  return all.get(slug) ?? null;
}
