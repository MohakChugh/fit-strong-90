import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/categories';
import { HUB_WASH } from '@/screens/hub/frame';
import { contrast, luminance, toSrgb } from './contrast';
import { springLinear } from './motion';

const css = readFileSync(path.resolve(__dirname, '../index.css'), 'utf8');
const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * The body of the top-level `selector` block that declares `holding`. index.css
 * has several `:root {` and `.dark {` blocks (shadcn's, the Apple foundation's,
 * the glass recipe's, one-liners), so the first one isn't necessarily the one.
 */
function block(selector: string, holding: string): string {
  const bodies = css.split(`\n${selector}`).slice(1).map(rest => rest.slice(0, rest.indexOf('}')));
  const found = bodies.filter(body => new RegExp(`(?<![\\w-])${holding}:`).test(body));
  if (found.length !== 1) throw new Error(`${found.length} ${selector} blocks declare ${holding}`);
  return found[0];
}
/** [L, C, h] of `name`, in the `selector` block that declares `holding`: by default the card's, where the category colours live. */
function token(selector: string, name: string, holding = '--grouped-card'): [number, number, number] {
  const m = new RegExp(`(?<![\\w-])${name}:\\s*oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\)`).exec(block(selector, holding));
  if (!m) throw new Error(`${name} not found under ${selector}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}
const THEMES = [[':root {', 'light'], ['.dark {', 'dark']] as const;
const IDS = [...CATEGORIES.map(x => x.id), 'move'];

describe('category colours (journey §20.3)', () => {
  for (const [selector, theme] of THEMES) {
    const card = token(selector, '--grouped-card');
    for (const c of IDS) {
      it(`${c} in ${theme}: graphics ≥ 3:1 and ink ≥ 4.5:1 on the card`, () => {
        expect(contrast(token(selector, `--cat-${c}`), card)).toBeGreaterThanOrEqual(3);
        expect(contrast(token(selector, `--cat-${c}-ink`), card)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it('registers each with Tailwind, so classes like text-cat-walk-ink work', () => {
    for (const name of IDS.flatMap(c => [`cat-${c}`, `cat-${c}-ink`])) expect(css).toContain(`--color-${name}: var(--${name});`);
  });
});

/** WCAG relative luminance of an sRGB colour with 0–255 channels. */
const srgbLuminance = (rgb: number[]) =>
  rgb.map(v => v / 255).map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((y, v, i) => y + [0.2126, 0.7152, 0.0722][i] * v, 0);

describe('glass recipe (journey §20.1)', () => {
  it('is defined with a solid fallback for the in-app setting, transitions, more contrast and no support', () => {
    expect(css).toMatch(/\.glass\s*\{[^}]*backdrop-filter:\s*blur\(16px\) saturate\(180%\)/);
    expect(css).toMatch(/:root\[data-glass="solid"\] \.glass/);
    expect(css).toMatch(/:root\[data-vt-running\] \.glass/);
    expect(css).toMatch(/@media \(prefers-contrast: more\)\s*\{\s*\.glass/);
    expect(css).toMatch(/@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)/);
  });
  it('keeps body text at 4.5:1 over white, black and a saturated red behind the glass (K-28)', () => {
    for (const [selector, theme] of THEMES) {
      const fill = /--glass-fill:\s*rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/.exec(block(selector, '--glass-fill'));
      if (!fill) throw new Error(`--glass-fill not found under ${selector}`);
      const [r, g, b, alpha] = fill.slice(1).map(Number);
      const text = luminance(token(selector, '--foreground', '--foreground'));
      for (const [name, behind] of [['white', [255, 255, 255]], ['black', [0, 0, 0]], ['red', [255, 0, 0]]] as const) {
        // Browsers composite in sRGB, and blur and saturate(180%) leave these three backdrops unchanged.
        const glass = srgbLuminance([r, g, b].map((v, i) => alpha * v + (1 - alpha) * behind[i]));
        expect((Math.max(text, glass) + 0.05) / (Math.min(text, glass) + 0.05), `${theme} over ${name}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe('tile icons (journey §7.2)', () => {
  const tile = readFileSync(path.resolve(__dirname, '../screens/home/Tile.tsx'), 'utf8');
  it('mix the category colour at 16% into the circle and draw the glyph in its ink', () => {
    expect(tile).toContain('background: `color-mix(in oklab, var(${category.colour}) 16%, transparent)`');
    expect(tile).toContain('color: `var(${category.colour}-ink)`');
  });
  it('keep each glyph at 4.5:1 on its circle over the card, in light and dark (lowest measured 5.2:1)', () => {
    for (const [selector, theme] of THEMES) {
      const card = toSrgb(token(selector, '--grouped-card'));
      for (const c of IDS) {
        // 16% of the colour over the card, composited in sRGB as browsers draw it.
        const circle = toSrgb(token(selector, `--cat-${c}`)).map((v, i) => 255 * (0.16 * v + 0.84 * card[i]));
        const ink = luminance(token(selector, `--cat-${c}-ink`));
        const bg = srgbLuminance(circle);
        expect((Math.max(ink, bg) + 0.05) / (Math.min(ink, bg) + 0.05), `${c} in ${theme}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

/** The body of each `@media <query> {` block, by brace matching. */
function media(query: string): string[] {
  return [...bare.matchAll(new RegExp(`@media ${query.replace(/[()]/g, '\\$&')} \\{`, 'g'))].map(m => {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; depth > 0; i++) depth += bare[i] === '{' ? 1 : bare[i] === '}' ? -1 : 0;
    return bare.slice(m.index + m[0].length, i - 1);
  });
}
/** Each innermost rule: its selectors and its declarations, with whitespace normalised. */
const rules = (body: string) => [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({
  selectors: m[1].split(',').map(s => s.trim().replace(/\s+/g, ' ')),
  declarations: m[2].trim().replace(/\s+/g, ' '),
}));

describe('the in-app Reduce motion (motion rule 4)', () => {
  it('twins every system reduced-motion rule under :root[data-reduce-motion], with the same declarations', () => {
    const system = media('(prefers-reduced-motion: reduce)').flatMap(rules);
    const all = rules(bare);
    expect(system.length).toBeGreaterThan(0);
    for (const rule of system) {
      for (const s of rule.selectors) {
        const twin = all.find(r => r.selectors.includes(`:root[data-reduce-motion]${s.startsWith('::') ? '' : ' '}${s}`));
        expect(twin, s).toBeDefined();
        // A view transition fades instead (below), so it isn't a copy.
        if (!s.startsWith('::view-transition')) expect(twin?.declarations, s).toBe(rule.declarations);
      }
    }
  });
  it('turns a view transition into a 200 ms fade, not nothing', () => {
    expect(bare).toMatch(/:root\[data-reduce-motion\]::view-transition-old\(root\),\s*:root\[data-reduce-motion\]::view-transition-new\(root\) \{\s*animation: fs-fade-in 0\.2s linear both;/);
  });
});

/** `a` mixed into `b` by `t` in OKLab, as `color-mix(in oklab, a t, b)` mixes them, back as [L, C, h]. */
function mixOklab(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const lab = ([L, C, h]: [number, number, number]) => [L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)];
  const [L1, a1, b1] = lab(a);
  const [L2, a2, b2] = lab(b);
  const L = L1 * t + L2 * (1 - t);
  const A = a1 * t + a2 * (1 - t);
  const B = b1 * t + b2 * (1 - t);
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}

describe('hub washes (journey §8.1, §20.3)', () => {
  for (const [selector, theme] of THEMES) {
    const bg = token(selector, '--grouped-bg');
    const tint = token(selector, '--tint');
    const fg = token(selector, '--foreground', '--foreground');
    for (const c of CATEGORIES.map(x => x.id)) {
      it(`${c} in ${theme}: Back and the large title keep 4.5:1 on the wash at its strongest`, () => {
        const wash = mixOklab(token(selector, `--cat-${c}`), bg, HUB_WASH / 100);
        expect(contrast(tint, wash)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(fg, wash)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe('the spring curve token (motion spec §3.1)', () => {
  it('is the curve springLinear(0) draws, within 0.01 at each step', () => {
    const m = /--spring-smooth:\s*linear\(([^)]+)\)/.exec(css);
    expect(m).not.toBeNull();
    const css24 = m![1].split(',').map(Number);
    const mine = springLinear(0).slice('linear('.length, -1).split(',').map(Number);
    expect(css24).toHaveLength(mine.length);
    css24.forEach((v, i) => expect(Math.abs(v - mine[i])).toBeLessThan(0.01));
  });
});
