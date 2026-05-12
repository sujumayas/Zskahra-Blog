# Zskahra-Blog

Blog estático de crónicas de sesión TTRPG. Los jugadores escriben en Notion, el sitio se publica desde Astro + Netlify.

## Stack

- **Astro 6** (`output: "static"` con un endpoint SSR opt-in) + **TypeScript strict**
- **Tailwind v4** vía `@tailwindcss/vite` + `@tailwindcss/typography`
- **Vite 7** (pinneado por compatibilidad con `@tailwindcss/vite` 4.2.x)
- **Notion** como CMS (`@notionhq/client` + `notion-to-md`)
- **Marked** para markdown → HTML + extensión custom para wikilinks `[[X]]`
- **Netlify** (Free) para hosting y para la única función serverless (`/api/rebuild`)

## Setup local

```bash
npm install
cp .env.example .env   # luego rellena NOTION_TOKEN y NOTION_PARENT_PAGE
npm run setup:notion   # crea database + página template (idempotente)
npm run dev
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de dev en `localhost:4321` |
| `npm run build` | Build estático a `dist/` + función `.netlify/functions-internal/` |
| `npm run preview` | Preview del build |
| `npm run setup:notion` | Crea (o reusa) la database y página template en Notion |

## Variables de entorno

| Var | Para qué | Dónde |
|---|---|---|
| `NOTION_TOKEN` | Token de la integración interna de Notion | `.env` local + Netlify env |
| `NOTION_PARENT_PAGE` | ID de la página padre en Notion (parent de la database) | `.env` local |
| `NOTION_DATABASE_ID` | ID de la database de crónicas | `.env` local + Netlify env |
| `REBUILD_TOKEN` | Token que valida llamadas al endpoint `/api/rebuild` | Netlify env (no hace falta local) |
| `NETLIFY_BUILD_HOOK_URL` | URL del build hook de Netlify | Netlify env |

## Deploy en Netlify

### 1. Conectar el repo

1. [app.netlify.com](https://app.netlify.com/) → **Add new site** → **Import an existing project** → GitHub → `Zskahra-Blog`.
2. Build settings se autodetectan desde el adapter:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Antes del primer deploy, en **Site settings → Environment variables**, añade:
   - `NOTION_TOKEN`
   - `NOTION_DATABASE_ID`
4. Lanza el primer deploy.

### 2. Configurar el rebuild on-demand

Esto permite que un botón en Notion dispare el rebuild en ~2 minutos (cero costo).

1. **Generar token**:
   ```bash
   openssl rand -hex 24
   ```
   Guarda ese string — lo necesitas en dos lugares.

2. **Crear el Build Hook** en Netlify:
   `Site settings → Build & deploy → Build hooks → Add build hook`
   - Name: `Notion publish button`
   - Branch: `main`
   - Copia la URL que aparece (algo tipo `https://api.netlify.com/build_hooks/abc123...`).

3. **Añadir env vars en Netlify** (Site settings → Environment variables):
   - `REBUILD_TOKEN` = el string del paso 1
   - `NETLIFY_BUILD_HOOK_URL` = la URL del paso 2
   - Deploy el sitio para que tome los nuevos vars.

4. **Configurar el botón en Notion** (database "Crónicas de Sesión" → property "+ Add property" → Button):
   - Label: `Publicar`
   - Acción 1: `Edit pages` → set `Estado` to `Publicado` (en esta página)
   - Acción 2: `Open URL` → URL:
     ```
     https://<tu-sitio>.netlify.app/api/rebuild?token=<el-token-del-paso-1>
     ```
   - Save.

Al click: la página se marca Publicado, abre una pestaña que dispara el build, ~2 min después aparece en el sitio.

## Notion

- **Database**: `Crónicas de Sesión` (ID en `.env` como `NOTION_DATABASE_ID`)
- **Template**: configurado como "tipo de contenido" en Notion. Cada nueva entrada arranca con properties listas y cuerpo libre.
- **Wikilinks**: usar `[[Nombre]]` o `[[Nombre|alias]]` en el cuerpo. Cada uno genera una página placeholder en `/wiki/<slug>/` con back-references a las crónicas que la mencionan.

## Convenciones

- Path aliases: `@/lib`, `@/components`, `@/layouts` (ver `tsconfig.json`)
- Imágenes descargadas de Notion viven en `public/images/notion/` (gitignored — se regeneran en build)
- Estilos: Tailwind v4 CSS-first. Theme tokens en `src/styles/global.css` (paleta `ink-*` + `ember-*`).
- Todas las páginas se prerenderean en build. Solo `src/pages/api/rebuild.ts` opta a SSR (`export const prerender = false`) y corre como Netlify Function on-demand.
