import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
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
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    hmr: {
      clientPort: 5173,
    },
    proxy: {
      "/api": "http://127.0.0.1:3001",
      "/uploads": "http://127.0.0.1:3001",
    },
  },
});
