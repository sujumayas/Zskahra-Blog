import type { APIRoute } from "astro";

export const prerender = false;

type Kind = "success" | "error";

function htmlPage(kind: Kind, badge: string, title: string, message: string): string {
  const accent = kind === "success" ? "#f0a868" : "#c97b3a";
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${escape(title)} · Zskahra</title>
<style>
  :root {
    --bg: #0b0a07;
    --card: rgba(28,24,16,0.7);
    --border: rgba(155,136,102,0.25);
    --text: #e8dcc4;
    --muted: #c9b89a;
    --accent: ${accent};
  }
  * { box-sizing: border-box; }
  body {
    min-height: 100vh; margin: 0;
    background: var(--bg); color: var(--text);
    display: flex; align-items: center; justify-content: center;
    font-family: ui-serif, Georgia, "Times New Roman", serif;
    padding: 24px;
  }
  main {
    max-width: 480px; width: 100%;
    border: 1px solid var(--border);
    background: var(--card);
    border-radius: 6px;
    padding: 40px 32px;
    text-align: center;
  }
  .badge {
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 12px; text-transform: uppercase;
    letter-spacing: 0.25em; color: var(--accent);
    margin: 0;
  }
  h1 {
    font-weight: 300; font-size: 32px;
    margin: 12px 0 16px; color: white;
    line-height: 1.2;
  }
  p {
    color: var(--muted); line-height: 1.6;
    margin: 0; font-size: 16px;
  }
  .hint {
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 13px; margin-top: 24px;
    color: rgba(201, 184, 154, 0.6);
  }
</style>
</head>
<body>
  <main>
    <p class="badge">${escape(badge)}</p>
    <h1>${escape(title)}</h1>
    <p>${escape(message)}</p>
    ${kind === "success" ? `<p class="hint">Puedes cerrar esta pestaña.</p>` : ""}
  </main>
</body>
</html>`;
}

function escape(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function htmlResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export const GET: APIRoute = async ({ request }) => {
  const expectedToken = import.meta.env.REBUILD_TOKEN;
  const buildHookUrl = import.meta.env.NETLIFY_BUILD_HOOK_URL;

  if (!expectedToken || !buildHookUrl) {
    return htmlResponse(
      500,
      htmlPage(
        "error",
        "Configuración",
        "Falta configurar el servidor",
        "El sitio aún no tiene REBUILD_TOKEN o NETLIFY_BUILD_HOOK_URL en las variables de entorno. Avisa al admin del blog.",
      ),
    );
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (token !== expectedToken) {
    return htmlResponse(
      401,
      htmlPage(
        "error",
        "Acceso denegado",
        "Token inválido",
        "Este enlace no es válido o ha sido cambiado. Si publicar es importante, contacta al admin del blog.",
      ),
    );
  }

  try {
    const res = await fetch(buildHookUrl, { method: "POST" });
    if (!res.ok) {
      throw new Error(`build hook respondió HTTP ${res.status}`);
    }
  } catch (err) {
    return htmlResponse(
      502,
      htmlPage(
        "error",
        "Algo salió mal",
        "No pude pedir el rebuild",
        `Detalle técnico: ${(err as Error).message}. Espera unos minutos y prueba otra vez.`,
      ),
    );
  }

  return htmlResponse(
    200,
    htmlPage(
      "success",
      "Confirmación",
      "✓ Rebuild solicitado",
      "Tu crónica aparecerá publicada en el sitio en ~2 minutos.",
    ),
  );
};
