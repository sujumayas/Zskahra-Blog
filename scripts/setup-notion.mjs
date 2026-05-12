// Crea (o reusa) la database "Crónicas de Sesión" y su página template
// dentro de NOTION_PARENT_PAGE. Idempotente: re-ejecutar es seguro.
//
//   npm run setup:notion

import { Client } from "@notionhq/client";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_PARENT_PAGE = process.env.NOTION_PARENT_PAGE;

if (!NOTION_TOKEN || !NOTION_PARENT_PAGE) {
  console.error("✗ Faltan NOTION_TOKEN o NOTION_PARENT_PAGE en .env");
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

const DB_TITLE = "Crónicas de Sesión";
const TEMPLATE_TITLE = "📋 TEMPLATE — Duplica esta página";

const STATUS_OPTIONS = [
  { name: "Borrador", color: "default" },
  { name: "Listo", color: "yellow" },
  { name: "Publicado", color: "green" },
];

const DB_PROPERTIES = {
  "Título": { title: {} },
  "Número de sesión": { number: { format: "number" } },
  "Fecha IRL": { date: {} },
  "Fecha-mundo": { rich_text: {} },
  "Cronista": { select: { options: [] } },
  "Personajes presentes": { multi_select: { options: [] } },
  "Estado": { select: { options: STATUS_OPTIONS } },
  "Slug": { rich_text: {} },
  "Resumen corto": { rich_text: {} },
  "Etiquetas": { multi_select: { options: [] } },
};

const text = (content) => [{ type: "text", text: { content } }];

async function findExistingDatabase() {
  let cursor;
  do {
    const res = await notion.blocks.children.list({
      block_id: NOTION_PARENT_PAGE,
      start_cursor: cursor,
    });
    for (const block of res.results) {
      if (block.type === "child_database" && block.child_database.title === DB_TITLE) {
        return block.id;
      }
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return null;
}

async function ensureDatabase() {
  const existing = await findExistingDatabase();
  if (existing) {
    console.log(`✓ Database existente reusada: ${existing}`);
    return existing;
  }
  console.log("→ Creando database…");
  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: NOTION_PARENT_PAGE },
    icon: { type: "emoji", emoji: "📖" },
    title: text(DB_TITLE),
    properties: DB_PROPERTIES,
  });
  console.log(`✓ Database creada: ${db.id}`);
  return db.id;
}

async function findExistingTemplate(databaseId) {
  const res = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: "Título",
      title: { equals: TEMPLATE_TITLE },
    },
    page_size: 1,
  });
  return res.results[0]?.id ?? null;
}

const templateBlocks = () => [
  {
    object: "block",
    type: "callout",
    callout: {
      icon: { type: "emoji", emoji: "📜" },
      color: "brown_background",
      rich_text: text(
        "Duplica esta página (· · · → Duplicate) y reemplaza este contenido por tu crónica — escríbela como quieras. Lo importante es llenar las properties de arriba (Título, Número, Fechas, Cronista, Personajes, Resumen corto, Etiquetas). Cuando termines, cambia Estado a “Listo”. Tip: usa [[Nombre de entidad]] para enlazar a personajes, lugares o facciones; la web genera links automáticos.",
      ),
    },
  },
];

async function ensureTemplate(databaseId) {
  const existing = await findExistingTemplate(databaseId);
  if (existing) {
    console.log(`✓ Página template reusada: ${existing}`);
    return existing;
  }
  console.log("→ Creando página template…");
  const page = await notion.pages.create({
    parent: { type: "database_id", database_id: databaseId },
    icon: { type: "emoji", emoji: "📋" },
    properties: {
      "Título": { title: text(TEMPLATE_TITLE) },
      "Estado": { select: { name: "Borrador" } },
    },
    children: templateBlocks(),
  });
  console.log(`✓ Página template creada: ${page.id}`);
  return page.id;
}

async function main() {
  console.log(`Parent page: ${NOTION_PARENT_PAGE}\n`);

  const databaseId = await ensureDatabase();
  await ensureTemplate(databaseId);

  const cleanId = databaseId.replaceAll("-", "");
  console.log("\n─────────────────────────────────────────");
  console.log("Listo. Añade a tu .env (si aún no está):\n");
  console.log(`NOTION_DATABASE_ID=${cleanId}\n`);
  console.log("Notas:");
  console.log(
    "• La propiedad 'Publicar' (button) NO se puede crear vía API. Si quieres ese",
  );
  console.log("  paso de UX, añádela manual: Database settings → + Add property → Button.");
  console.log("  Acción del botón: edit property → set Estado → Listo.");
  console.log("• Si la database no aparece, asegúrate de que tu integración tenga acceso");
  console.log("  al parent page: en Notion abre la página → · · · → Connections → Add.");
}

main().catch((err) => {
  console.error("\n✗ Error:", err.message);
  if (err.code === "object_not_found") {
    console.error(
      "  ¿Tu integración tiene acceso al parent page? En Notion: abre la página padre → · · · → Connections → Connect to → selecciona tu integración.",
    );
  }
  process.exit(1);
});
