/**
 * audio.js — Âm thanh không gian WebAudio (§12 trong config MUSIC.file trống).
 * Tạo nhạc nền nhẹ bằng oscillator, chỉ chạy khi user bật.
 */
import { MUSIC } from "./config.js";

let ctx = null;
let nodes = null;
let playing = false;

function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    // hợp âm nhẹ: 2 osc + LFO
    const freqs = [261.63, 329.63, 392.0, 523.25];
    const oscs = freqs.map((f, i) => {
        const o = ctx.createOscillator();
        o.type = i % 2 ? "sine" : "triangle";
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = 0.06 / (i + 1);
        o.connect(g);
        g.connect(master);
        o.start();
        return o;
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.02;
    lfo.connect(lfoG);
    lfoG.connect(master.gain);
    lfo.start();
    nodes = { master, oscs, lfo };
}

export async function toggleAmbient() {
    try {
        if (MUSIC.file) {
            const el =
                document.getElementById("bg-music") ||
                (() => {
                    const a = document.createElement("audio");
                    a.id = "bg-music";
                    a.loop = true;
                    a.preload = "auto";
                    a.src = MUSIC.file;
                    a.volume = 0;
                    document.body.appendChild(a);
                    return a;
                })();

            if (el.paused) {
                await el.play();
                fade(el, MUSIC.volume, 1200);
                playing = true;
            } else {
                fade(el, 0, 700, () => el.pause());
                playing = false;
            }
            return playing;
        }
        if (!ctx) build();
        await ctx.resume();
        playing = !playing;
        const t = ctx.currentTime;
        nodes.master.gain.cancelScheduledValues(t);
        nodes.master.gain.linearRampToValueAtTime(
            playing ? MUSIC.volume * 0.35 : 0,
            t + 1.2,
        );
        return playing;
    } catch {
        return false;
    }
}

/** Chuyển âm lượng từ từ (mượt, không "cụp" giữa lúc bật/tắt). */
function fade(el, to, ms, done) {
    const from = el.volume;
    const t0 = performance.now();
    const step = () => {
        const k = Math.min(1, (performance.now() - t0) / ms);
        el.volume = from + (to - from) * k;
        if (k < 1) requestAnimationFrame(step);
        else done?.();
    };
    step();
}
