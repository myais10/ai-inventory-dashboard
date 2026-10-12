// Builds a single self-contained HTML file of the app (no server) for static hosting:
//   npm run build && node static-demo/build.mjs   →  static-demo/dist/index.html
import { build } from "esbuild";
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const shim = (f) => join(here, "shims", f);

const SHIMS = {
  "next/link": shim("next-link.tsx"),
  "next/navigation": shim("next-navigation.ts"),
  "next/cache": shim("next-misc.ts"),
  "next/headers": shim("next-misc.ts"),
  "next/server": shim("next-misc.ts"),
  "server-only": shim("empty.ts"),
  "@/lib/auth/session": shim("session.ts"),
  "@/lib/supabase/server": shim("supabase-server.ts"),
};

const result = await build({
  entryPoints: [join(here, "main.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  write: false,
  tsconfig: join(root, "tsconfig.json"),
  logLevel: "warning",
  logOverride: { "unsupported-directive": "silent" },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_STATIC_DEMO": '"1"',
    "process.env.NEXT_PUBLIC_SUPABASE_URL": '""',
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": '""',
    "process.env.AUTH_SECRET": '""',
  },
  plugins: [
    {
      name: "shims",
      setup(b) {
        const filter = new RegExp(`^(${Object.keys(SHIMS).map((k) => k.replace(/[/@-]/g, "\\$&")).join("|")})$`);
        b.onResolve({ filter }, (args) => ({ path: SHIMS[args.path] }));
      },
    },
  ],
});

const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

// Reuse the Tailwind CSS compiled by `next build`; drop next/font faces (loaded from Google Fonts instead).
const cssDir = join(root, ".next/static/css");
const css = readdirSync(cssDir)
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(join(cssDir, f), "utf8"))
  .join("\n")
  .replace(/@font-face\{[^}]*\}/g, "");

const html = `<title>Inventory Intelligence</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>${css}
:root{color-scheme:light;--font-inter:"Inter",ui-sans-serif,system-ui,sans-serif;--font-jbmono:"JetBrains Mono",ui-monospace,monospace}
html,body{background:#f6f7f9;color:#0b1220}
body{font-family:var(--font-inter)}
</style>
<div id="root" class="font-sans antialiased"></div>
<script>${js}</script>
`;
mkdirSync(join(here, "dist"), { recursive: true });
writeFileSync(join(here, "dist/index.html"), html);
console.log(`static-demo/dist/index.html  ${(html.length / 1024 / 1024).toFixed(2)} MB`);
