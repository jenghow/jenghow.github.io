export function createInput() {
  const keys = new Set();

  window.addEventListener('keydown', (e) => {
    keys.add(e.key);
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.key);
  });

  return {
    get isAccelerating() { return keys.has('ArrowUp') || keys.has('w') || keys.has('W'); },
    get isBraking() { return keys.has('ArrowDown') || keys.has('s') || keys.has('S'); },
  };
}
