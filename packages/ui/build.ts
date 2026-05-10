import tailwindPlugin from "bun-plugin-tailwind";

const isWatch = Bun.argv.includes("--watch");
const isMinify = Bun.argv.includes("--minify");

await Bun.build({
	entrypoints: ["src/index.html"],
	outdir: "dist",
	plugins: [tailwindPlugin],
	minify: isMinify,
	...(isWatch ? { watch: true } : {}),
});
