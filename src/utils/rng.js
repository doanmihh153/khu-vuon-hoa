/** Bộ sinh số ngẫu nhiên có hạt giống — để khu vườn luôn giống nhau giữa các lần tải. */

export function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function makeRng(seed = 20251020) {
    const rand = mulberry32(seed);
    return {
        next: rand,
        range: (min, max) => min + rand() * (max - min),
        int: (min, max) => Math.floor(min + rand() * (max - min + 1)),
        pick: (arr) => arr[Math.floor(rand() * arr.length)],
        sign: () => (rand() < 0.5 ? -1 : 1),
        /** Phân phối xấp xỉ chuẩn (Box–Muller) — hữu ích cho độ cao/độ lệch tự nhiên. */
        gauss: (mean = 0, sd = 1) => {
            const u = Math.max(1e-6, rand());
            const v = rand();
            return (
                mean +
                sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
            );
        },
        bool: (p = 0.5) => rand() < p,
    };
}

/** Băm nhẹ theo lưới để cây trồng phân bố tự nhiên hơn (không dồn cục). */
export function jitteredGrid(rng, cols, rows, cellSize, jitter = 0.8) {
    const points = [];
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            points.push({
                x: (i + 0.5 + rng.range(-jitter, jitter)) * cellSize,
                z: (j + 0.5 + rng.range(-jitter, jitter)) * cellSize,
            });
        }
    }
    return points;
}
