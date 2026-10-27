// Status logger for Camera Plexus.
// In-page on-screen popups/pills are permanently disabled per user request.
// Statuses are logged cleanly to console, and full state is displayed in the toolbar popup.
(() => {
  const FX = (globalThis.__plexusFx = globalThis.__plexusFx || {});

  // Clean up any legacy status pill elements if present
  try {
    const existing = document.querySelector('div[role="status"]');
    if (existing && existing.textContent?.includes('Camera Plexus')) {
      existing.remove();
    }
  } catch (_) {}

  // Log status cleanly without polluting or obstructing the host web page DOM
  FX.showStatus = (text, tone = 'info') => {
    try {
      console.log(`[Camera Plexus ${tone.toUpperCase()}]`, text);
    } catch (_) {}
  };
})();
