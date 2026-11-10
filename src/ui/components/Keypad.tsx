/**
 * @input A text value, its unit, and a change handler
 * @output The amount figure and Shredz's own twelve keys; never an input element (rule K1)
 * @position Used by every sheet that takes a number: amount, weight, goals, nutrition values
 */
import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { KEYS, pressKey } from '../../core/keypad.js';

export interface KeypadState {
  text: string;
  fresh: boolean;
}

interface AmountProps {
  state: KeypadState;
  unit: string;
  label: string;
  preview?: string;
  onChange: (next: KeypadState) => void;
  onEnter?: () => void;
}

/** The big figure. It takes hardware keys so tests and a desktop keyboard work. */
export function Amount({ state, unit, label, preview, onChange, onEnter }: AmountProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (/^[0-9.]$/.test(event.key)) onChange(pressKey(state, event.key));
    else if (event.key === 'Backspace') onChange(pressKey(state, 'del'));
    else if (event.key === 'Enter') onEnter?.();
    else return;
    event.preventDefault();
  };
  return (
    <div
      className="amount"
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuetext={`${state.text || '0'} ${unit}`}
      onKeyDown={onKeyDown}>
      <span className="amount__value">{state.text || '0'}</span>
      <span className="amount__caret" aria-hidden="true" />
      <span className="amount__unit">{unit}</span>
      <div className="amount__preview" aria-live="polite">{preview ?? ''}</div>
    </div>
  );
}

interface KeysProps {
  state: KeypadState;
  onChange: (next: KeypadState) => void;
}

const HOLD_MS = 500;

/** Twelve keys. They act on touch-down, and holding delete clears the value. */
export function Keys({ state, onChange }: KeysProps) {
  const latest = useRef(state);
  latest.current = state;
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopHold = useCallback(() => {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
  }, []);
  useEffect(() => stopHold, [stopHold]);

  const down = (key: string) => (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.dataset.down = '';
    onChange(pressKey(latest.current, key));
    if (key === 'del') hold.current = setTimeout(() => onChange(pressKey(latest.current, 'clear')), HOLD_MS);
  };
  const up = (event: PointerEvent<HTMLButtonElement>) => {
    delete event.currentTarget.dataset.down;
    stopHold();
  };

  return (
    <div className="keys">
      {KEYS.map(key => (
        <button
          key={key}
          type="button"
          className="key"
          aria-label={key === 'del' ? 'Delete' : key === '.' ? 'Point' : key}
          onPointerDown={down(key)}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
          onClick={event => {
            // A click with no pointer (keyboard, assistive tech) still presses the key.
            if (event.detail === 0) onChange(pressKey(latest.current, key));
          }}>
          {key === 'del' ? '⌫' : key}
        </button>
      ))}
    </div>
  );
}
