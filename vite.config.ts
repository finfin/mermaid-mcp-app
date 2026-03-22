import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  root: "src/view",
  plugins: [viteSingleFile()],
  build: {
    outDir: "../../dist/view",
    emptyOutDir: true,
    target: "es2022",
  },
});
