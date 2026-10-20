/**
 * font-embed.js — Nhúng @font-face (kể cả font tải từ Google) vào ảnh xuất.
 *
 * html-to-image mặc định cố đọc `cssRules` của mọi <link> stylesheet để
 * nhúng font — nhưng stylesheet cross-origin (fonts.googleapis.com) bị chặn
 * theo CORS → SecurityError → ảnh thiệp ra trắng/trống.
 *
 * Cách sửa: tự tải CSS + file font (CORS cho phép), nhúng thành data URL
 * rồi đưa vào tuỳ chọn `fontEmbedCSS` của html-to-image.
 */

let cache = null;

function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
    });
}

export async function getEmbeddableFontCSS() {
    if (cache !== null) return cache;
    cache = "";
    try {
        const hrefs = [...document.querySelectorAll('link[rel="stylesheet"]')]
            .map((l) => l.href)
            .filter((h) => h && h.includes("fonts.googleapis.com"));
        if (!hrefs.length) return cache;

        const chunks = [];
        for (const href of hrefs) {
            const css = await fetch(href).then((r) => r.text());
            const urls = [
                ...new Set(
                    [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(
                        (m) => m[1],
                    ),
                ),
            ];
            let inlined = css;
            for (const u of urls) {
                try {
                    const data = await fetch(u)
                        .then((r) => r.blob())
                        .then(blobToDataURL);
                    inlined = inlined.split(u).join(data);
                } catch {
                    /* bỏ qua font này */
                }
            }
            chunks.push(inlined);
        }
        cache = chunks.join("\n");
    } catch {
        cache = "";
    }
    return cache;
}

/** Gọi html-to-image kèm font đã nhúng. */
export async function toPngWithFonts(node, options = {}) {
    const fontEmbedCSS = await getEmbeddableFontCSS();
    return window.htmlToImage.toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        ...(fontEmbedCSS ? { fontEmbedCSS } : {}),
        ...options,
    });
}
