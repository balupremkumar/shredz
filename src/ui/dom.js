export function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  const { class: className, text, on = {}, attrs = {}, dataset = {} } = props || {};
  if (className !== undefined) element.className = className;
  if (text !== undefined) element.textContent = text;
  for (const [name, handler] of Object.entries(on)) element.addEventListener(name, handler);
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined && value !== false) {
      element.setAttribute(name, value === true ? '' : String(value));
    }
  }
  Object.assign(element.dataset, dataset);
  function append(child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) child.forEach(append);
    else element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  children.forEach(append);
  return element;
}

export function clear(element) {
  element.replaceChildren();
}

const shapes = {
  diary: 'M5 3h14v18H5V3zm3 4v2h8V7H8zm0 4v2h8v-2H8zm0 4v2h6v-2H8z',
  foods: 'M6 2h2v7h1V2h2v7c0 2-1 3-2 3v10H6V12c-2-1-3-2-3-4V2h2v7h1V2zm12 0h3v20h-3v-8h-3V8c0-3 1-5 3-6z',
  weight: 'M6 3h12l4 18H2L6 3zm2 3-1 5h10l-1-5H8zm3 1h2v3h-2V7z',
  gear: 'M10 2h4l1 3 3-1 2 3-2 3 3 1v3l-3 1 2 3-2 2-3-1-1 3h-4l-1-3-3 1-2-2 1-3-3-1v-3l3-1-1-3 2-3 3 1 1-3zm2 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  mic: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5zM5 10h2v2a5 5 0 0 0 10 0v-2h2v2a7 7 0 0 1-6 7v2h3v2H8v-2h3v-2a7 7 0 0 1-6-7v-2z',
  'chev-left': 'M15 3l3 3-6 6 6 6-3 3-9-9 9-9z',
  'chev-right': 'M9 3 6 6l6 6-6 6 3 3 9-9-9-9z',
  close: 'm6 3 6 6 6-6 3 3-6 6 6 6-3 3-6-6-6 6-3-3 6-6-6-6 3-3z',
};

export function icon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', width: '24', height: '24', 'aria-hidden': 'true', focusable: 'false', fill: 'currentColor' })) {
    svg.setAttribute(key, value);
  }
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', shapes[name] || '');
  path.setAttribute('fill-rule', 'evenodd');
  svg.appendChild(path);
  return svg;
}
