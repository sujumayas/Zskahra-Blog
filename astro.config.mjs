import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "static",
  site: "https://zskahra-blog.netlify.app",
  vite: {
    plugins: [tailwindcss()],
  },
});
