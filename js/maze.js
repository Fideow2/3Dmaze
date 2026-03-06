import { SeededRandom } from './math.js';

// ==================== 迷宫生成器 ====================
export class MazeGenerator {
    constructor(width, height, seed) {
        this.width = width;
        this.height = height;
        this.seed = seed;
        this.rng = new SeededRandom(seed);
        // 确保尺寸为奇数
        if (this.width % 2 === 0) this.width++;
        if (this.height % 2 === 0) this.height++;
        this.grid = [];
    }

    generate() {
        // 初始化：1 = 墙, 0 = 路
        for (let y = 0; y < this.height; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.width; x++) {
                this.grid[y][x] = 1;
            }
        }

        // 递归回溯算法
        const stack = [];
        const startX = 1;
        const startY = 1;
        this.grid[startY][startX] = 0;
        stack.push({x: startX, y: startY});

        const directions = [
            {dx: 0, dy: -2}, {dx: 2, dy: 0},
            {dx: 0, dy: 2}, {dx: -2, dy: 0}
        ];

        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const neighbors = [];

            for (const dir of directions) {
                const nx = current.x + dir.dx;
                const ny = current.y + dir.dy;
                if (nx > 0 && nx < this.width - 1 &&
                    ny > 0 && ny < this.height - 1 &&
                    this.grid[ny][nx] === 1) {
                    neighbors.push({x: nx, y: ny, dx: dir.dx, dy: dir.dy});
                }
            }

            if (neighbors.length > 0) {
                const next = neighbors[Math.floor(this.rng.next() * neighbors.length)];
                // 打通墙壁
                this.grid[current.y + next.dy/2][current.x + next.dx/2] = 0;
                this.grid[next.y][next.x] = 0;
                stack.push({x: next.x, y: next.y});
            } else {
                stack.pop();
            }
        }

        // 确保出口可达（右下角附近）
        this.exit = this.findFarthestExit();

        return this.grid;
    }

    findFarthestExit() {
        // BFS找最远的点作为出口
        const queue = [{x: 1, y: 1, dist: 0}];
        const visited = new Set(['1,1']);
        let farthest = {x: 1, y: 1, dist: 0};

        while (queue.length > 0) {
            const curr = queue.shift();
            if (curr.dist > farthest.dist) {
                farthest = curr;
            }

            const dirs = [{dx: 0, dy: -1}, {dx: 1, dy: 0}, {dx: 0, dy: 1}, {dx: -1, dy: 0}];
            for (const d of dirs) {
                const nx = curr.x + d.dx;
                const ny = curr.y + d.dy;
                const key = `${nx},${ny}`;
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height &&
                    this.grid[ny][nx] === 0 && !visited.has(key)) {
                    visited.add(key);
                    queue.push({x: nx, y: ny, dist: curr.dist + 1});
                }
            }
        }
        return {x: farthest.x, y: farthest.y};
    }

    isWall(worldX, worldY, cellSize) {
        // 将世界坐标转换为网格坐标
        const ix = Math.floor(worldX / cellSize);
        const iy = Math.floor(worldY / cellSize);
        if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return true;
        return this.grid[iy][ix] === 1;
    }

    checkCollision(x, y, radius, cellSize) {
        // 检查8个点（更密集的碰撞检测）
        // 增加一个安全边距，防止贴墙太近导致透视问题
        const margin = 0.05;
        const safeRadius = radius + margin;
        const points = [
            {x: x - safeRadius, y: y - safeRadius},
            {x: x + safeRadius, y: y - safeRadius},
            {x: x - safeRadius, y: y + safeRadius},
            {x: x + safeRadius, y: y + safeRadius},
            {x: x, y: y - safeRadius},  // 上
            {x: x, y: y + safeRadius},  // 下
            {x: x - safeRadius, y: y},  // 左
            {x: x + safeRadius, y: y}   // 右
        ];
        for (const p of points) {
            if (this.isWall(p.x, p.y, cellSize)) return true;
        }
        return false;
    }
}
