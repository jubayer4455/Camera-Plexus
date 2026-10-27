// In-page floating HUD is permanently disabled per user request.
// All settings, anime powers, games, air canvas, and presets are fully controlled
// via the Chrome toolbar popup icon.
// This file ensures no on-screen HUD elements or styles are ever injected into web pages.
(() => {
  const FX = (globalThis.__plexusFx = globalThis.__plexusFx || {});

  function removeFloatingHUD() {
    try {
      const existing = document.getElementById('plexus-floating-hud');
      if (existing) existing.remove();
      const styles = document.getElementById('plexus-hud-styles');
      if (styles) styles.remove();
    } catch (_) {}
  }

  // Actively remove any floating HUD if present
  removeFloatingHUD();
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', removeFloatingHUD, { once: true });
    }
  }

  FX.updateHUD = removeFloatingHUD;
})();
