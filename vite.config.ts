import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import pkg from "./package.json";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  root: "src/view",
  plugins: [viteSingleFile()],
  build: {
    outDir: "../../dist/view",
    emptyOutDir: true,
    target: "es2022",
  },
});
