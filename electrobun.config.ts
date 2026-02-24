import type { ElectrobunConfig } from "electrobun";

const isDev = process.argv.includes("dev");

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
