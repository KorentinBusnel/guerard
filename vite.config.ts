import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  // Seules les variables VITE_* atteignent le bundle : MAPMAP_API_KEY (serveur) reste hors du navigateur.
  envPrefix: "VITE_",
  build: {
    target: "es2022",
  },
});
