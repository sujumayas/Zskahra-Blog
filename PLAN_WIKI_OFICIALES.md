# Plan: Páginas wiki con contenido oficial

> Plan para la siguiente sesión. Cuando arranques con Claude Code de nuevo, dile "abre PLAN_WIKI_OFICIALES.md y ejecútalo".

## Contexto

Hoy, cada `[[Nombre]]` en una crónica genera una página placeholder en `/wiki/<slug>/` que dice "Esta entidad aún no tiene página oficial" + lista de crónicas que la mencionan (back-references).

Queremos que el dueño del blog (y eventualmente cualquier jugador) pueda escribir **contenido oficial** para entidades importantes — personajes, lugares, facciones, eventos, conceptos — y que ese contenido aparezca en `/wiki/<slug>/` junto a las back-references calculadas.

Mismo flujo que las crónicas: editar en Notion, publicar, rebuild automático.

## Decisión clave: segunda database en Notion

**Recomendado**: nueva DB "Entidades" en el mismo parent page que "Crónicas de Sesión".

Por qué Notion (vs. archivos markdown locales):
- Mismo flujo de edición que ya conocen los jugadores
- Comparte token e integración
- Cualquier jugador puede contribuir documentando su PJ o lugares que le importen
- Imágenes, embeds, formato rico funcionan igual que en crónicas

## Schema propuesto de la DB "Entidades"

| Property | Tipo | Notas |
|---|---|---|
| **Nombre** | title | Nombre canónico. Debe matchear los `[[X]]` que se escriben en crónicas (vía slug normalizado). |
| **Tipo** | select | Opciones: Personaje · Lugar · Facción · Objeto · Evento · Concepto |
| **Estado** | select | Borrador · Publicado (mismo patrón que crónicas) |
| **Resumen** | rich_text | 1-2 líneas. Aparece bajo el título. |
| **Alias** | rich_text | Comma-separated. Para que `[[El Cronista]]` también resuelva a Zal si tiene ese alias. Ej: "El Cronista, hijo de Olsar" |
| **Etiquetas** | multi_select | Libre |
| **Imagen destacada** | files | Opcional. Aparece arriba del resumen. |

Cuerpo libre. El autor escribe como quiera (puede usar `[[]]` para enlazar a otras entidades).

## Cambios al código

### `scripts/setup-notion.mjs`

Extender para crear (idempotente) la segunda DB:
- Crear "Entidades" en el mismo `NOTION_PARENT_PAGE`
- Crear página template "📋 TEMPLATE — Entidad" dentro con callout instructivo
- Imprimir `NOTION_ENTITIES_DATABASE_ID` al final para añadir a `.env`

### `src/env.d.ts` + `.env.example` + `README.md`

Nueva var: `NOTION_ENTITIES_DATABASE_ID`. Local + Netlify.

### `src/lib/notion-types.ts`

Añadir:
```typescript
export interface EntityMeta {
  notionId: string;
  slug: string;
  name: string;
  type: string | null;
  resumen: string;
  aliases: string[];        // parseados del rich_text "Alias"
  etiquetas: string[];
  imageUrl: string | null;  // primer archivo de "Imagen destacada", descargado a public/images/notion/
}
export interface EntityFull extends EntityMeta {
  html: string;
  headings: Heading[];
}
```

Helper para `aliases`: split por `,`, trim, slugify cada uno.

### `src/lib/notion.ts`

Añadir:
- `listPublishedEntities(): Promise<EntityMeta[]>` — query DB Entidades con Estado=Publicado, cache en memoria.
- `getEntityBySlug(slug): Promise<EntityFull | null>` — busca por slug canónico **o** por alias.
- `buildAliasMap(): Promise<Map<string, string>>` — map de `aliasSlug → canonicalSlug` para que los wikilinks resuelvan vía alias.

### `src/lib/markdown.ts`

Modificar el renderer del wikilink para consultar el alias map antes de generar el href:
- Antes de cada render, cargar `aliasMap` (vía import dinámico de notion.ts).
- Si `slugify(target)` está en el map, usar el canonical slug.

**Cuidado**: esto crea dependencia circular (notion.ts importa markdown.ts y viceversa). Solución: el alias map se pasa como parámetro a `pageToRendered(pageId, aliasMap)`. notion.ts lo carga primero y luego renderiza todas las crónicas.

### `src/pages/wiki/[slug].astro`

Reescribir la lógica:

1. `getStaticPaths` produce **unión** de slugs:
   - Todas las entidades publicadas (incluyendo alias)
   - Más todos los wikilinks mencionados en crónicas

2. En el render:
   ```
   if (hay entidad oficial):
     header con tipo + nombre + imagen + resumen
     <Prose> con el contenido oficial
     <TocSidebar> si hay headings
     sección "Mencionada en" con back-refs
   else:
     placeholder "Aún no documentada"
     sección "Mencionada en"
   ```

3. Si el slug entró por alias, el page hace 301 redirect al canonical slug (o renderiza el contenido del canonical — preferir lo segundo, menos clicks).

## Etapas de implementación

Ordenadas para que cada commit sea coherente:

1. **Setup script + env**: extender `setup-notion.mjs`, ejecutar contra Notion, actualizar `.env` y docs.
2. **Tipos + queries**: añadir `EntityMeta/Full` a notion-types y los queries a notion.ts. Sin tocar UI todavía.
3. **Alias map en render**: pasar el map a `pageToRendered`, modificar el wikilink renderer.
4. **UI**: reescribir `wiki/[slug].astro` con la lógica unión.
5. **Imágenes destacadas**: descargar el primer archivo de "Imagen destacada" igual que las imágenes de crónicas.
6. **Smoke test**: crear 2-3 entidades en Notion (al menos una con alias), build, verificar todos los casos: entidad publicada + back-refs, entidad sin oficial (solo back-refs), alias resuelve, wikilink en cuerpo de entidad.
7. **Docs**: actualizar `GUIA_CRONISTAS.md` mencionando que hay wiki oficial y mini guía para crear entidades.

## Antes de arrancar — preguntas / data que necesito de ti

1. ¿La DB "Entidades" va en el mismo parent page que "Crónicas de Sesión", o quieres que viva en otro lado?
2. ¿Quieres que cualquier jugador pueda crear entidades, o solo tú al inicio? (afecta UX de la guía, no el código)
3. ¿Lista de tipos OK como propuesto (Personaje · Lugar · Facción · Objeto · Evento · Concepto), o cambiamos/agregamos algo?
4. (Opcional pero útil) Si puedes pre-poblar 2-3 entidades en Notion antes de la sesión (ej. "Zal", "Logven", "La Cuenta"), testeamos con data real desde el primer build.

## Out of scope para esta iteración

Cosas tentadoras pero que se pueden hacer después si las quieres:
- Editor de relaciones explícitas entre entidades ("Zal es hijo de Olsar")
- Búsqueda full-text en el wiki
- Páginas índice por tipo ("todos los personajes", "todos los lugares")
- Versiones / historial de cambios de entidades
- Mapas, timelines, árboles genealógicos

## Estimación

~2-3 horas en una sola sesión, con todas las etapas anteriores.

## Notas técnicas relevantes (cosas que ya sé del setup actual)

- `NOTION_PARENT_PAGE=35ed8c0d302180439483fbcfc7722589`
- `NOTION_DATABASE_ID=35ed8c0d30218176a3f4e7bcebe086eb` (Crónicas)
- Pipeline actual genera 33 páginas estáticas (1 crónica, 31 wikis placeholder, index)
- Astro 6 con `output: "static"` + adapter Netlify. Solo `/api/rebuild` es SSR.
- Vite pinneado a 7.x por compatibilidad con `@tailwindcss/vite` 4.2.x.
- Tailwind v4 con tokens `ink-*` y `ember-*` en `src/styles/global.css`.
- Path aliases: `@/lib`, `@/components`, `@/layouts`.
