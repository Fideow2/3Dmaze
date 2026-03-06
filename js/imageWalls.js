import { SeededRandom } from './math.js';

// ==================== 图片墙管理器 ====================
export class ImageWallManager {
    constructor() {
        this.images = []; // 加载的图片数组
        this.imageWalls = []; // 分配到墙壁的图片 {x, y, face, image, imageIndex}
        this.loaded = false;
    }

    // 加载指定路径的图片
    async loadImages(imagePaths) {
        console.log('Starting to load images...', imagePaths);
        const loadPromises = imagePaths.map(path => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    console.log(`Loaded image: ${path}, size: ${img.width}x${img.height}`);
                    resolve({ img, path });
                };
                img.onerror = () => {
                    console.error(`Failed to load image: ${path}`);
                    resolve(null); // 加载失败也继续
                };
                img.src = path;
            });
        });

        const results = await Promise.all(loadPromises);
        this.images = results.filter(r => r !== null).map(r => r.img);
        this.loaded = this.images.length > 0;
        console.log(`Total loaded: ${this.images.length}/${imagePaths.length} images`);
        return this.loaded;
    }

    // 随机分配图片到墙壁
    assignImagesToWalls(mazeGrid, cellSize, wallHeight, seed) {
        this.imageWalls = [];
        if (!this.loaded || this.images.length === 0) return;

        const height = mazeGrid.length;
        const width = mazeGrid[0].length;
        const wallCells = [];

        // 收集所有墙壁格子
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (mazeGrid[y][x] === 1) {
                    // 检查四个面，记录哪些面是可见的（相邻是路）
                    const faces = [];
                    if (y > 0 && mazeGrid[y-1][x] === 0) faces.push('front');     // 北面是路
                    if (y < height-1 && mazeGrid[y+1][x] === 0) faces.push('back'); // 南面是路
                    if (x > 0 && mazeGrid[y][x-1] === 0) faces.push('left');      // 西面是路
                    if (x < width-1 && mazeGrid[y][x+1] === 0) faces.push('right'); // 东面是路

                    if (faces.length > 0) {
                        wallCells.push({x, y, faces});
                    }
                }
            }
        }

        // 随机打乱墙壁顺序（使用固定种子）
        const rng = new SeededRandom(seed || 12345);
        for (let i = wallCells.length - 1; i > 0; i--) {
            const j = Math.floor(rng.next() * (i + 1));
            [wallCells[i], wallCells[j]] = [wallCells[j], wallCells[i]];
        }

        // 分配图片到墙壁（每张图片分配到一个随机墙壁的随机面）
        const rng2 = new SeededRandom((seed || 12345) * 7 + 13);
        for (let i = 0; i < this.images.length; i++) {
            if (i >= wallCells.length) break;

            const cell = wallCells[i];
            const face = cell.faces[Math.floor(rng2.next() * cell.faces.length)];

            this.imageWalls.push({
                x: cell.x,
                y: cell.y,
                face: face,
                image: this.images[i],
                imageIndex: i
            });
        }

        console.log(`Assigned ${this.imageWalls.length} images to walls`);
    }

    // 获取某面墙的图片信息
    getImageAt(x, y, face) {
        return this.imageWalls.find(w => w.x === x && w.y === y && w.face === face);
    }

    // 检查某格子是否有图片墙
    hasImageAt(x, y) {
        return this.imageWalls.some(w => w.x === x && w.y === y);
    }

    // 获取格子的所有图片面
    getImageFacesAt(x, y) {
        return this.imageWalls.filter(w => w.x === x && w.y === y).map(w => w.face);
    }
}
