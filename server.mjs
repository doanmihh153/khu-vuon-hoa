/**
 * May chu tinh don gian cho du an ES Modules.
 * Khong can cai dat them: node server.mjs
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)));
const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || "127.0.0.1";

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".map": "application/json; charset=utf-8",
};

const server = createServer(async (req, res) => {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        let pathname = decodeURIComponent(url.pathname);
        if (pathname.endsWith("/")) pathname += "index.html";

        const filePath = join(
            ROOT,
            normalize(pathname).replace(/^(\.\.[/\\])+/, ""),
        );
        if (!filePath.startsWith(ROOT)) {
            res.writeHead(403).end("Forbidden");
            return;
        }

        const info = await stat(filePath).catch(() => null);
        if (!info || !info.isFile()) {
            res.writeHead(404, {
                "Content-Type": "text/plain; charset=utf-8",
            }).end("404 — Khong tim thay");
            return;
        }

        const body = await readFile(filePath);
        res.writeHead(200, {
            "Content-Type":
                MIME[extname(filePath).toLowerCase()] ||
                "application/octet-stream",
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*",
        });
        res.end(body);
    } catch (err) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end(
            "500 — " + err.message,
        );
    }
});

server.listen(PORT, HOST, () => {
    console.log(`\n  🌸  Vuon Hoa Yeu Thuong`);
    console.log(`  →  http://${HOST}:${PORT}\n`);
});
