import process from "node:process";
import tailwindPlugin from "bun-plugin-tailwind";

const isWatch = process.argv.includes("--watch");
const isMinify = process.argv.includes("--minify");

await Bun.build({
	entrypoints: ["src/index.html"],
	outdir: "dist",
	plugins: [tailwindPlugin],
	minify: isMinify,
	...(isWatch ? { watch: true } : {}),
});
