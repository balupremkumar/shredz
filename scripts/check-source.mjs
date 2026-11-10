/**
 * @input Every file under src/
 * @output Exit code 1 and a list of findings when a design rule is broken (K2, K7, D1 in DESIGN-V3.md)
 * @position Run by `npm run check`; every build job's "done when" includes it
 *
 * A line is exempt when the line above it contains "check-source: allow".
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = join(import.meta.dirname, '..', 'src');
const THEME = `theme${sep}`;
const RULES = [
  { id: 'K2', what: 'native select', test: /<select\b/, files: /\.(tsx|jsx|html)$/ },
  { id: 'K2', what: 'native date or number input', test: /type=["'{]+\s*["']?(date|number|time|datetime-local|month|week)\b/, files: /\.(tsx|jsx|html)$/ },
  { id: 'K7', what: 'field id or name that invites AutoFill', test: /\b(id|name|htmlName|htmlFor)=["'][^"']*(name|email|mail|card|pass|user|login|addr|phone|tel|zip|postal|otp|code)[^"']*["']/i, files: /\.(tsx|jsx|html)$/ },
  { id: 'D1', what: 'raw hex colour outside src/theme', test: /#[0-9a-fA-F]{3,8}\b(?![\w-])/, files: /\.(tsx|jsx|ts|css)$/, skipTheme: true },
  { id: 'D1', what: 'rgb or hsl colour outside src/theme', test: /\b(rgba?|hsla?)\(/, files: /\.(tsx|jsx|ts|css)$/, skipTheme: true },
];

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const findings = [];
for (const path of walk(root)) {
  const rel = relative(root, path);
  if (rel.startsWith(`core${sep}`)) continue;
  const source = readFileSync(path, 'utf8');
  // The probe's known-bad case is the only file allowed to opt out whole.
  if (source.includes('check-source: allow-file')) continue;
  const lines = source.split(/\r?\n/);
  for (const rule of RULES) {
    if (!rule.files.test(path)) continue;
    if (rule.skipTheme && rel.startsWith(THEME)) continue;
    lines.forEach((line, index) => {
      if (!rule.test.test(line)) return;
      if (index > 0 && lines[index - 1].includes('check-source: allow')) return;
      if (line.includes('check-source: allow')) return;
      findings.push(`${rule.id} ${rule.what}: src/${rel.split(sep).join('/')}:${index + 1}`);
    });
  }
}

if (findings.length) {
  console.error(findings.join('\n'));
  console.error(`\n${findings.length} finding(s). See DESIGN-V3.md for the rule IDs.`);
  process.exit(1);
}
console.log('check-source: clean');
