import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [{ name: "vite:tsconfig-paths" }, tailwindcss()],
});
