// Camera state and animation management

import { useState, useCallback } from 'react';
import { ANIMATION_SETTINGS } from '../constants/graphConstants';

export const useCamera = () => {
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });

  const setCameraImmediate = useCallback((x, y, zoom = camera.zoom) => {
    setCamera({ x, y, zoom });
  }, [camera.zoom]);

  const setCameraTarget = useCallback((x, y, zoom = camera.zoom) => {
    const startCamera = { ...camera };
    const targetCamera = { x, y, zoom };
    const startTime = performance.now();
    const duration = ANIMATION_SETTINGS.CAMERA_TRANSITION_DURATION;

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

  return {
    camera,
    setCameraImmediate,
    setCameraTarget
  };
};