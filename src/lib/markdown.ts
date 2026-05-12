import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import { marked } from "marked";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, extname } from "node:path";

const notion = new Client({ auth: import.meta.env.NOTION_TOKEN });

const n2m = new NotionToMarkdown({
  notionClient: notion,
  config: { parseChildPages: false },
});

n2m.setCustomTransformer("image", async (block) => {
  // @ts-expect-error notion-to-md no expone tipos buenos para el block
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
    // @ts-expect-error block.id existe en blocks reales
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
  const dir = resolve(process.cwd(), "public/images/notion");
  const filename = `${flatId}${ext}`;
  const fullPath = resolve(dir, filename);
  const publicPath = `/images/notion/${filename}`;

  if (existsSync(fullPath)) return publicPath;

  await mkdir(dir, { recursive: true });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(fullPath, buffer);
  return publicPath;
}

marked.setOptions({ gfm: true, breaks: false });

export async function pageToHtml(pageId: string): Promise<string> {
  const blocks = await n2m.pageToMarkdown(pageId);
  const md = n2m.toMarkdownString(blocks).parent ?? "";
  return marked.parse(md) as string;
}
