import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import {
  getRichText,
  getTitle,
  mapCronicaMeta,
  type CronicaFull,
  type CronicaMeta,
} from "./notion-types";
import { resolveCollisions, slugify } from "./slug";
import { pageToHtml } from "./markdown";

const NOTION_TOKEN = import.meta.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = import.meta.env.NOTION_DATABASE_ID;

if (!NOTION_TOKEN) throw new Error("Falta NOTION_TOKEN en el entorno");
if (!NOTION_DATABASE_ID)
  throw new Error("Falta NOTION_DATABASE_ID en el entorno (corre `npm run setup:notion`)");

const notion = new Client({ auth: NOTION_TOKEN });

let metaCache: CronicaMeta[] | null = null;
const htmlCache = new Map<string, string>();

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

export async function getAllSlugs(): Promise<string[]> {
  const cronicas = await listPublishedCronicas();
  return cronicas.map((c) => c.slug);
}

export async function getCronicaBySlug(slug: string): Promise<CronicaFull | null> {
  const cronicas = await listPublishedCronicas();
  const meta = cronicas.find((c) => c.slug === slug);
  if (!meta) return null;

  let html = htmlCache.get(meta.notionId);
  if (!html) {
    html = await pageToHtml(meta.notionId);
    htmlCache.set(meta.notionId, html);
  }
  return { ...meta, html };
}

export async function getAdjacentCronicas(
  slug: string,
): Promise<{ prev: CronicaMeta | null; next: CronicaMeta | null }> {
  const cronicas = await listPublishedCronicas();
  const i = cronicas.findIndex((c) => c.slug === slug);
  if (i === -1) return { prev: null, next: null };
  // cronicas está ordenada por número desc → "siguiente" en lectura cronológica es la de antes en el array
  return {
    prev: cronicas[i + 1] ?? null,
    next: cronicas[i - 1] ?? null,
  };
}
