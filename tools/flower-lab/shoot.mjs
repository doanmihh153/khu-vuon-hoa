/**
 * Chụp ảnh Flower Lab bằng Chrome headless (CDP) — kiểm thử trực quan
 * hình học hoa (đầu hoa / lá có bám đúng thân cong hay không).
 *
 *   node tools/flower-lab/shoot.mjs [outDir] [loài...]
 *
 * Không phụ thuộc puppeteer: dùng WebSocket global của Node + CDP thô.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const outDir = resolve(process.argv[2] || resolve(here, "shots"));
const page = resolve(here, "flower-lab.html");

const CHROME =
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const ALL = [
    "rose",
    "carnation",
    "peony",
    "tulip",
    "daisy",
    "chrysanthemum",
    "orchid",
    "lily",
    "sunflower",
    "babysbreath",
    "lavender",
];
const SPECIES = process.argv.length > 3 ? process.argv.slice(3) : ALL;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
    constructor(ws) {
        this.ws = ws;
        this.id = 0;
        this.pending = new Map();
        ws.addEventListener("message", (ev) => {
            const msg = JSON.parse(ev.data);
            if (msg.id && this.pending.has(msg.id)) {
                const { resolve: res, reject: rej } = this.pending.get(msg.id);
                this.pending.delete(msg.id);
                if (msg.error) rej(new Error(JSON.stringify(msg.error)));
                else res(msg.result);
            }
        });
    }

    send(method, params = {}) {
        const id = ++this.id;
        return new Promise((res, rej) => {
            this.pending.set(id, { resolve: res, reject: rej });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    async eval(expression) {
        const r = await this.send("Runtime.evaluate", {
            expression,
            awaitPromise: true,
            returnByValue: true,
        });
        if (r.exceptionDetails)
            throw new Error(r.exceptionDetails.text + " " + expression);
        return r.result?.value;
    }
}

/* ─────────────────────  Chạy  ───────────────────── */

async function main() {
    mkdirSync(outDir, { recursive: true });
    const userDir = resolve(outDir, ".chrome-profile");
    rmSync(userDir, { recursive: true, force: true });

    const chrome = spawn(
        CHROME,
        [
            "--headless=new",
            "--remote-debugging-port=9333",
            "--user-data-dir=" + userDir,
            "--hide-scrollbars",
            "--no-first-run",
            "--no-default-browser-check",
            "--window-size=900,1100",
            "--allow-file-access-from-files",
            // SwiftShader: WebGL hoạt động trong headless không GPU
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
        ],
        { stdio: ["ignore", "ignore", "pipe"] },
    );
    let chromeErr = "";
    chrome.stderr.on("data", (d) => (chromeErr += d.toString()));

    const ok = await (async () => {
        try {
            return !!(await (
                await fetch("http://127.0.0.1:9333/json/version")
            ).json()).webSocketDebuggerUrl;
        } catch {
            return false;
        }
    })();

    // Kết nối thẳng vào WebSocket của page target (không cần session).
    let pageWs = null;
    for (let i = 0; i < 40; i++) {
        const list = await (
            await fetch("http://127.0.0.1:9333/json/list")
        ).json();
        pageWs = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
        if (pageWs) break;
        await sleep(250);
    }
    if (!pageWs) {
        chrome.kill();
        throw new Error("Không tìm thấy page target:\n" + chromeErr);
    }

    const ws = new WebSocket(pageWs.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
        ws.addEventListener("open", res, { once: true });
        ws.addEventListener("error", rej, { once: true });
    });
    const cdp = new CDP(ws);

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: 900,
        height: 1100,
        deviceScaleFactor: 1,
        mobile: false,
    });

    const shots = [];

    for (const id of SPECIES) {
        const url = `file://${page}?s=${id}&n=1&lod=high&open=1&spin=0`;
        await cdp.send("Page.navigate", { url });

        // Chờ lab sẵn sàng thay vì sleep cứng (tránh chụp lúc còn đang dựng)
        let ready = false;
        for (let k = 0; k < 40; k++) {
            await sleep(250);
            try {
                ready = await cdp.eval("!!window.__labReady");
            } catch {
                ready = false;
            }
            if (ready) break;
        }
        if (!ready) {
            console.log(`  ✗ ${id}: lab không khởi động`);
            continue;
        }

        const views = await (async () => {
            const info =
                (await cdp.eval("window.__labInfo")) ||
                { headY: 0.95, radius: 0.45 };
            const h = info.headY ?? 0.95;
            const r = Math.max(0.22, info.radius ?? 0.45);
            const d = r * 3.8 + 0.22;
            return [
                { name: "front", pos: [0, h, d], tgt: [0, h, 0] },
                {
                    name: "top",
                    pos: [r * 1.15, h + r * 1.5, r * 1.35],
                    tgt: [0, h, 0],
                },
                {
                    name: "side",
                    pos: [d, h - r * 0.15, r * 0.35],
                    tgt: [0, h, 0],
                },
                {
                    name: "bottom",
                    pos: [r * 1.0, h - r * 1.55, r * 1.25],
                    tgt: [0, h, 0],
                },
            ];
        })();

        for (const v of views) {
            await cdp.eval(
                `window.__lab.look(${v.pos[0]},${v.pos[1]},${v.pos[2]},` +
                    `${v.tgt[0]},${v.tgt[1]},${v.tgt[2]})`,
            );
            await sleep(400);
            const { data } = await cdp.send("Page.captureScreenshot", {
                format: "png",
            });
            const file = resolve(outDir, `${id}-${v.name}.png`);
            writeFileSync(file, Buffer.from(data, "base64"));
            shots.push(file);
        }
        console.log(`  ✔ ${id}`);
    }

    ws.close();
    chrome.kill();
    rmSync(userDir, { recursive: true, force: true });
    console.log(`\n${shots.length} ảnh → ${outDir}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});