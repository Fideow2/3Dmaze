// ==================== 3D 数学库 ====================
export class Vec3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x; this.y = y; this.z = z;
    }
    add(v) { return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z); }
    sub(v) { return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z); }
    mul(s) { return new Vec3(this.x * s, this.y * s, this.z * s); }
    dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
    cross(v) {
        return new Vec3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );
    }
    length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
    normalize() {
        const len = this.length();
        return len > 0 ? new Vec3(this.x / len, this.y / len, this.z / len) : new Vec3(0, 0, 0);
    }
}

// ==================== 数学工具函数 ====================
export const MathUtils = {
    // 距离平方（避免 sqrt）
    distSq2D(x1, y1, x2, y2) {
        const dx = x1 - x2, dy = y1 - y2;
        return dx * dx + dy * dy;
    },

    // 点积 2D
    dot2D(ax, ay, bx, by) {
        return ax * bx + ay * by;
    }
};

// ==================== 带种子的随机数生成器 ====================
export class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }

    // 线性同余生成器 (LCG)
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    // 生成指定范围的随机数
    range(min, max) {
        return min + this.next() * (max - min);
    }

    // 生成整数随机数
    rangeInt(min, max) {
        return Math.floor(this.range(min, max));
    }
}
