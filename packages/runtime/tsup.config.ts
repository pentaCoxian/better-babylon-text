import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts", "src/vendor/msdfText/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    treeshake: true,
    external: ["@babylonjs/core"],
    loader: {
        ".fx": "text",
    },
    esbuildOptions(options) {
        options.banner = {
            js: "/* @bettertext/babylon-tmp-text - MIT License */",
        };
    },
});
