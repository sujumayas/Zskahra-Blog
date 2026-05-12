# Zskahra-Blog

Blog estático de crónicas de sesión TTRPG. Los jugadores escriben en Notion, el sitio se publica desde Astro + Netlify.

## Stack

- **Astro 6** (`output: "static"`) + **TypeScript strict**
- **Tailwind v4** vía `@tailwindcss/vite`
- **Vite 7** (pinneado por compatibilidad con `@tailwindcss/vite` 4.2.x)
- **Notion** como CMS (`@notionhq/client` + `notion-to-md`)
- **Netlify** (Free) para hosting
- **GitHub Actions** (cron cada ~15 min) para disparar rebuild cuando hay nuevas crónicas

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
| `npm run build` | Build estático a `dist/` |
| `npm run preview` | Preview del build |
| `npm run setup:notion` | Crea (o reusa) la database y página template en Notion |

## Variables de entorno

| Var | Para qué | Dónde |
|---|---|---|
| `NOTION_TOKEN` | Token de la integración interna de Notion | `.env` local + Netlify env |
| `NOTION_PARENT_PAGE` | ID de la página padre en Notion (parent de la database) | `.env` local |
| `NOTION_DATABASE_ID` | ID de la database de crónicas (output de `setup:notion`) | `.env` local + Netlify env |

## Notion

- **Database**: `Crónicas de Sesión` (ID en `.env` como `NOTION_DATABASE_ID`)
- **Template**: página `📋 TEMPLATE — Duplica esta página` dentro de la database
- **Property `Publicar` (button)**: no se puede crear vía API. Añadir manual en Notion si se quiere UX de un clic. Acción: cambiar `Estado` → `Listo`.

## Convenciones

- Path aliases: `@/lib`, `@/components`, `@/layouts` (ver `tsconfig.json`)
- Imágenes descargadas de Notion viven en `public/images/notion/` (gitignored — se regeneran en build)
- Estilos: Tailwind v4 CSS-first. Theme tokens en `src/styles/global.css` (paleta `ink-*` + `ember-*`).
