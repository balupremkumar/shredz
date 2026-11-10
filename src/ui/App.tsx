/**
 * @input Nothing yet; the store arrives in wave 1
 * @output The fixed frame: status band, one scrolling list per section, the bottom bar (rules F1 to F8, S1 to S4)
 * @position Root component, mounted by main.tsx
 */
import { useRef, useState } from 'react';
import { Probe } from './Probe';

const SECTIONS = ['Today', 'Foods', 'Trends', 'Settings'] as const;
type Section = (typeof SECTIONS)[number];

export function App() {
  const [section, setSection] = useState<Section>('Today');
  const list = useRef<HTMLDivElement>(null);

  const choose = (next: Section) => {
    // F7: tapping the section you are on returns its list to the top.
    if (next === section) list.current?.scrollTo({ top: 0, behavior: 'smooth' });
    else setSection(next);
  };
  const tab = (name: Section) => (
    <button type="button" className="tab" aria-current={section === name ? 'page' : undefined} onClick={() => choose(name)}>
      {name}
    </button>
  );

  return (
    <div className="frame">
      <div className="frame__status" />
      <main className="frame__list" ref={list} key={section}>
        {section === 'Today' ? <Probe /> : <h1 className="title">{section}</h1>}
      </main>
      <nav className="tabbar" aria-label="Sections">
        {tab('Today')}
        {tab('Foods')}
        <button type="button" className="tab tab--log">Log</button>
        {tab('Trends')}
        {tab('Settings')}
      </nav>
    </div>
  );
}
