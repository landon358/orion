/**
 * The shader gradient behind the dashboard pages (admin and business).
 *
 * js/vendor/shader-bg.js is the ShaderGradient library (React + three.js) built into
 * one file from tools/shader-bg.entry.jsx, which holds the exact settings. It's
 * about 300 KB gzipped, so it only loads the first time a dashboard page opens,
 * and the WebGL canvas is torn down again when you leave, so the GPU rests.
 */
let unmount = null;
let loading = null;
let want = false;
let parked = null;      // {u, timer}: torn down after the fade unless we come straight back

export function setBackdrop(on, host) {
  want = on;
  if (on) {
    if (parked) { clearTimeout(parked.timer); unmount = parked.u; parked = null; host.classList.add('live'); return; }
    if (unmount || loading) return;
    if (!hasWebGL() || matchMedia('(max-width: 899px)').matches) return;   // phones get a still CSS gradient

    host.classList.remove('live');
    loading = import('./vendor/shader-bg.js')
      .then(({ mount }) => {
        loading = null;
        if (!want) return;
        unmount = mount(host, { still: matchMedia('(prefers-reduced-motion: reduce)').matches });
        // the canvas needs a frame or two to draw its first image; fade in after that
        setTimeout(() => want && host.classList.add('live'), 450);
      })
      .catch((err) => { loading = null; console.warn('Backdrop shader failed to load', err); });
  } else {
    host.classList.remove('live');
    if (!unmount) return;
    const u = unmount;
    unmount = null;
    parked = { u, timer: setTimeout(() => { parked = null; u(); }, 900) };   // after the fade
  }
}

function hasWebGL() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}
