import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Local-first PWA. No backend, no auth, no sync (0A scope).
export default defineConfig({
  plugins: [react()],
  base: "./",
  test: {
    globals: true,
    environment: "node",
  },
});
