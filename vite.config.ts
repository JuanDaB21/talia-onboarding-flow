// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Deploy en Railway (fuera del sandbox de Lovable): forzar la salida de Nitro al
  // preset Node en vez del fallback `cloudflare-module`. Genera un server autónomo en
  // `.output/server/index.mjs` que se arranca con `node .output/server/index.mjs` y
  // escucha en `PORT` (lo inyecta Railway). Dentro del sandbox de Lovable esto se ignora
  // (el wrapper fuerza Cloudflare allí), así que el preview de Lovable no se ve afectado.
  nitro: { preset: "node-server" },
});
