// ==================== 小地图 ====================
export class Minimap {
    constructor(minimapCanvas) {
        this.minimapCanvas = minimapCanvas;
        this.minimapCtx = minimapCanvas.getContext('2d');
    }

    render(player, maze, exit, cellSize, imageManager) {
        if (!maze) return;

        const ctx = this.minimapCtx;
        const size = this.minimapCanvas.width;
        const cellW = size / maze.width;
        const cellH = size / maze.height;

        // 清空画布
        ctx.clearRect(0, 0, size, size);

        // 玩家精确位置
        const px = (player.x / cellSize) * cellW;
        const py = (player.y / cellSize) * cellH;

        // 视野半径（更大一点）
        const viewRadius = cellW * 3.5;  // 3.5格半径内可见
        const fadeStart = cellW * 2.5;   // 2.5格内完全不透明

        // 先绘制终点（始终完全显示）
        const exitPx = exit.x * cellW;
        const exitPy = exit.y * cellH;
        ctx.fillStyle = 'rgb(241, 144, 140)';
        ctx.fillRect(exitPx, exitPy, cellW + 1, cellH + 1);

        // 存储需要绘制粉色标记的位置
        const pinkMarks = [];

        // 遍历所有格子，根据距离计算透明度（终点除外）
        for (let y = 0; y < maze.height; y++) {
            for (let x = 0; x < maze.width; x++) {
                // 终点已单独绘制，跳过
                if (x === exit.x && y === exit.y) continue;

                const cellPx = x * cellW;
                const cellPy = y * cellH;
                const cellCx = cellPx + cellW/2;
                const cellCy = cellPy + cellH/2;

                // 计算到玩家的距离
                const dx = cellCx - px;
                const dy = cellCy - py;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // 计算透明度
                let alpha = 0;
                if (dist < fadeStart) {
                    alpha = 1;  // 2.5格内完全不透明
                } else if (dist < viewRadius) {
                    alpha = 1 - (dist - fadeStart) / (viewRadius - fadeStart);
                }

                if (alpha <= 0) continue;

                ctx.globalAlpha = alpha;

                // 墙壁
                if (maze.grid[y][x] === 1) {
                    ctx.fillStyle = '#8b4513';
                    ctx.fillRect(cellPx, cellPy, cellW + 1, cellH + 1);

                    // 检查这个墙壁是否有图片，记录需要标记的面
                    if (imageManager && imageManager.hasImageAt(x, y)) {
                        const faces = imageManager.getImageFacesAt(x, y);
                        pinkMarks.push({x, y, faces, cellPx, cellPy, alpha});
                    }
                }
            }
        }

        ctx.globalAlpha = 1;

        // 绘制粉色标记（图片墙指示）
        ctx.strokeStyle = 'rgb(241, 144, 140)';
        ctx.lineWidth = 2;
        for (const mark of pinkMarks) {
            ctx.globalAlpha = mark.alpha;
            for (const face of mark.faces) {
                ctx.beginPath();
                if (face === 'front') {
                    ctx.moveTo(mark.cellPx, mark.cellPy);
                    ctx.lineTo(mark.cellPx + cellW, mark.cellPy);
                } else if (face === 'back') {
                    ctx.moveTo(mark.cellPx, mark.cellPy + cellH);
                    ctx.lineTo(mark.cellPx + cellW, mark.cellPy + cellH);
                } else if (face === 'left') {
                    ctx.moveTo(mark.cellPx, mark.cellPy);
                    ctx.lineTo(mark.cellPx, mark.cellPy + cellH);
                } else if (face === 'right') {
                    ctx.moveTo(mark.cellPx + cellW, mark.cellPy);
                    ctx.lineTo(mark.cellPx + cellW, mark.cellPy + cellH);
                }
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;

        // 绘制玩家圆点（始终完全不透明）
        ctx.fillStyle = 'rgb(241, 144, 140)';
        ctx.beginPath();
        ctx.arc(px, py, Math.max(cellW, cellH) * 0.7, 0, Math.PI * 2);
        ctx.fill();
    }
}
