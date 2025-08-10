import { useState, useRef, useCallback } from 'react';

const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
const WORLD_CENTER = { x: 0, y: 0 };
const NODE_SIZE = { width: 180, height: 100 };
const NODE_SPACING = { x: NODE_SIZE.width * 1.8, y: NODE_SIZE.height * 1.5 };
const VIEWPORT_CENTER = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
const lastMoveTime = useRef(0);

const worldToScreen = (worldX, worldY) => ({
    x: worldX + VIEWPORT_CENTER.x,
    y: worldY + VIEWPORT_CENTER.y
});


const setCameraImmediate = useCallback((x, y, zoom = camera.zoom) => {
    setCamera({ x, y, zoom });
}, [camera.zoom]);

const setCameraImmediateByOffset = useCallback((deltaX, deltaY) => {
    setCameraImmediate(camera.x + deltaX / camera.zoom, camera.y + deltaY / camera.zoom)
}, [camera.zoom]);

const setCameraTarget = useCallback((x, y, zoom = camera.zoom) => {
    // Smooth transition using requestAnimationFrame
    const startCamera = { ...camera };
    const targetCamera = { x, y, zoom };
    const startTime = performance.now();
    const duration = 300; // ms

    const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function
        const easeOut = 1 - Math.pow(1 - progress, 3);

        const newCamera = {
            x: startCamera.x + (targetCamera.x - startCamera.x) * easeOut,
            y: startCamera.y + (targetCamera.y - startCamera.y) * easeOut,
            zoom: startCamera.zoom + (targetCamera.zoom - startCamera.zoom) * easeOut
        };

        setCamera(newCamera);

        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    };

    requestAnimationFrame(animate);
}, [camera]);

const calculateNodePosition = (nodeIndex, parentNodeId, depth) => {
    const parentWorldX = WORLD_CENTER.x + depth * NODE_SPACING.x;
    const parentWorldY = WORLD_CENTER.y + depth * NODE_SPACING.y;
    const yOffset = -NODE_SPACING.y * nodeIndex;
    const xOffset = nodeIndex > parentNodeId + 1 ? NODE_SPACING.x * (2 * (nodeIndex % 2) - 1) : 0;
    return { worldX: parentWorldX + xOffset, worldY: parentWorldY + yOffset };
};

const moveCamera = () => {
    const now = Date.now();
    if (now - lastMoveTime.current < 50) return; // Throttle to 20fps max
    lastMoveTime.current = now;

    if (keysPressed.current.size === 0) return;

    if (keysPressed.current.has('shift')) {
        // Free navigation mode
        let deltaX = 0, deltaY = 0;
        const speed = 15 / camera.zoom;

        if (keysPressed.current.has('w') || keysPressed.current.has('arrowup')) deltaY += speed;
        if (keysPressed.current.has('s') || keysPressed.current.has('arrowdown')) deltaY -= speed;
        if (keysPressed.current.has('a') || keysPressed.current.has('arrowleft')) deltaX += speed;
        if (keysPressed.current.has('d') || keysPressed.current.has('arrowright')) deltaX -= speed;

        if (deltaX !== 0 || deltaY !== 0) {
            setCameraImmediate(camera.x + deltaX, camera.y + deltaY);
        }
    } else {
        // Snap navigation between nodes
        if (keysPressed.current.has('w') || keysPressed.current.has('arrowup') ||
            keysPressed.current.has('s') || keysPressed.current.has('arrowdown') ||
            keysPressed.current.has('a') || keysPressed.current.has('arrowleft') ||
            keysPressed.current.has('d') || keysPressed.current.has('arrowright')) {
            navigateToNextNode();
        }
    }
};

export default ({ calculateNodePosition, moveCamera, worldToScreen, setCameraImmediateByOffset, setCameraImmediate, camera });