// Copies the assets the Next.js standalone server needs next to it but does not bundle
// itself (documented at https://nextjs.org/docs/app/api-reference/config/next-config-js/output):
// the static chunks, and public/ if the project has one. Runs after every `next build`.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const standalone = join(root, ".next", "standalone");

if (!existsSync(standalone)) {
  console.log('no .next/standalone (output: "standalone" not built); skipping');
  process.exit(0);
}

const staticSrc = join(root, ".next", "static");
const staticDest = join(standalone, ".next", "static");
mkdirSync(staticDest, { recursive: true });
cpSync(staticSrc, staticDest, { recursive: true });
console.log(`copied .next/static -> ${staticDest}`);

const publicSrc = join(root, "public");
if (existsSync(publicSrc)) {
  const publicDest = join(standalone, "public");
  cpSync(publicSrc, publicDest, { recursive: true });
  console.log(`copied public/ -> ${publicDest}`);
}
