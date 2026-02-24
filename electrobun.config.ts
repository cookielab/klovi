import type { ElectrobunConfig } from "electrobun";
import pkg from "./package.json" with { type: "json" };

const version = pkg.version == null || pkg.version === "0.0.0" ? "dev" : pkg.version;
const isDev = process.argv.includes("dev");

export default {
  app: {
    name: "Klovi",
    identifier: "io.cookielab.klovi",
    version: version,
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    views: {
      main: {
        entrypoint: "src/views/main/index.ts",
      },
    },
    copy: {
      "src/views/main/index.html": "views/main/index.html",
    },
    mac: {
      bundleCEF: isDev,
      defaultRenderer: isDev ? "cef" : "native",
      ...(isDev && {
        chromiumFlags: {
          "remote-debugging-port": "9222",
        },
      }),
      icons: "icon.iconset",
    },
    linux: {
      bundleCEF: true,
      defaultRenderer: "cef",
    },
    win: {
      defaultRenderer: "native",
    },
  },
} satisfies ElectrobunConfig;
