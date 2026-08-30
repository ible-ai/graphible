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
  // Menus that open from the header. They must clear the details panel, and a
  // z-index on the menu alone cannot: the header is a stacking context, so a
  // child of it can never rise above a sibling of the header. The whole
  // selector is lifted to this while its menu is open.
  DROPDOWN: 150,
  MODAL: 200,
  // Consent interrupts whatever raised it, including the wizard.
  CONSENT: 300,
};
