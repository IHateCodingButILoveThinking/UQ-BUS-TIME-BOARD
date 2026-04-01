import { defineConfig, transformWithOxc } from "vite";
import react from "@vitejs/plugin-react";

function jsAsJsx() {
  return {
    name: "js-as-jsx",
    enforce: "pre",
    async transform(code, id) {
      if (!id.includes("/src/") || !id.endsWith(".js")) {
        return null;
      }

      return transformWithOxc(code, id, {
        lang: "jsx",
        jsx: {
          runtime: "automatic",
        },
      });
    },
  };
}

export default defineConfig({
  plugins: [jsAsJsx(), react()],
  oxc: {
    include: /\.[jt]sx?$/,
    exclude: /\/node_modules\//,
  },
  optimizeDeps: {
    rolldownOptions: {
      moduleTypes: {
        ".js": "jsx",
      },
    },
  },
  build: {
    rollupOptions: {
      moduleTypes: {
        ".js": "jsx",
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
});
