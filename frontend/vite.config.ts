import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

const appPublishedAt = "2026-06-11T00:00:00.000Z";
const buildModifiedAt = new Date().toISOString();

export default defineConfig({
  define: {
    __SECSA_PUBLISHED_AT__: JSON.stringify(appPublishedAt),
    __SECSA_BUILD_MODIFIED_AT__: JSON.stringify(buildModifiedAt),
  },
  plugins: [    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["secsa.png"],
      devOptions: {
        enabled: false,
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
      },
      manifest: {
        name: "SECSA Exam Platform",
        short_name: "SECSA",
        description:
          "SECSA Academic Quality Assurance Portal. Created by Josiah P. Ariston. Last updated at build time.",
        theme_color: "#1e3a5f",
        background_color: "#f8fafc",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "secsa.png",
            sizes: "500x500",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "secsa.png",
            sizes: "500x500",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
});
