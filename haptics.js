// Toque curto: Android usa vibrate; iOS 18+ não tem API, mas alternar um <input switch> nativo dispara o háptico do sistema.
let label;

export function tick() {
  try { pulse(); } catch {} // háptico é bônus: nunca quebra o gesto.
}

function pulse() {
  // Sem gesto do usuário o navegador bloqueia (e o Chrome loga erro).
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  if (typeof navigator.vibrate === 'function') { navigator.vibrate(8); return; }
  if (!matchMedia('(pointer: coarse)').matches) return;
  if (!label) {
    label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.append(input);
    document.body.append(label);
  }
  label.click();
}
