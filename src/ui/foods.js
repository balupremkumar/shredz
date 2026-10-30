export function render(root, app) {
  const title = document.createElement('div');
  title.className = 'empty';
  title.textContent = 'Foods';
  root.appendChild(title);
}

export const sheets = {};
