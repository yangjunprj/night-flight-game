import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // relative base so the built files work both at the repo root and under
  // https://<user>.github.io/<repo>/ on GitHub Pages
  base: "./",
});
