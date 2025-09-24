import { state, mobileMediaQuery } from './state.js';
import { dom } from './dom.js';
import { persistPreferences } from './storage.js';

export function setSidebarCollapsed(collapsed, options = {}) {
  if (!dom.app) return;
  const { persist = true, remember = true } = options;
  const isCollapsed = Boolean(collapsed);
  dom.app.dataset.sidebar = isCollapsed ? 'collapsed' : 'expanded';

  if (dom.sidebarToggle) {
    const toggleLabel = isCollapsed ? 'Show note drawer' : 'Hide note drawer';
    dom.sidebarToggle.setAttribute('aria-expanded', String(!isCollapsed));
    dom.sidebarToggle.setAttribute('aria-label', toggleLabel);
    dom.sidebarToggle.setAttribute('title', toggleLabel);
  }

  if (dom.sidebarCollapse) {
    const collapseLabel = isCollapsed ? 'Expand notes' : 'Collapse notes';
    dom.sidebarCollapse.setAttribute('aria-label', collapseLabel);
    dom.sidebarCollapse.setAttribute('title', collapseLabel);
  }

  if (dom.sidebar) {
    dom.sidebar.setAttribute('aria-hidden', String(isCollapsed));
  }

  state.ui.sidebarCollapsed = isCollapsed;

  if (remember) {
    state.preferences.sidebarCollapsed = isCollapsed;
  }

  if (persist && remember) {
    persistPreferences({ sidebarCollapsed: isCollapsed });
  }

  updateOverlayVisibility();
}

export function updateOverlayVisibility() {
  if (!dom.appOverlay || !dom.app) return;
  const isMobile = mobileMediaQuery.matches;
  const isCollapsed = dom.app.dataset.sidebar === 'collapsed';
  if (isMobile && !isCollapsed) {
    dom.appOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
  } else {
    dom.appOverlay.hidden = true;
    document.body.style.overflow = '';
  }
}

export function handleViewportChange() {
  updateOverlayVisibility();
}
