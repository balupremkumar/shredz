let registered = false;
let reloadPending = false;
let hiddenSinceUpdate = false;
let reloading = false;

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || registered) return;
  registered = true;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    reloadPending = true;
    hiddenSinceUpdate = hiddenSinceUpdate || document.visibilityState === 'hidden';
  });

  document.addEventListener('visibilitychange', () => {
    if (!reloadPending || reloading) return;
    if (document.visibilityState === 'hidden') {
      hiddenSinceUpdate = true;
    } else if (document.visibilityState === 'visible' && hiddenSinceUpdate) {
      reloading = true;
      location.reload();
    }
  });

  const register = () => {
    // A failed install must not stop the diary from working online.
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

export function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}
