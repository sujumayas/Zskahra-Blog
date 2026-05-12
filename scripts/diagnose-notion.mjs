// Lista todas las páginas en la database (sin filtrar por Estado) para
// ayudar a encontrar contenido perdido. No modifica nada.
//
//   npm run diagnose:notion

import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DATABASE_ID;

if (!DB_ID) {
  console.error("Falta NOTION_DATABASE_ID");
  process.exit(1);
}

function getTitle(page) {
  const prop = Object.values(page.properties).find((p) => p.type === "title");
  return prop?.title?.map((t) => t.plain_text).join("") ?? "(sin título)";
}

function getProp(page, name) {
  return page.properties[name];
}

async function countBlocks(pageId) {
  let total = 0;
  let cursor;
  do {
    const res = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
    });
    total += res.results.length;
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return total;
}

async function main() {
  console.log(`Database: ${DB_ID}\n`);

  let cursor;
  const pages = [];
  do {
    const res = await notion.databases.query({
      database_id: DB_ID,
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  console.log(`Total páginas en la database: ${pages.length}\n`);
  console.log("─".repeat(80));

  for (const page of pages) {
    const title = getTitle(page);
    const estado = getProp(page, "Estado")?.select?.name ?? "(sin estado)";
    const fechaIRL = getProp(page, "Fecha IRL")?.date?.start ?? "—";
    const fechaMundo =
      getProp(page, "Fecha-mundo")?.rich_text?.map((t) => t.plain_text).join("") || "—";
    const blocks = await countBlocks(page.id);
    const created = new Date(page.created_time).toLocaleString("es-ES");
    const edited = new Date(page.last_edited_time).toLocaleString("es-ES");

    console.log(`\n📄 ${title}`);
    console.log(`   id:           ${page.id}`);
    console.log(`   Estado:       ${estado}`);
    console.log(`   Fecha IRL:    ${fechaIRL}`);
    console.log(`   Fecha-mundo:  ${fechaMundo}`);
    console.log(`   Bloques body: ${blocks}`);
    console.log(`   Creada:       ${created}`);
    console.log(`   Editada:      ${edited}`);
    console.log(`   URL:          ${page.url}`);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
