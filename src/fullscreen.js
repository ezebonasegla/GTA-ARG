// Full screen toggle (with the webkit-prefixed API for Safari) and a HUD button.
const doc = document;
const root = doc.documentElement;

export const fullscreenElement = () => doc.fullscreenElement || doc.webkitFullscreenElement || null;
export const fullscreenSupported = () => !!(root.requestFullscreen || root.webkitRequestFullscreen);

export async function enterFullscreen() {
  try {
    if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
    else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
    else return false;
    // on phones also try to keep it horizontal (only allowed while in full screen)
    await screen.orientation?.lock?.('landscape').catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export async function exitFullscreen() {
  try {
    if (doc.exitFullscreen) await doc.exitFullscreen();
    else doc.webkitExitFullscreen?.();
  } catch {
    /* already out */
  }
}

// Adds the ⛶ button; `onFail` gets a message to show when the browser refuses.
export function setupFullscreenButton(onFail) {
  const btn = doc.createElement('button');
  btn.id = 'fs-button';
  btn.type = 'button';
  btn.title = 'Pantalla completa';
  btn.setAttribute('aria-label', 'Pantalla completa');
  btn.textContent = '⛶';
  doc.body.appendChild(btn);
  const sync = () => btn.classList.toggle('on', !!fullscreenElement());
  doc.addEventListener('fullscreenchange', sync);
  doc.addEventListener('webkitfullscreenchange', sync);
  const toggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (fullscreenElement()) return exitFullscreen();
    const ok = await enterFullscreen();
    if (!ok) {
      const iphone = /iPhone|iPod/.test(navigator.userAgent);
      onFail(
        iphone
          ? 'El iPhone no permite pantalla completa en páginas web. Poné el celular horizontal y ocultá las barras del navegador.'
          : 'Este navegador no permitió la pantalla completa. Probá abrir el juego en Chrome o fuera de la app.',
      );
    }
  };
  btn.addEventListener('click', toggle);
  btn.addEventListener('touchend', toggle, { passive: false });
  return btn;
}
