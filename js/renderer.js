import { MathUtils } from './math.js';

// ==================== 3D 渲染器 ====================
export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.fov = Math.PI / 3; // 60度视野
        this.near = 0.1;  // 近裁剪面
        this.far = 100;
        this.projectionScale = (canvas.height / 2) / Math.tan(this.fov / 2);
        this.frameCache = null;
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.aspect = this.canvas.width / this.canvas.height;
        this.projectionScale = (this.canvas.height / 2) / Math.tan(this.fov / 2);
    }

    updateFrameCache(player) {
        this.frameCache = {
            cosYaw: Math.cos(player.yaw),
            sinYaw: Math.sin(player.yaw),
            cosPitch: Math.cos(player.pitch),
            sinPitch: Math.sin(player.pitch),
            scale: this.projectionScale,
            halfW: this.canvas.width / 2,
            halfH: this.canvas.height / 2,
            px: player.x,
            py: player.y,
            pz: player.z
        };
    }

    clearCanvas() {
        // 清空画布（浅米色背景）
        this.ctx.fillStyle = '#f5f5dc';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制 subtle 纹理效果
        this.ctx.fillStyle = 'rgba(139, 69, 19, 0.03)';
        for (let i = 0; i < this.canvas.height; i += 4) {
            this.ctx.fillRect(0, i, this.canvas.width, 1);
        }
    }

    // 将3D点投影到屏幕（使用预计算的三角函数缓存）
    project(x, y, z) {
        const cache = this.frameCache;

        // 1. 计算点相对于相机的偏移
        const dx = x - cache.px;
        const dy = y - cache.py;
        const dz = z - cache.pz;

        // 2. 应用yaw旋转（水平旋转，绕垂直轴）- 使用缓存的sin/cos
        const camX = dx * cache.cosYaw + dy * cache.sinYaw;
        const camZ = dx * cache.sinYaw - dy * cache.cosYaw;

        // 3. 处理高度和pitch（垂直旋转，绕X轴）- 使用缓存的sin/cos
        const y_before = -dz;
        const camY = y_before * cache.cosPitch + camZ * cache.sinPitch;
        const finalZ = -y_before * cache.sinPitch + camZ * cache.cosPitch;

        // 4. 透视投影 - 使用缓存的scale和canvas尺寸
        return {
            x: (camX / finalZ) * cache.scale + cache.halfW,
            y: (camY / finalZ) * cache.scale + cache.halfH,
            depth: finalZ,
            camX: camX,
            camY: camY,
            camZ: finalZ,
            visible: finalZ > this.near
        };
    }

    // 裁剪线段到近裁剪面
    clipLineToNear(p1, p2) {
        const near = this.near;

        // 如果两个点都在前面，直接返回
        if (p1.camZ >= near && p2.camZ >= near) {
            return [p1, p2];
        }

        // 如果两个点都在后面，丢弃
        if (p1.camZ < near && p2.camZ < near) {
            return null;
        }

        // 需要裁剪 - 一个在前一个在后
        const t = (near - p1.camZ) / (p2.camZ - p1.camZ);
        const scale = this.projectionScale;

        // 计算裁剪点
        const clipCamX = p1.camX + t * (p2.camX - p1.camX);
        const clipCamY = p1.camY + t * (p2.camY - p1.camY);
        const clipCamZ = near;

        const clipPx = (clipCamX / near) * scale + this.canvas.width / 2;
        const clipPy = (clipCamY / near) * scale + this.canvas.height / 2;

        const clipPoint = {
            x: clipPx,
            y: clipPy,
            depth: near,
            camX: clipCamX,
            camY: clipCamY,
            camZ: near,
            visible: true
        };

        if (p1.camZ >= near) {
            return [p1, clipPoint];
        } else {
            return [clipPoint, p2];
        }
    }

    // 绘制3D线段（深棕色实心线）
    drawLine3D(x1, y1, z1, x2, y2, z2, color = '#8b4513', lineWidth = 1.5) {
        const p1 = this.project(x1, y1, z1);
        const p2 = this.project(x2, y2, z2);

        // 如果两个点都没有投影，不绘制
        if (!p1 || !p2) return;

        // 裁剪到近裁剪面
        const clipped = this.clipLineToNear(p1, p2);
        if (!clipped) return;

        const [cp1, cp2] = clipped;

        // 检查坐标有效性
        if (!isFinite(cp1.x) || !isFinite(cp1.y) || !isFinite(cp2.x) || !isFinite(cp2.y)) {
            return;
        }

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(cp1.x, cp1.y);
        this.ctx.lineTo(cp2.x, cp2.y);
        this.ctx.stroke();
    }

    // 判断面是否朝向相机（背面剔除）
    isFaceVisible(normal, faceCenter) {
        // 计算从面中心到相机的向量
        const toCameraX = this.frameCache.px - faceCenter.x;
        const toCameraY = this.frameCache.py - faceCenter.y;
        const toCameraZ = this.frameCache.pz - faceCenter.z;

        // 如果法向量与看向相机的向量的点积 > 0，则面朝相机
        const dot = normal.x * toCameraX + normal.y * toCameraY + normal.z * toCameraZ;
        return dot > 0;
    }

    // 绘制填充的面（实心墙）- 4个点都必须有坐标（不管visible标记）
    drawFilledFace(p1, p2, p3, p4) {
        // 只要有坐标就绘制（visible标记只表示是否在裁剪面内，不影响绘制）
        if (!p1 || !p2 || !p3 || !p4) return;
        if (!isFinite(p1.x) || !isFinite(p1.y)) return;
        if (!isFinite(p2.x) || !isFinite(p2.y)) return;
        if (!isFinite(p3.x) || !isFinite(p3.y)) return;
        if (!isFinite(p4.x) || !isFinite(p4.y)) return;

        this.ctx.fillStyle = '#f5f5dc';
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.lineTo(p3.x, p3.y);
        this.ctx.lineTo(p4.x, p4.y);
        this.ctx.closePath();
        this.ctx.fill();
    }

    // 绘制一个实心立方体（墙）- 只绘制朝向相机的面
    drawWall(x, y, size, height, gridX, gridY, imageManager) {
        const x1 = x, y1 = y;
        const x2 = x + size, y2 = y + size;
        const h = height;

        // 墙中心
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const cz = h / 2;

        // 定义5个面（带法向量）
        const faces = [
            {   // 前面 (y = y1)，法向量指向 -Y
                normal: {x: 0, y: -1, z: 0},
                center: {x: cx, y: y1, z: cz},
                corners: [{x:x1,y:y1,z:0}, {x:x2,y:y1,z:0}, {x:x2,y:y1,z:h}, {x:x1,y:y1,z:h}],
                faceName: 'front'
            },
            {   // 后面 (y = y2)，法向量指向 +Y
                normal: {x: 0, y: 1, z: 0},
                center: {x: cx, y: y2, z: cz},
                corners: [{x:x2,y:y2,z:0}, {x:x1,y:y2,z:0}, {x:x1,y:y2,z:h}, {x:x2,y:y2,z:h}],
                faceName: 'back'
            },
            {   // 左面 (x = x1)，法向量指向 -X
                normal: {x: -1, y: 0, z: 0},
                center: {x: x1, y: cy, z: cz},
                corners: [{x:x1,y:y2,z:0}, {x:x1,y:y1,z:0}, {x:x1,y:y1,z:h}, {x:x1,y:y2,z:h}],
                faceName: 'left'
            },
            {   // 右面 (x = x2)，法向量指向 +X
                normal: {x: 1, y: 0, z: 0},
                center: {x: x2, y: cy, z: cz},
                corners: [{x:x2,y:y1,z:0}, {x:x2,y:y2,z:0}, {x:x2,y:y2,z:h}, {x:x2,y:y1,z:h}],
                faceName: 'right'
            },
            {   // 顶面 (z = h)，法向量指向 +Z
                normal: {x: 0, y: 0, z: 1},
                center: {x: cx, y: cy, z: h},
                corners: [{x:x1,y:y1,z:h}, {x:x2,y:y1,z:h}, {x:x2,y:y2,z:h}, {x:x1,y:y2,z:h}],
                faceName: 'top'
            }
        ];

        // 筛选朝向相机且至少部分在近裁剪面前的面
        const visibleFaces = [];
        for (const face of faces) {
            const toCamX = this.frameCache.px - face.center.x;
            const toCamY = this.frameCache.py - face.center.y;
            const toCamZ = this.frameCache.pz - face.center.z;

            // 点积 > 0 表示面朝相机
            const dot = face.normal.x * toCamX +
                       face.normal.y * toCamY +
                       face.normal.z * toCamZ;

            if (dot > 0) {
                const dist = Math.sqrt(toCamX*toCamX + toCamY*toCamY + toCamZ*toCamZ);
                visibleFaces.push({face, dist});
            }
        }

        // 按距离排序（远的先画）
        visibleFaces.sort((a, b) => b.dist - a.dist);

        // 绘制可见面
        for (const {face} of visibleFaces) {
            // 投影四个角并裁剪
            const rawPoints = face.corners.map(c =>
                this.project(c.x, c.y, c.z)
            );

            // 检查是否有任何点可见（在相机前面）
            const anyVisible = rawPoints.some(p => p && p.visible);
            if (!anyVisible) continue;

            // 对多边形进行近裁剪面裁剪
            const clippedPolygon = this.clipPolygonToNear(rawPoints);
            if (clippedPolygon.length < 3) continue;

            // 填充裁剪后的多边形
            this.ctx.fillStyle = '#f5f5dc';
            this.ctx.beginPath();
            this.ctx.moveTo(clippedPolygon[0].x, clippedPolygon[0].y);
            for (let i = 1; i < clippedPolygon.length; i++) {
                this.ctx.lineTo(clippedPolygon[i].x, clippedPolygon[i].y);
            }
            this.ctx.closePath();
            this.ctx.fill();

            // 绘制图片（如果这面墙有这个面的图片）
            if (gridX !== undefined && gridY !== undefined && face.faceName !== 'top') {
                const imgInfo = imageManager.getImageAt(gridX, gridY, face.faceName);
                if (imgInfo) {
                    this.drawImageOnFace(face, imgInfo.image, x1, y1, x2, y2, h);
                }
            }

            // 绘制边框（原始边，带裁剪）
            for (let i = 0; i < 4; i++) {
                const c1 = face.corners[i];
                const c2 = face.corners[(i + 1) % 4];
                this.drawLine3D(c1.x, c1.y, c1.z, c2.x, c2.y, c2.z);
            }
        }
    }

    // 在墙面上绘制图片（保持宽高比）
    drawImageOnFace(face, image, x1, y1, x2, y2, h) {
        const imgWidth = image.width;
        const imgHeight = image.height;
        const aspectRatio = imgWidth / imgHeight;

        // 计算墙面尺寸
        let wallWidth, wallHeight;
        if (face.faceName === 'front' || face.faceName === 'back') {
            wallWidth = x2 - x1;
            wallHeight = h;
        } else { // left or right
            wallWidth = y2 - y1;
            wallHeight = h;
        }

        // 计算图片在墙上的显示尺寸（保持宽高比，fit模式）
        let drawWidth, drawHeight;
        const wallAspect = wallWidth / wallHeight;

        if (aspectRatio > wallAspect) {
            // 图片更宽，以宽度为准
            drawWidth = wallWidth * 0.9; // 留一点边距
            drawHeight = drawWidth / aspectRatio;
        } else {
            // 图片更高，以高度为准
            drawHeight = wallHeight * 0.9;
            drawWidth = drawHeight * aspectRatio;
        }

        // 限制最大高度不超过墙高
        if (drawHeight > wallHeight * 0.95) {
            drawHeight = wallHeight * 0.95;
            drawWidth = drawHeight * aspectRatio;
        }

        // 计算图片在墙上的位置（居中）
        let imgX, imgY, imgZ1, imgZ2;
        const paddingX = (wallWidth - drawWidth) / 2;
        const paddingY = (wallHeight - drawHeight) / 2;

        if (face.faceName === 'front') {
            imgX = x1 + paddingX;
            imgY = y1;
            imgZ1 = paddingY;
            imgZ2 = paddingY + drawHeight;
        } else if (face.faceName === 'back') {
            imgX = x2 - paddingX - drawWidth;
            imgY = y2;
            imgZ1 = paddingY;
            imgZ2 = paddingY + drawHeight;
        } else if (face.faceName === 'left') {
            imgX = x1;
            imgY = y2 - paddingX - drawWidth;
            imgZ1 = paddingY;
            imgZ2 = paddingY + drawHeight;
        } else { // right
            imgX = x2;
            imgY = y1 + paddingX;
            imgZ1 = paddingY;
            imgZ2 = paddingY + drawHeight;
        }

        // 投影图片的四个角
        let p1, p2, p3, p4;
        if (face.faceName === 'front' || face.faceName === 'back') {
            p1 = this.project(imgX, imgY, imgZ1);
            p2 = this.project(imgX + drawWidth, imgY, imgZ1);
            p3 = this.project(imgX + drawWidth, imgY, imgZ2);
            p4 = this.project(imgX, imgY, imgZ2);
        } else { // left or right
            p1 = this.project(imgX, imgY, imgZ1);
            p2 = this.project(imgX, imgY + drawWidth, imgZ1);
            p3 = this.project(imgX, imgY + drawWidth, imgZ2);
            p4 = this.project(imgX, imgY, imgZ2);
        }

        // 检查所有点是否有效
        if (!p1 || !p2 || !p3 || !p4) return;

        // 检查是否有任何点可见（在相机前面）
        const anyVisible = [p1, p2, p3, p4].some(p => p && p.visible);
        if (!anyVisible) return;

        // 使用与墙壁相同的裁剪方法
        const rawPoints = [p1, p2, p3, p4];
        const clippedPolygon = this.clipPolygonToNear(rawPoints);
        if (clippedPolygon.length < 3) return;

        // 绘制图片
        this.drawTexturedQuad(image, p1, p2, p3, p4, clippedPolygon);
    }

    // 绘制纹理四边形（使用裁剪后的多边形）
    drawTexturedQuad(image, p1, p2, p3, p4, clippedPolygon) {
        this.ctx.save();

        // 使用裁剪后的多边形作为裁剪路径
        this.ctx.beginPath();
        this.ctx.moveTo(clippedPolygon[0].x, clippedPolygon[0].y);
        for (let i = 1; i < clippedPolygon.length; i++) {
            this.ctx.lineTo(clippedPolygon[i].x, clippedPolygon[i].y);
        }
        this.ctx.closePath();
        this.ctx.clip();

        // 计算原始四边形的边界框
        const minX = Math.min(p1.x, p2.x, p3.x, p4.x);
        const maxX = Math.max(p1.x, p2.x, p3.x, p4.x);
        const minY = Math.min(p1.y, p2.y, p3.y, p4.y);
        const maxY = Math.max(p1.y, p2.y, p3.y, p4.y);
        const width = maxX - minX;
        const height = maxY - minY;

        // 如果边界框太小，不绘制
        if (width < 2 || height < 2) {
            this.ctx.restore();
            return;
        }

        // 绘制图片覆盖整个裁剪区域
        try {
            this.ctx.drawImage(image, minX, minY, width, height);
        } catch (e) {
            console.warn('Failed to draw image:', e);
            this.ctx.fillStyle = 'rgba(150, 150, 150, 0.8)';
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    // Sutherland-Hodgman 多边形裁剪算法
    clipPolygonToNear(points) {
        const near = this.near;
        const result = [];

        for (let i = 0; i < points.length; i++) {
            const curr = points[i];
            const prev = points[(i - 1 + points.length) % points.length];

            if (!curr || !prev) continue;

            const currIn = curr.camZ >= near;
            const prevIn = prev.camZ >= near;

            if (currIn && prevIn) {
                // 两个点都在内，添加当前点
                result.push(curr);
            } else if (currIn && !prevIn) {
                // 从外到内，添加交点和当前点
                const clip = this.computeClipPoint(prev, curr, near);
                if (clip) result.push(clip);
                result.push(curr);
            } else if (!currIn && prevIn) {
                // 从内到外，添加交点
                const clip = this.computeClipPoint(prev, curr, near);
                if (clip) result.push(clip);
            }
            // 两个点都在外，不添加
        }

        return result;
    }

    // 计算两个点与近裁剪面的交点
    computeClipPoint(p1, p2, near) {
        const t = (near - p1.camZ) / (p2.camZ - p1.camZ);
        if (t < 0 || t > 1) return null;

        const scale = this.projectionScale;

        const camX = p1.camX + t * (p2.camX - p1.camX);
        const camY = p1.camY + t * (p2.camY - p1.camY);

        return {
            x: (camX / near) * scale + this.canvas.width / 2,
            y: (camY / near) * scale + this.canvas.height / 2,
            depth: near,
            camX: camX,
            camY: camY,
            camZ: near,
            visible: true
        };
    }

    // 绘制出口标记（绘制所有面）
    drawExit(x, y, size, height, time) {
        const x1 = x, y1 = y;
        const x2 = x + size, y2 = y + size;
        const h = height;
        const pulse = Math.sin(time * 4) * 0.2 + 1;
        const color = `hsl(30, 60%, ${30 + 20 * pulse}%)`;

        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;

        // 绘制出口门框（无垂直光束）
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;

        // 门框 - 简单绘制所有边，依靠画家算法
        const v = {
            flb: {x:x1, y:y1, z:0}, frb: {x:x2, y:y1, z:0},
            frt: {x:x2, y:y1, z:h}, flt: {x:x1, y:y1, z:h},
            blb: {x:x1, y:y2, z:0}, brb: {x:x2, y:y2, z:0},
            brt: {x:x2, y:y2, z:h}, blt: {x:x1, y:y2, z:h}
        };

        // 绘制所有边
        const edges = [
            [v.flb, v.frb], [v.frb, v.frt], [v.frt, v.flt], [v.flt, v.flb], // 前面
            [v.blb, v.brb], [v.brb, v.brt], [v.brt, v.blt], [v.blt, v.blb], // 后面
            [v.flb, v.blb], [v.frb, v.brb], [v.frt, v.brt], [v.flt, v.blt]  // 垂直边
        ];

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        for (const [e1, e2] of edges) {
            this.drawLine3D(e1.x, e1.y, e1.z, e2.x, e2.y, e2.z);
        }
    }

    drawGroundGrid(player) {
        const px = player.x;
        const py = player.y;
        const gridRange = 8;
        const gridSpacing = 2;
        const z = 0.01;

        this.ctx.globalAlpha = 0.3;
        const baseGX = Math.floor(px / gridSpacing) * gridSpacing;
        const baseGY = Math.floor(py / gridSpacing) * gridSpacing;

        for (let i = -gridRange; i <= gridRange; i++) {
            const gx1 = baseGX + i * gridSpacing;
            const gy1 = baseGY - gridRange * gridSpacing;
            const gy2 = baseGY + gridRange * gridSpacing;
            this.drawLine3D(gx1, gy1, z, gx1, gy2, z, '#d2b48c', 0.5);

            const gy3 = baseGY + i * gridSpacing;
            const gx2a = baseGX - gridRange * gridSpacing;
            const gx2b = baseGX + gridRange * gridSpacing;
            this.drawLine3D(gx2a, gy3, z, gx2b, gy3, z, '#d2b48c', 0.5);
        }
        this.ctx.globalAlpha = 1;
    }

    collectAndDrawWalls(player, maze, cellSize, wallHeight, imageManager) {
        const viewDist = 20;
        const viewDistSq = viewDist * viewDist;
        const px = player.x;
        const py = player.y;

        // 计算玩家所在网格位置
        const playerGridX = Math.floor(px / cellSize);
        const playerGridY = Math.floor(py / cellSize);
        const range = Math.ceil(viewDist / cellSize);

        const walls = [];

        // 只遍历玩家周围一定范围的网格
        const minY = Math.max(0, playerGridY - range);
        const maxY = Math.min(maze.height, playerGridY + range);
        const minX = Math.max(0, playerGridX - range);
        const maxX = Math.min(maze.width, playerGridX + range);

        for (let y = minY; y < maxY; y++) {
            for (let x = minX; x < maxX; x++) {
                if (maze.grid[y][x] === 1) {
                    const wx = x * cellSize + cellSize / 2;
                    const wy = y * cellSize + cellSize / 2;
                    const distSq = MathUtils.distSq2D(wx, wy, px, py);

                    if (distSq < viewDistSq) {
                        walls.push({
                            x: x * cellSize,
                            y: y * cellSize,
                            distSq: distSq,
                            gridX: x,
                            gridY: y
                        });
                    }
                }
            }
        }

        // 按距离从远到近排序（简化为距离平方排序）
        walls.sort((a, b) => b.distSq - a.distSq);

        // 绘制所有墙
        for (const wall of walls) {
            this.drawWall(wall.x, wall.y, cellSize, wallHeight, wall.gridX, wall.gridY, imageManager);
        }
    }

    drawExitMarker(exit, cellSize, wallHeight, time) {
        if (!exit) return;
        this.drawExit(
            exit.x * cellSize,
            exit.y * cellSize,
            cellSize, wallHeight,
            time / 1000
        );
    }
}
