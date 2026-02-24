import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "Klovi",
    identifier: "io.cookielab.klovi",
    version: "2.1.0",
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
      defaultRenderer: "native",
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
