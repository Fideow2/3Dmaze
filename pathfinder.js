// pathfinder.js - BFS pathfinding for 3D maze
// Provides hint system to help players find the exit

class MazePathfinder {
    constructor(maze, width, height) {
        this.maze = maze;
        this.width = width;
        this.height = height;
    }

    // Convert world position to grid coordinates
    worldToGrid(x, y) {
        return {
            x: Math.floor(x / 2),
            y: Math.floor(y / 2)
        };
    }

    // Convert grid coordinates to world position (center of cell)
    gridToWorld(gx, gy) {
        return {
            x: gx * 2 + 1,
            y: gy * 2 + 1
        };
    }

    // Check if a grid cell is walkable
    isWalkable(gx, gy) {
        if (gx < 0 || gx >= this.width || gy < 0 || gy >= this.height) {
            return false;
        }
        return this.maze[gy] && this.maze[gy][gx] === 0;
    }

    // BFS to find shortest path from start to end
    findPath(startX, startY, endX, endY) {
        const start = this.worldToGrid(startX, startY);
        const end = this.worldToGrid(endX, endY);

        // Validate start and end
        if (!this.isWalkable(start.x, start.y) || !this.isWalkable(end.x, end.y)) {
            return null;
        }

        // BFS
        const queue = [{ x: start.x, y: start.y, path: [] }];
        const visited = new Set();
        visited.add(`${start.x},${start.y}`);

        const directions = [
            { dx: 0, dy: -1 }, // North
            { dx: 1, dy: 0 },  // East
            { dx: 0, dy: 1 },  // South
            { dx: -1, dy: 0 }  // West
        ];

        while (queue.length > 0) {
            const current = queue.shift();

            // Check if reached destination
            if (current.x === end.x && current.y === end.y) {
                return current.path.concat([{ x: end.x, y: end.y }]);
            }

            // Explore neighbors
            for (const dir of directions) {
                const nx = current.x + dir.dx;
                const ny = current.y + dir.dy;
                const key = `${nx},${ny}`;

                if (this.isWalkable(nx, ny) && !visited.has(key)) {
                    visited.add(key);
                    queue.push({
                        x: nx,
                        y: ny,
                        path: current.path.concat([{ x: current.x, y: current.y }])
                    });
                }
            }
        }

        return null; // No path found
    }

    // Get direction hint (next step towards exit)
    getDirectionHint(playerX, playerY, exitX, exitY) {
        const path = this.findPath(playerX, playerY, exitX, exitY);
        
        if (!path || path.length < 2) {
            return null;
        }

        // Get the next waypoint
        const nextGrid = path[1]; // path[0] is current position
        const nextWorld = this.gridToWorld(nextGrid.x, nextGrid.y);

        // Calculate direction vector
        const dx = nextWorld.x - playerX;
        const dy = nextWorld.y - playerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) {
            return null;
        }

        return {
            dx: dx / distance,
            dy: dy / distance,
            distance: distance,
            nextX: nextWorld.x,
            nextY: nextWorld.y,
            pathLength: path.length
        };
    }

    // Get compass direction name
    getCompassDirection(angle) {
        // Normalize angle to 0-2π
        const normalized = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const degrees = normalized * (180 / Math.PI);
        
        if (degrees >= 337.5 || degrees < 22.5) return '东 (E)';
        if (degrees >= 22.5 && degrees < 67.5) return '东南 (SE)';
        if (degrees >= 67.5 && degrees < 112.5) return '南 (S)';
        if (degrees >= 112.5 && degrees < 157.5) return '西南 (SW)';
        if (degrees >= 157.5 && degrees < 202.5) return '西 (W)';
        if (degrees >= 202.5 && degrees < 247.5) return '西北 (NW)';
        if (degrees >= 247.5 && degrees < 292.5) return '北 (N)';
        return '东北 (NE)';
    }
}

// Export for use in game
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MazePathfinder;
}
