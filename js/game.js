import { MazeGenerator } from './maze.js';
import { ImageWallManager } from './imageWalls.js';
import { Renderer } from './renderer.js';
import { Minimap } from './minimap.js';

// ==================== 游戏主类 ====================
export class Game {
    constructor() {
        const canvas = document.getElementById('gameCanvas');
        this.renderer = new Renderer(canvas);
        this.renderer.resize();

        this.minimap = new Minimap(document.getElementById('minimapCanvas'));

        this.state = 'menu'; // menu, playing, won
        this.maze = null;
        this.cellSize = 2; // 每个格子2个单位
        this.wallHeight = 2.5;

        // 图片墙管理器
        this.imageManager = new ImageWallManager();

        // 玩家状态
        this.player = {
            x: 1.5, y: 1.5, z: 1.25, // 位置 (z是高度)
            yaw: 0, pitch: 0,         // 朝向角度（弧度）
            radius: 0.3  // 碰撞半径
        };

        // 输入状态
        this.keys = {};
        this.mouseLocked = false;

        // 出口
        this.exit = null;
        this.currentLevel = 1;

        // 关卡系统参数
        this.currentPage = 0;
        this.levelsPerPage = 9; // 3x3 网格
        this.levelsPerRow = 3;
        this.maxPages = 10; // 最多10页
        this.completedLevels = new Set(); // 已完成的关卡

        this.setupEvents();
        this.renderLevelSelect();
        this.loop();
    }

    // 获取关卡尺寸（根据关卡号和页面递增难度）
    getLevelSize(levelNum) {
        // 基础尺寸
        const baseSize = 15;
        // 每页增加的尺寸
        const pageBonus = Math.floor((levelNum - 1) / this.levelsPerPage) * 4;
        // 关卡内递增
        const levelBonus = ((levelNum - 1) % this.levelsPerPage) * 2;

        const size = baseSize + pageBonus + levelBonus;
        return { w: size, h: size };
    }

    // 获取关卡种子（固定种子确保每次生成相同）
    getLevelSeed(levelNum) {
        // 使用关卡号作为种子基础
        return levelNum * 12345 + 67890;
    }

    // 渲染关卡选择界面
    renderLevelSelect() {
        const grid = document.getElementById('levelGrid');
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');

        // 更新页面信息
        pageInfo.textContent = `第 ${this.currentPage + 1} 页`;
        prevBtn.disabled = this.currentPage === 0;
        nextBtn.disabled = this.currentPage >= this.maxPages - 1;

        // 清空网格
        grid.innerHTML = '';

        // 生成网格按钮
        const startLevel = this.currentPage * this.levelsPerPage + 1;

        for (let i = 0; i < this.levelsPerPage; i++) {
            const levelNum = startLevel + i;
            const size = this.getLevelSize(levelNum);

            const btn = document.createElement('button');
            btn.className = 'level-grid-btn';
            if (this.completedLevels.has(levelNum)) {
                btn.classList.add('completed');
            }
            if (levelNum === this.currentLevel && this.state !== 'menu') {
                btn.classList.add('current');
            }

            btn.innerHTML = `
                ${levelNum}
                <div class="level-size">${size.w}×${size.h}</div>
            `;
            btn.onclick = () => this.startLevel(levelNum);

            grid.appendChild(btn);
        }
    }

    // 上一页
    prevPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.renderLevelSelect();
        }
    }

    // 下一页
    nextPage() {
        if (this.currentPage < this.maxPages - 1) {
            this.currentPage++;
            this.renderLevelSelect();
        }
    }

    setupEvents() {
        window.addEventListener('resize', () => this.renderer.resize());

        // 键盘
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Escape') {
                this.showMenu();
            }
        });
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);

        // 鼠标锁定
        const canvas = this.renderer.canvas;
        canvas.addEventListener('click', () => {
            if (this.state === 'playing' && !this.mouseLocked) {
                canvas.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.mouseLocked = document.pointerLockElement === canvas;
        });

        document.addEventListener('mousemove', (e) => {
            if (this.mouseLocked && this.state === 'playing') {
                this.player.yaw += e.movementX * 0.003;
                this.player.pitch -= e.movementY * 0.003;
                this.player.pitch = Math.max(-Math.PI/2 + 0.1,
                    Math.min(Math.PI/2 - 0.1, this.player.pitch));
            }
        });

        // Wire up onclick handlers (replacing inline onclick in HTML)
        document.getElementById('prevPage').addEventListener('click', () => this.prevPage());
        document.getElementById('nextPage').addEventListener('click', () => this.nextPage());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportMap());
        document.getElementById('returnToMenu').addEventListener('click', () => this.showMenu());
    }

    async startLevel(level) {
        this.currentLevel = level;
        const size = this.getLevelSize(level);
        const seed = this.getLevelSeed(level);

        this.maze = new MazeGenerator(size.w, size.h, seed);
        this.maze.generate();
        this.exit = this.maze.exit;

        // 加载并分配图片到墙壁
        if (!this.imageManager.loaded) {
            const imageFiles = [
                'image/IMG_20250502_130433.jpg',
                'image/IMG_20250504_225115.jpg',
                'image/IMG_20250802_150513.jpg',
                'image/IMG_20250819_151055.jpg',
                'image/IMG_20251117_150044.jpg',
                'image/IMG_20260101_135709.jpg',
                'image/MEITU_20251031_164622176.jpg',
                'image/MTXX_20260102_184019686.jpg',
                'image/wx_camera_1760023606279.jpg'
            ];
            await this.imageManager.loadImages(imageFiles);
        }
        this.imageManager.assignImagesToWalls(this.maze.grid, this.cellSize, this.wallHeight, seed);

        // 重置玩家位置
        this.player.x = 1 * this.cellSize + this.cellSize / 2;
        this.player.y = 1 * this.cellSize + this.cellSize / 2;
        this.player.z = 1.25;
        this.player.yaw = 0;
        this.player.pitch = 0;

        this.state = 'playing';
        document.getElementById('menu').style.display = 'none';
        document.getElementById('hud').style.display = 'block';
        document.getElementById('crosshair').style.display = 'block';
        document.getElementById('winMessage').style.display = 'none';
        document.getElementById('minimapContainer').style.display = 'block';

        this.renderer.canvas.requestPointerLock();
    }

    showMenu() {
        this.state = 'menu';
        document.exitPointerLock();
        document.getElementById('menu').style.display = 'block';
        document.getElementById('hud').style.display = 'none';
        document.getElementById('crosshair').style.display = 'none';
        document.getElementById('winMessage').style.display = 'none';
        document.getElementById('minimapContainer').style.display = 'none';
        this.renderLevelSelect();
    }

    win() {
        this.state = 'won';
        this.completedLevels.add(this.currentLevel);
        document.exitPointerLock();
        document.getElementById('winMessage').style.display = 'block';
        this.renderLevelSelect();
    }

    // 导出地图到文件
    exportMap() {
        if (!this.maze) {
            alert('请先生成一个迷宫！');
            return;
        }

        let mapText = `3D迷宫地图 - 第${this.currentLevel}关\n`;
        mapText += `尺寸: ${this.maze.width} x ${this.maze.height}\n`;
        mapText += `起点: (1, 1)\n`;
        mapText += `出口: (${this.exit.x}, ${this.exit.y})\n`;
        mapText += `图例: #=墙 .=路 S=起点 E=出口\n`;
        mapText += '='.repeat(this.maze.width + 4) + '\n';

        for (let y = 0; y < this.maze.height; y++) {
            let line = '# ';
            for (let x = 0; x < this.maze.width; x++) {
                if (x === 1 && y === 1) {
                    line += 'S';
                } else if (x === this.exit.x && y === this.exit.y) {
                    line += 'E';
                } else if (this.maze.grid[y][x] === 1) {
                    line += '#';
                } else {
                    line += '.';
                }
            }
            line += ' #';
            mapText += line + '\n';
        }

        mapText += '='.repeat(this.maze.width + 4) + '\n';

        // 创建并下载文件
        const blob = new Blob([mapText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `maze_map_level${this.currentLevel}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    update(dt) {
        if (this.state !== 'playing') return;

        const speed = 4 * dt; // 移动速度
        const rotSpeed = 2 * dt; // 旋转速度

        // 键盘旋转（如果没有鼠标锁定）
        if (!this.mouseLocked) {
            if (this.keys['ArrowLeft']) this.player.yaw += rotSpeed;
            if (this.keys['ArrowRight']) this.player.yaw -= rotSpeed;
        }

        // 计算移动方向
        let moveX = 0, moveY = 0;

        const cosYaw = Math.cos(this.player.yaw);
        const sinYaw = Math.sin(this.player.yaw);

        if (this.keys['KeyW']) {
            moveX += Math.sin(this.player.yaw) * speed;
            moveY -= Math.cos(this.player.yaw) * speed;
        }
        if (this.keys['KeyS']) {
            moveX -= Math.sin(this.player.yaw) * speed;
            moveY += Math.cos(this.player.yaw) * speed;
        }
        if (this.keys['KeyA']) {
            moveX += Math.sin(this.player.yaw - Math.PI/2) * speed;
            moveY -= Math.cos(this.player.yaw - Math.PI/2) * speed;
        }
        if (this.keys['KeyD']) {
            moveX += Math.sin(this.player.yaw + Math.PI/2) * speed;
            moveY -= Math.cos(this.player.yaw + Math.PI/2) * speed;
        }

        // 碰撞检测和移动
        if (!this.maze.checkCollision(this.player.x + moveX, this.player.y, this.player.radius, this.cellSize)) {
            this.player.x += moveX;
        }
        if (!this.maze.checkCollision(this.player.x, this.player.y + moveY, this.player.radius, this.cellSize)) {
            this.player.y += moveY;
        }

        // 检查是否到达出口
        const exitWorldX = this.exit.x * this.cellSize + this.cellSize / 2;
        const exitWorldY = this.exit.y * this.cellSize + this.cellSize / 2;
        const dx = this.player.x - exitWorldX;
        const dy = this.player.y - exitWorldY;
        const distToExit = Math.sqrt(dx * dx + dy * dy);
        if (distToExit < 0.8) {
            this.win();
        }

        // 更新HUD
        const gridX = Math.floor(this.player.x / this.cellSize);
        const gridY = Math.floor(this.player.y / this.cellSize);
        document.getElementById('pos').textContent =
            `${gridX}, ${gridY} (${this.player.x.toFixed(1)}, ${this.player.y.toFixed(1)})`;
    }

    render(time) {
        this.renderer.clearCanvas();
        if (this.state !== 'playing' || !this.maze) return;
        this.renderer.updateFrameCache(this.player);
        this.renderer.drawGroundGrid(this.player);
        this.renderer.collectAndDrawWalls(this.player, this.maze, this.cellSize, this.wallHeight, this.imageManager);
        this.renderer.drawExitMarker(this.exit, this.cellSize, this.wallHeight, time);
        this.minimap.render(this.player, this.maze, this.exit, this.cellSize, this.imageManager);
    }

    loop() {
        const now = performance.now();
        if (!this.lastTime) this.lastTime = now;
        const dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;

        this.update(dt);
        this.render(now);

        requestAnimationFrame(() => this.loop());
    }
}
