import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const root = fileURLToPath(new URL("./client", import.meta.url));
const output = fileURLToPath(new URL("./dist/client", import.meta.url));

function standaloneClient(): Plugin {
  return {
    name: "standalone-workshop-client",
    apply: "build",
    async closeBundle() {
      const template = await readFile(
        new URL("./client/index.html", import.meta.url),
        "utf8",
      );
      const html = template
        .replace(
          /<script\s+type="module"\s+src="\.\/main\.tsx"><\/script>/,
          '<script defer src="./game.js"></script>',
        )
        .replace("</head>", '  <link rel="stylesheet" href="./game.css" />\n</head>');
      if (html.includes("main.tsx") || html.includes('type="module"')) {
        throw new Error("The standalone client still contains an ES module entry.");
      }
      await writeFile(new URL("./dist/client/index.html", import.meta.url), html);
    },
  };
}

export default defineConfig(({ command }) => ({
  root,
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  base: "./",
  plugins: [react(), standaloneClient()],
  define:
    command === "build"
      ? { "process.env.NODE_ENV": JSON.stringify("production") }
      : undefined,
  build: {
    outDir: output,
    // Keep standalone assets beside the HTML entry.
    assetsDir: "",
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL("./client/main.tsx", import.meta.url)),
      name: "CaptureTheCrown",
      formats: ["iife"],
      fileName: () => "game.js",
      cssFileName: "game",
    },
    license: true,
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
}));
