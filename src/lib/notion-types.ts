import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export interface CronicaMeta {
  notionId: string;
  slug: string;
  title: string;
  sessionNumber: number | null;
  fechaIRL: string | null;
  fechaInGame: string | null;
  cronista: string | null;
  personajes: string[];
  etiquetas: string[];
  resumenCorto: string;
}

export interface CronicaFull extends CronicaMeta {
  html: string;
}

export function getTitle(page: PageObjectResponse, name: string): string {
  const prop = page.properties[name];
  if (prop?.type === "title") {
    return prop.title.map((t) => t.plain_text).join("");
  }
  return "";
}

export function getRichText(page: PageObjectResponse, name: string): string {
  const prop = page.properties[name];
  if (prop?.type === "rich_text") {
    return prop.rich_text.map((t) => t.plain_text).join("");
  }
  return "";
}

export function getNumber(page: PageObjectResponse, name: string): number | null {
  const prop = page.properties[name];
  return prop?.type === "number" ? prop.number : null;
}

export function getDate(page: PageObjectResponse, name: string): string | null {
  const prop = page.properties[name];
  return prop?.type === "date" ? (prop.date?.start ?? null) : null;
}

export function getSelect(page: PageObjectResponse, name: string): string | null {
  const prop = page.properties[name];
  return prop?.type === "select" ? (prop.select?.name ?? null) : null;
}

export function getMultiSelect(page: PageObjectResponse, name: string): string[] {
  const prop = page.properties[name];
  return prop?.type === "multi_select" ? prop.multi_select.map((s) => s.name) : [];
}

export function mapCronicaMeta(page: PageObjectResponse, slug: string): CronicaMeta {
  return {
    notionId: page.id,
    slug,
    title: getTitle(page, "Título"),
    sessionNumber: getNumber(page, "Número de sesión"),
    fechaIRL: getDate(page, "Fecha IRL"),
    fechaInGame: getDate(page, "Fecha in-game"),
    cronista: getSelect(page, "Cronista"),
    personajes: getMultiSelect(page, "Personajes presentes"),
    etiquetas: getMultiSelect(page, "Etiquetas"),
    resumenCorto: getRichText(page, "Resumen corto"),
  };
}
