import { defineConfig } from "astro/config";
import netlify from "@astrojs/netlify";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Sitio mayormente estático. Solo /api/rebuild opta a SSR vía
  // `export const prerender = false` y corre como Netlify Function.
  output: "static",
  adapter: netlify(),
  site: "https://zskahra-blog.netlify.app",
  vite: {
    plugins: [tailwindcss()],
  },
});
