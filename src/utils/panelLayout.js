// Geometry for the node details panel, shared with the camera so the node being
// read about is not parked underneath the panel that describes it.

export const PANEL_MARGIN = 24;

export const defaultPanelSize = () => ({
  width: Math.round(Math.min(Math.max(window.innerWidth * 0.5, 420), window.innerWidth - 2 * PANEL_MARGIN)),
  height: Math.round(Math.min(Math.max(window.innerHeight * 0.7, 360), window.innerHeight - 160)),
});

// Docked to the right, leaving the left of the canvas interactive.
export const defaultPanelPosition = (size) => ({
  x: Math.max(PANEL_MARGIN, window.innerWidth - size.width - PANEL_MARGIN),
  y: 96,
});

// How far left to shift the camera so a focused node lands in the space the
// panel does not cover, rather than behind it.
export const focusOffsetForPanel = (zoom = 1, panelOpen = false) => {
  if (!panelOpen) return 0;
  const { width } = defaultPanelSize();
  return (width + PANEL_MARGIN) / (2 * Math.max(zoom, 0.01));
};
