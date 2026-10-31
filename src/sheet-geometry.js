export const KEYBOARD_THRESHOLD = 100;

export function sheetGeometry({ innerHeight, vvHeight, vvOffsetTop = 0, vvScale = 1,
  safeTop = 0, safeBottom = 0 }) {
  const keyboardHeight = Math.max(0, innerHeight - vvHeight - vvOffsetTop);
  const keyboardOpen = vvScale <= 1.01 && keyboardHeight >= KEYBOARD_THRESHOLD;
  const height = keyboardOpen ? vvHeight : innerHeight;
  return {
    vvHeight: height,
    bottom: keyboardOpen ? keyboardHeight : 0,
    keyboardHeight,
    keyboardOpen,
    dockInset: keyboardOpen ? 0 : safeBottom,
    maxSheetHeight: Math.max(0, height - safeTop),
  };
}
