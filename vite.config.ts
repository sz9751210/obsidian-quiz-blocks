import { pathToFileURL } from "url";
import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { builtinModules } from "node:module";
import { defineConfig, type PluginOption } from "vite";

function setOutDir(mode: string) {
	switch (mode) {
		case "development":
			return "./_test-vault/.obsidian/plugins/quiz-blocks";
		case "production":
			return ".";
	}
}

export default defineConfig(({ mode }) => {
	const prod = mode === 'production';
	return {
		plugins: [
			svelte({ preprocess: vitePreprocess() }) as PluginOption,
		],
		build: {
			lib: {
				entry: "src/main",
				formats: ["cjs"],
			},
			rollupOptions: {
				output: {
					entryFileNames: "main.js",
					assetFileNames: "styles.css",
					sourcemapBaseUrl:
						pathToFileURL(`${__dirname}/_test-vault/.obsidian/plugins/quiz-blocks/`).toString(),
				},
				external: [
					"obsidian",
					"electron",
					"@codemirror/autocomplete",
					"@codemirror/collab",
					"@codemirror/commands",
					"@codemirror/language",
					"@codemirror/lint",
					"@codemirror/search",
					"@codemirror/state",
					"@codemirror/view",
					"@lezer/common",
					"@lezer/highlight",
					"@lezer/lr",
					...builtinModules,
				],
			},
			outDir: setOutDir(mode),
			emptyOutDir: false,
			target: "es2018",
			sourcemap: prod ? false : "inline",
			minify: prod,
		},
	};
});
