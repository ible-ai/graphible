// One place for stacking order, because these were scattered as ad hoc numbers
// and collided: the details panel sat at 4, below the minimap at 100, so the
// minimap swallowed clicks on the panel docked beneath it. Raising the panel
// then put it above every modal.
//
// Ordered from the canvas upward.
export const Z = {
  NODE: 5,
  NODE_CURRENT: 10,
  HEADER: 20,
  STATUS_BAR: 30,
  MINIMAP: 100,
  DETAILS_PANEL: 120,
  MODAL: 200,
  // Consent interrupts whatever raised it, including the wizard.
  CONSENT: 300,
};
