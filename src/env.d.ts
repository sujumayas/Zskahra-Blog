/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly NOTION_TOKEN: string;
  readonly NOTION_PARENT_PAGE: string;
  readonly NOTION_DATABASE_ID: string;
  readonly REBUILD_TOKEN?: string;
  readonly NETLIFY_BUILD_HOOK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
