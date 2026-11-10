/**
 * @input Nothing; a throwaway screen for task W0.3
 * @output Six cases Balu taps through on his iPhone to see what iOS shows above the keyboard
 * @position Mounted by App.tsx until the real screens exist; deleted after the phone check
 *
 * check-source: allow-file (case 6 is the v2 form on purpose)
 */
import { useState } from 'react';
import { BottomSheet } from '@astryxdesign/core/BottomSheet';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Amount, Keys, type KeypadState } from './components/Keypad';
import { keypadValue } from '../core/keypad.js';

const CASES = [
  { id: 1, name: 'One field called "Name"', look: 'Old wording. Does an AutoFill box or the arrows bar show?' },
  { id: 2, name: 'One field called "Food"', look: 'New wording. Should be the cleanest text field.' },
  { id: 3, name: 'Search field', look: 'Is the bar there? Does the list stay put?' },
  { id: 4, name: 'Text box for typing a meal', look: 'Is the bar there? Can you see what you type?' },
  { id: 5, name: 'Shredz keypad', look: 'No iPhone keyboard should appear at all.' },
  { id: 6, name: 'Old-style form (the bad one)', look: 'This is the v2 layout. Expect the arrows, tick and picker.' },
] as const;

export function Probe() {
  const [open, setOpen] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [pad, setPad] = useState<KeypadState>({ text: '150', fresh: true });
  const current = CASES.find(item => item.id === open);
  const grams = keypadValue(pad.text);

  return (
    <>
      <h1 className="title">Shredz probe</h1>
      <p className="note">Open each case, tap the field, and note what iOS shows above the keyboard. Then scroll this list hard past the top and the bottom: the clock band and the bar below must not move.</p>
      <div className="group">
        {CASES.map(item => (
          <button key={item.id} type="button" className="row" onClick={() => { setText(''); setOpen(item.id); }}>
            <span className="row__body">
              <span className="row__name">{item.id}. {item.name}</span>
              <span className="row__sub">{item.look}</span>
            </span>
            <span className="row__chev" aria-hidden="true">›</span>
          </button>
        ))}
      </div>
      <p className="label">Scroll test</p>
      <div className="group">
        {Array.from({ length: 30 }, (_, index) => (
          <div key={index} className="row">
            <span className="row__body"><span className="row__name">Row {index + 1}</span><span className="row__sub">Filler to scroll</span></span>
            <span className="row__end">{(index + 1) * 37}</span>
          </div>
        ))}
      </div>

      <BottomSheet isOpen={open !== null} onOpenChange={isOpen => { if (!isOpen) setOpen(null); }} label={current?.name ?? 'Case'} height="tall">
        <div className="sheet">
          <div className="sheet__head">
            <button type="button" className="link" onClick={() => setOpen(null)}>Close</button>
            <h2 className="sheet__title">Case {current?.id}</h2>
            <span />
          </div>
          <p className="note">{current?.look}</p>
          {open === 1 && <TextInput label="Name" value={text} onChange={setText} size="lg" />}
          {open === 2 && <TextInput label="Food" value={text} onChange={setText} size="lg" autoComplete="off" hasAutoCorrect={false} hasSpellCheck={false} autoCapitalize="sentences" enterKeyHint="done" />}
          {open === 3 && (
            <>
              <TextInput label="Find a food" isLabelHidden placeholder="Search 20 foods" type="search" value={text} onChange={setText} size="lg" autoComplete="off" hasAutoCorrect={false} hasSpellCheck={false} autoCapitalize="none" enterKeyHint="search" />
              <div className="group">
                {['Chicken breast', 'Basmati rice', 'Weet-Bix', 'Eggs', 'Trim milk', 'Blue milk', 'Cashews', 'Peanuts', 'Potato', 'Whey'].filter(name => name.toLowerCase().includes(text.toLowerCase())).map(name => (
                  <div key={name} className="row"><span className="row__body">{name}</span></div>
                ))}
              </div>
            </>
          )}
          {open === 4 && <TextArea label="What you ate" value={text} onChange={setText} rows={4} />}
          {open === 5 && (
            <>
              <Amount state={pad} unit="g" label="Amount in grams" preview={grams ? `${Math.round(grams * 1.41)} kcal · ${(grams * 0.29).toFixed(1)} g protein` : 'Enter an amount'} onChange={setPad} />
              <div className="chips">
                {[100, 150, 200, 250].map(value => (
                  <button key={value} type="button" className="chip" onClick={() => setPad({ text: String(value), fresh: true })}>{value} g</button>
                ))}
              </div>
              <Keys state={pad} onChange={setPad} />
              <div className="sheet__fill" />
              <button type="button" className="btn" disabled={!grams}>Add to Meal 2</button>
            </>
          )}
          {open === 6 && (
            <form onSubmit={event => event.preventDefault()}>
              <label className="field-label" htmlFor="probe-old-name">Name</label>
              <input id="probe-old-name" name="name" type="text" />
              <label className="field-label" htmlFor="probe-old-unit">Unit</label>
              <select id="probe-old-unit"><option>grams</option><option>millilitres</option><option>items</option></select>
              <label className="field-label" htmlFor="probe-old-kcal">Calories</label>
              <input id="probe-old-kcal" type="text" inputMode="decimal" />
              <label className="field-label" htmlFor="probe-old-protein">Protein</label>
              <input id="probe-old-protein" type="text" inputMode="decimal" />
            </form>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
