import { createRequire } from "node:module";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

const FACES = [
  "Vazir-Regular-FD.woff2",
  "Vazir-Medium-FD.woff2",
  "Vazir-Bold-FD.woff2",
  "Vazir-Black-FD.woff2",
];

const pkgRoot = dirname(require.resolve("vazir-font/package.json"));
const src = join(pkgRoot, "dist", "Farsi-Digits");
const dst = join(here, "..", "src", "fonts");

await mkdir(dst, { recursive: true });
for (const face of FACES) {
  await copyFile(join(src, face), join(dst, face));
  console.log(`copied ${face}`);
}
