// Background panning and wheel zoom for the canvas.
//
// Pulled out of App.jsx, where it existed twice: two near-identical effects
// both attached document-level pointer listeners, so every drag was applied
// twice and the two copies had drifted apart. Keeping it in one hook means
// there is one place to get it right.

import { useState, useEffect, useCallback } from 'react';

// Anything matching these is a control, not canvas. A new floating panel needs
// one of these class names or dragging from it will pan the graph underneath.
const INTERACTIVE_SELECTORS = [
  '.node-component',
  '.minimap-container',
  '.details-panel',
  '.modal',
  '.node-controls',
  '.resize-handle',
  'button',
  'input',
  'textarea',
  'select',
  'a',
];

export const isInteractiveTarget = (element) => {
  // Events can originate from document or a text node, neither of which has
  // closest(); treating those as canvas is correct and avoids a throw inside
  // the listener, which would silently kill panning.
  if (!element || typeof element.closest !== 'function') return false;
  return INTERACTIVE_SELECTORS.some((selector) => element.closest(selector));
};

export const ZOOM_LIMITS = { min: 0.1, max: 3.0 };
const ZOOM_STEP = 0.1;

export const useCanvasInteraction = ({
  camera,
  setCameraImmediate,
  enabled = true,
  isManipulatingNode = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) return undefined;

    const handleMouseDown = (e) => {
      if (isManipulatingNode) return;
      if (isInteractiveTarget(e.target)) return;

      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    };

    const handleMouseMove = (e) => {
      if (isManipulatingNode || !isDragging) return;

      // Screen delta becomes world delta by dividing out the zoom.
      setCameraImmediate(
        camera.x + (e.clientX - dragStart.x) / camera.zoom,
        camera.y + (e.clientY - dragStart.y) / camera.zoom,
        camera.zoom
      );
      setDragStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    };

    const handleMouseUp = () => {
      if (!isDragging) return;
      setIsDragging(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    };
  }, [enabled, isManipulatingNode, isDragging, dragStart, camera, setCameraImmediate]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP;
    const zoom = Math.max(ZOOM_LIMITS.min, Math.min(camera.zoom * factor, ZOOM_LIMITS.max));
    setCameraImmediate(camera.x, camera.y, zoom);
  }, [camera, setCameraImmediate]);

  useEffect(() => {
    if (!enabled) return undefined;

    // Non-passive so preventDefault actually stops the page scrolling.
    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => document.removeEventListener('wheel', handleWheel);
  }, [enabled, handleWheel]);

  return { isDragging };
};
