/**
 * build-site.mjs — Đóng gói trang tĩnh cho GitHub Pages.
 *
 *   node tools/build-site.mjs
 *
 * Kết quả trong thư mục `dist/`:
 *   dist/index.html            (đã bỏ importmap, trỏ script đã bundle)
 *   dist/app.js                (three + toàn bộ mã nguồn đã bundle)
 *   dist/assets/app.css        (Tailwind đã build)
 *   dist/assets/imgs|audio/    (ảnh + nhạc nền)
 *   dist/vendor/html-to-image.js
 *
 * Mọi đường dẫn đều tương đối ("./assets/...") nên chạy được cả ở
 * https://<user>.github.io/<repo>/ lẫn domain riêng.
 */
import { build } from "esbuild";
import { cp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dist = resolve(root, "dist");

const banner = `/* Vuồn Hoa Yêu Thương — bản build cho GitHub Pages */`;

async function main() {
    await rm(dist, { recursive: true, force: true });
    await mkdir(resolve(dist, "assets"), { recursive: true });
    await mkdir(resolve(dist, "vendor"), { recursive: true });

    // 1) Bundle JS (three + app vào 1 file)
    await build({
        entryPoints: [resolve(root, "src/main.js")],
        bundle: true,
        format: "esm",
        target: ["es2020"],
        minify: true,
        legalComments: "none",
        outfile: resolve(dist, "app.js"),
        banner: { js: banner },
        logLevel: "info",
    });

    // 2) HTML: bỏ importmap, đổi đường dẫn script
    let html = await readFile(resolve(root, "index.html"), "utf8");
    html = html.replace(
        /<script type="importmap">[\s\S]*?<\/script>\s*/,
        "",
    );
    html = html.replace(
        'src="./node_modules/html-to-image/dist/html-to-image.js"',
        'src="./vendor/html-to-image.js"',
    );
    html = html.replace(
        '<script type="module" src="./src/main.js"></script>',
        '<script type="module" src="./app.js"></script>',
    );
    await writeFile(resolve(dist, "index.html"), html, "utf8");

    // 3) CSS + tài nguyên
    await cp(resolve(root, "assets/app.css"), resolve(dist, "assets/app.css"));
    // Chỉ copy bản ảnh ĐÃ TỐI ƯU (opt/) — bản gốc có file 42MB,
    // không nên đưa lên Pages.
    await cp(resolve(root, "assets/imgs/opt"), resolve(dist, "assets/imgs/opt"), {
        recursive: true,
    });
    await cp(resolve(root, "assets/audio"), resolve(dist, "assets/audio"), {
        recursive: true,
    });
    await cp(
        resolve(root, "node_modules/html-to-image/dist/html-to-image.js"),
        resolve(dist, "vendor/html-to-image.js"),
    );

    console.log("\n✔ dist/ sẵn sàng — dùng cho GitHub Pages\n");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
