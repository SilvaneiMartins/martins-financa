import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base relativo: funciona no GitHub Pages (subpasta do repositório) e em domínio próprio.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
});
