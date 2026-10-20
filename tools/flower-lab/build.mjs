/**
 * Đóng gói Flower Lab thành MỘT file HTML tự chứa để chạy được bằng file://
 * (không phụ thuộc dev server, không phụ thuộc importmap).
 *
 *   node tools/flower-lab/build.mjs
 *
 * Kết quả: tools/flower-lab/flower-lab.html
 * Toàn bộ JS (three + mã nguồn dự án) được nội tuyến dưới dạng <script type="module">.
 */
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const outFile = resolve(here, "flower-lab.html");

const result = await build({
    entryPoints: [resolve(here, "lab.js")],
    bundle: true,
    format: "esm",
    target: "es2022",
    minify: true,
    legalComments: "none",
    write: false,
    absWorkingDir: root,
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "info",
});

const js = result.outputFiles[0].text;
const shell = readFileSync(resolve(here, "index.html"), "utf8");

/* Bundle có thể chứa chuỗi `</script>` (vd trong mã của three.js) — phải
   thoát ra để trình duyệt không cắt ngắn thẻ script. */
const safeJs = js
    .replaceAll("</script", "<\\/script")
    .replaceAll("<!--", "<\\!--");

/* Dùng hàm thay thế để `$&` / `$1` trong JS không bị hiểu là pattern. */
const html = shell.replace(
    '<script type="module" src="./lab.js"></script>',
    () => `<script type="module">\n${safeJs}\n</script>`,
);

writeFileSync(outFile, html, "utf8");
console.log(`✔ ${outFile}`);
console.log(`  ${(html.length / 1024).toFixed(0)} KB`);
