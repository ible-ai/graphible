// Keyboard navigation and camera controls

import { useRef, useEffect } from 'react';
import { ANIMATION_SETTINGS } from '../constants/graphConstants';

export const useKeyboardNavigation = ({
  nodes,
  currentNodeId,
  setCurrentNodeId,
  setNodeDetails,
  setCameraTarget,
  camera,
  setCameraImmediate,
  showPromptCenter,
  generationStatus,
  isTypingPrompt,
  showFeedbackModal
}) => {
  const keysPressed = useRef(new Set());

  const navigateToNextNode = () => {
    const currentNode = nodes.at(currentNodeId);
    if (!currentNode) return;

    let targetNode = null;
    let minDistance = Infinity;

    nodes.forEach(node => {
      if (node.id === currentNodeId) return;

      const dx = node.worldX - currentNode.worldX;
      const dy = node.worldY - currentNode.worldY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      let isInDirection = false;
      if (keysPressed.current.has('w') || keysPressed.current.has('arrowup')) {
        isInDirection = dy < -50;
      } else if (keysPressed.current.has('s') || keysPressed.current.has('arrowdown')) {
        isInDirection = dy > 50;
      } else if (keysPressed.current.has('a') || keysPressed.current.has('arrowleft')) {
        isInDirection = dx < -50;
      } else if (keysPressed.current.has('d') || keysPressed.current.has('arrowright')) {
        isInDirection = dx > 50;
      }

      if (isInDirection && distance < minDistance) {
        minDistance = distance;
        targetNode = node;
      }
    });

    if (targetNode) {
      setCurrentNodeId(targetNode.id);
      setNodeDetails(targetNode);
      setCameraTarget(-targetNode.worldX, -targetNode.worldY);
      keysPressed.current.clear();
    }
  };

  useEffect(() => {
    if (showPromptCenter || isTypingPrompt || showFeedbackModal) return;

    const handleKeyDown = (e) => {
      keysPressed.current.add(e.key.toLowerCase());
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    let lastMoveTime = 0;
    const moveCamera = () => {
      const now = Date.now();
      if (now - lastMoveTime < ANIMATION_SETTINGS.KEYBOARD_THROTTLE_MS) return;
      lastMoveTime = now;

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

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    const interval = setInterval(moveCamera, ANIMATION_SETTINGS.KEYBOARD_THROTTLE_MS);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(interval);
    };
  }, [nodes, showPromptCenter, generationStatus.isGenerating, camera, setCameraImmediate, isTypingPrompt, showFeedbackModal]);
};