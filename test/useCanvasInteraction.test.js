import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasInteraction, isInteractiveTarget, ZOOM_LIMITS } from '../src/hooks/useCanvasInteraction';

const camera = { x: 0, y: 0, zoom: 1 };

const mount = (over = {}) => {
  const setCameraImmediate = vi.fn();
  const hook = renderHook((props) => useCanvasInteraction(props), {
    initialProps: { camera, setCameraImmediate, enabled: true, isManipulatingNode: false, ...over },
  });
  return { hook, setCameraImmediate };
};

// Dispatch from a real element: real events come from the canvas div, and a
// target without closest() is a different code path.
const canvas = () => {
  let el = document.getElementById('canvas-surface');
  if (!el) {
    el = document.createElement('div');
    el.id = 'canvas-surface';
    document.body.appendChild(el);
  }
  return el;
};

const mouse = (type, x, y) =>
  canvas().dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));

beforeEach(() => { document.body.innerHTML = ''; });

describe('isInteractiveTarget', () => {
  it('treats the floating panels and controls as not-canvas', () => {
    for (const cls of ['node-component', 'minimap-container', 'details-panel', 'modal', 'node-controls', 'resize-handle']) {
      const el = document.createElement('div');
      el.className = cls;
      document.body.appendChild(el);
      expect(isInteractiveTarget(el), cls).toBeTruthy();
    }
  });

  it('treats form controls and links as not-canvas', () => {
    for (const tag of ['button', 'input', 'textarea', 'select', 'a']) {
      const el = document.createElement(tag);
      document.body.appendChild(el);
      expect(isInteractiveTarget(el), tag).toBeTruthy();
    }
  });

  it('treats bare canvas as draggable', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(isInteractiveTarget(el)).toBeFalsy();
  });

  it('treats a target with no closest() as canvas rather than throwing', () => {
    expect(isInteractiveTarget(document)).toBe(false);
    expect(isInteractiveTarget(null)).toBe(false);
  });
});

describe('panning', () => {
  it('moves the camera by the distance dragged, once', () => {
    const { setCameraImmediate } = mount();

    act(() => { mouse('mousedown', 100, 100); });
    act(() => { mouse('mousemove', 150, 130); });

    // Regression: two effects each handled the drag, doubling every delta.
    expect(setCameraImmediate).toHaveBeenCalledTimes(1);
    expect(setCameraImmediate).toHaveBeenCalledWith(50, 30, 1);
  });

  it('converts screen distance to world distance using zoom', () => {
    const { setCameraImmediate } = mount({ camera: { x: 0, y: 0, zoom: 2 } });

    act(() => { mouse('mousedown', 0, 0); });
    act(() => { mouse('mousemove', 100, 0); });

    expect(setCameraImmediate).toHaveBeenCalledWith(50, 0, 2);
  });

  it('ignores a drag that starts on a control', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    const { setCameraImmediate } = mount();

    act(() => { button.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 10, bubbles: true })); });
    act(() => { mouse('mousemove', 90, 90); });

    expect(setCameraImmediate).not.toHaveBeenCalled();
  });

  it('does not pan while a node is being dragged or resized', () => {
    const { setCameraImmediate } = mount({ isManipulatingNode: true });

    act(() => { mouse('mousedown', 10, 10); });
    act(() => { mouse('mousemove', 90, 90); });

    expect(setCameraImmediate).not.toHaveBeenCalled();
  });

  it('stops panning on mouseup', () => {
    const { setCameraImmediate } = mount();

    act(() => { mouse('mousedown', 0, 0); });
    act(() => { mouse('mouseup', 0, 0); });
    act(() => { mouse('mousemove', 80, 80); });

    expect(setCameraImmediate).not.toHaveBeenCalled();
  });

  it('does nothing at all when disabled', () => {
    const { setCameraImmediate } = mount({ enabled: false });

    act(() => { mouse('mousedown', 0, 0); });
    act(() => { mouse('mousemove', 50, 50); });

    expect(setCameraImmediate).not.toHaveBeenCalled();
  });
});

describe('zooming', () => {
  const wheel = (deltaY) =>
    document.dispatchEvent(new WheelEvent('wheel', { deltaY, cancelable: true }));

  it('zooms in and out around the current zoom', () => {
    const { setCameraImmediate } = mount();

    act(() => { wheel(-100); });
    expect(setCameraImmediate.mock.calls[0][2]).toBeCloseTo(1.1);

    setCameraImmediate.mockClear();
    act(() => { wheel(100); });
    expect(setCameraImmediate.mock.calls[0][2]).toBeCloseTo(0.9);
  });

  it('clamps to the zoom limits', () => {
    const zoomedOut = mount({ camera: { x: 0, y: 0, zoom: ZOOM_LIMITS.min } });
    act(() => { wheel(100); });
    expect(zoomedOut.setCameraImmediate.mock.calls[0][2]).toBe(ZOOM_LIMITS.min);

    const zoomedIn = mount({ camera: { x: 0, y: 0, zoom: ZOOM_LIMITS.max } });
    act(() => { wheel(-100); });
    expect(zoomedIn.setCameraImmediate.mock.calls.at(-1)[2]).toBe(ZOOM_LIMITS.max);
  });

  it('leaves the camera position alone while zooming', () => {
    const { setCameraImmediate } = mount({ camera: { x: 42, y: -17, zoom: 1 } });

    act(() => { wheel(-100); });
    const [x, y] = setCameraImmediate.mock.calls[0];
    expect([x, y]).toEqual([42, -17]);
  });
});
