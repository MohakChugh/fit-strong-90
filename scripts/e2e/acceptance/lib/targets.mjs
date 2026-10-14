/**
 * J§20.4 rule 1, measured (board D122): "everything tappable is at least
 * 48×48 px and never under 44, with at least 12 px between bezelled
 * controls. Primary buttons and other main targets are at least 60 px tall."
 * And no two controls under one finger (Codex P8R-16), words that fit their
 * control, and each screen's landmark and heading. `collect` and `structure`
 * read the screen in the page; `problems` and `structureProblems` judge it,
 * anywhere.
 */

export const TARGET_RULES = { min: 48, main: 60, gap: 12 };

/** What the rule doesn't ask of, and nothing else (D122). */
export const EXCEPTIONS = [
  'A link inside running text (an inline link in a paragraph or a list item) is the size of its text, as WCAG 2.5.8 allows.',
  'The segments of one segmented control (radios or tabs inside one radiogroup or tablist that has an edge of its own) are one control: the 12 px are between it and its neighbours, not between its segments. Each segment is still 48 × 48.',
  'A control its owner marks as drawn inside it (`data-embedded`), such as a search field’s Clear button, is spaced by the control it sits in.',
  'A control that can’t be tapped now (disabled, hidden, or behind an open sheet) is measured when it can be.',
  'A bar fixed or stuck in place (the tab bar, a screen’s or a sheet’s bar, a toast) and what scrolls under it, the page or a sheet’s body, aren’t spaced or overlapped against each other: what scrolls under a bar scrolls clear of it, as the shell’s padding lets it.',
  'A list’s rows share their group’s card: the hairline between two rows is the list’s, not an edge either row has, so rows aren’t spaced 12 px apart.',
];

/**
 * In the page: every control a finger can reach on the screen as it stands,
 * the open sheet's or menu's while one is open, with what the rule asks
 * about each. Self-contained, for `page.evaluate`.
 */
export function collect() {
  const SEL = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="slider"], [role="menuitem"], [role="option"]';
  const layer = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"],[role="menu"]')].find(d => d.getBoundingClientRect().height > 0);
  const alpha = c => {
    if (!c || c === 'transparent') return 0;
    const slash = /\/\s*([\d.]+)(%?)\s*\)\s*$/.exec(c);
    if (slash) return Number(slash[1]) / (slash[2] ? 100 : 1);
    const rgba = /^rgba\((?:[^,]+,){3}\s*([\d.]+)\s*\)$/.exec(c);
    return rgba ? Number(rgba[1]) : 1;
  };
  // An edge all round: a fill, a shadow, or a border on every side. A list's rows share their group's card,
  // and the hairline between two rows is the list's, not an edge either row has of its own.
  const edged = s => alpha(s.backgroundColor) > 0.05
    || ['Top', 'Right', 'Bottom', 'Left'].every(side => parseFloat(s[`border${side}Width`]) >= 1 && alpha(s[`border${side}Color`]) > 0.05)
    || (!!s.boxShadow && s.boxShadow !== 'none');
  // The layer a control is drawn in: the nearest box fixed or stuck in place (the tab bar, a screen's or a
  // sheet's bar, a toast), or that scrolls on its own (a sheet's body), or the page that scrolls under them.
  // Only controls in one layer can be under one finger together: what scrolls under a bar scrolls clear of
  // it, as the shell's padding lets it.
  const layers = [];
  const layerOf = el => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const st = getComputedStyle(n);
      const scrolls = (st.overflowY === 'auto' || st.overflowY === 'scroll') && n.scrollHeight > n.clientHeight + 1;
      if (st.position === 'fixed' || st.position === 'sticky' || scrolls) {
        if (!layers.includes(n)) layers.push(n);
        return layers.indexOf(n);
      }
    }
    return -1;
  };
  // An edge of its own, or of the layer that fills it: a tile draws its card on an inner layer.
  const bezelled = (el, r) => edged(getComputedStyle(el)) || [...el.querySelectorAll('*')].some(d => {
    const b = d.getBoundingClientRect();
    return b.width * b.height >= 0.9 * r.width * r.height && edged(getComputedStyle(d));
  });
  const fill = css => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = css;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return resolved;
  };
  const fills = new Set([fill('var(--tint)'), fill('var(--primary)')]);
  const shown = el => {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    }
    const s = getComputedStyle(el);
    return s.clip !== 'rect(0px, 0px, 0px, 0px)' && s.clipPath !== 'inset(50%)';
  };
  // Words wider than their own control: they spill out of it, or are cut off.
  // Only words: a switch drawn with no words of its own (its thumb's ring past its track) has none to fit.
  const clipped = el => !el.matches('input, select, textarea') && (el.textContent ?? '').trim() !== '' && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1;
  // Cut off side to side, by the screen's edge or a box that hides what overflows it: a sheet's Close, or a
  // unit shown as "mg/" (Plan 6's report). What a box scrolls to sideways can be reached, so it isn't cut.
  const cutOff = (el, r) => {
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 1) return false;
      if (s.overflowX !== 'hidden' && s.overflowX !== 'clip') continue;
      const b = n.getBoundingClientRect();
      if (r.left < b.left - 0.5 || r.right > b.right + 0.5) return true;
    }
    return r.left < -0.5 || r.right > window.innerWidth + 0.5;
  };
  const tracks = [];
  const seen = new Set();
  return [...(layer ?? document).querySelectorAll(SEL)].flatMap(el => {
    if (el.closest('[aria-hidden="true"],[inert]') || !shown(el)) return [];
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return [];
    // A checkbox or a radio is pressed by its label: that is its target.
    const box = el.matches('input[type="checkbox"], input[type="radio"]') ? (el.labels?.[0] ?? el.closest('label') ?? el) : el;
    if (seen.has(box)) return [];
    seen.add(box);
    const s = getComputedStyle(el);
    const r = box.getBoundingClientRect();
    const role = el.getAttribute('role') ?? '';
    const choice = ['radio', 'checkbox', 'switch', 'tab', 'option'].includes(role) || el.matches('input[type="checkbox"], input[type="radio"]')
      || el.hasAttribute('aria-pressed') || el.hasAttribute('aria-checked') || el.hasAttribute('aria-selected');
    const group = el.closest('[role="radiogroup"], [role="tablist"]');
    let track = null;
    if (group && edged(getComputedStyle(group))) {
      if (!tracks.includes(group)) tracks.push(group);
      track = tracks.indexOf(group);
    }
    const name = (el.getAttribute('aria-label') || box.textContent || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 50);
    // The spec's "other main targets", each marked where it is drawn, and a toast's action (UNDO_STYLE).
    const named = el.closest('[data-main]') !== null || el.matches('[data-sonner-toast] [data-button]');
    return [{
      what: `${el.tagName.toLowerCase()}${role ? `[${role}]` : ''} “${name}”`,
      x: r.left, y: r.top, w: r.width, h: r.height,
      inline: el.tagName === 'A' && s.display === 'inline' && !!el.closest('p, li'),
      bezel: bezelled(box, r),
      main: !choice && (fills.has(s.backgroundColor) || named),
      track,
      embedded: el.hasAttribute('data-embedded'),
      clipped: clipped(box),
      cut: cutOff(box, r),
      layer: layerOf(box),
    }];
  });
}

/**
 * In the page: the screen's main landmark and level-1 heading, whether an open sheet or menu has a heading of
 * its own, what is wider than the screen (the page, or an open sheet), and each toast standing: its height
 * against the screen's, and its words against the lines they take.
 */
export function structure() {
  const open = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"],[role="menu"]')].filter(d => d.getBoundingClientRect().height > 0);
  const named = d => `${d.getAttribute('role')} “${(d.getAttribute('aria-label') || d.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30)}”`;
  const unheaded = open.filter(d => !d.querySelector('h1, h2, h3, [role="heading"]')).map(named);
  const overflow = [];
  const wide = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth;
  if (wide > 1) overflow.push(`the page is ${Math.round(wide)} px wider than the screen`);
  // On a phone the page is drawn wider instead, and zoomed out to fit: its layout is wider than the screen.
  else if (window.innerWidth > screen.width + 1) overflow.push(`the page is drawn ${window.innerWidth} px wide on a ${screen.width} px screen, zoomed out to fit`);
  for (const d of open) {
    const b = d.getBoundingClientRect();
    if (b.left < -1 || b.right > window.innerWidth + 1) overflow.push(`the open ${named(d)} reaches past the screen’s side by ${Math.round(Math.max(-b.left, b.right - window.innerWidth))} px`);
    else if (d.scrollWidth > d.clientWidth + 1) overflow.push(`the open ${named(d)} holds content ${d.scrollWidth - d.clientWidth} px wider than itself`);
  }
  // A toast waiting its turn (`data-visible="false"`) isn't on the screen.
  const toasts = [...document.querySelectorAll('[data-sonner-toast]')]
    .filter(t => t.getAttribute('data-removed') !== 'true' && t.getAttribute('data-visible') !== 'false' && t.getBoundingClientRect().height > 0)
    .map(t => {
      const title = t.querySelector('[data-title]') ?? t;
      const s = getComputedStyle(title);
      const line = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.2;
      const text = (title.textContent ?? '').trim().replace(/\s+/g, ' ');
      return { text: text.slice(0, 40), h: t.getBoundingClientRect().height, vh: window.innerHeight, lines: Math.round(title.getBoundingClientRect().height / line), words: text ? text.split(' ').length : 0 };
    });
  // A heading that breaks a word across lines: a long word at a large text size, cut mid-word (Plan 6's report,
  // "emergen-cy"). A word may break after its own hyphen ("Check-" / "in").
  const broken = [];
  for (const h of document.querySelectorAll('h1, h2, h3, [data-sonner-toast] [data-title]')) {
    const box = h.getBoundingClientRect();
    if (box.width <= 1 || box.height <= 1) continue;
    const walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
    let found;
    for (let node = walker.nextNode(); node && !found; node = walker.nextNode()) {
      for (const m of node.textContent.matchAll(/[^\s-]+-?/g)) {
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const tops = new Set([...range.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top)));
        if (tops.size > 1) { found = m[0]; break; }
      }
    }
    if (found) broken.push(`the heading “${(h.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30)}” breaks “${found}” across lines`);
  }
  return { dialog: open.length > 0, mains: document.querySelectorAll('main, [role="main"]').length, h1s: document.querySelectorAll('h1').length, unheaded, overflow, toasts, broken };
}

/** The most of the screen's height one toast may take: a standing Undo is never most of the screen. */
const TOAST_SHARE = 0.4;

const px = n => Math.round(n);
const inside =(a, b) => a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.w <= b.x + b.w + 0.5 && a.y + a.h <= b.y + b.h + 0.5;

/** Where `controls` break the rule, in words; nothing when they keep it. */
export function problems(controls, rules = TARGET_RULES) {
  const out = [];
  for (const c of controls) {
    if (c.inline) continue;
    if (c.w < rules.min - 0.5 || c.h < rules.min - 0.5) out.push(`${c.what} is ${px(c.w)} × ${px(c.h)} px, under ${rules.min} × ${rules.min}`);
    else if (c.main && c.h < rules.main - 0.5) out.push(`${c.what} is a main target ${px(c.h)} px tall, under ${rules.main}`);
    if (c.clipped) out.push(`${c.what}: its words don’t fit it`);
    if (c.cut) out.push(`${c.what} is cut off: part of it can’t be seen`);
  }
  const reached = controls.filter(c => !c.inline);
  for (let i = 0; i < reached.length; i++) {
    for (let j = i + 1; j < reached.length; j++) {
      const a = reached[i];
      const b = reached[j];
      // A bar fixed in place and the page scrolling under it are never under one finger for long.
      if ((a.layer ?? -1) !== (b.layer ?? -1)) continue;
      const apartX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
      const apartY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
      if (apartX < -0.5 && apartY < -0.5) {
        // Under one finger, unless the inner one is marked as drawn inside the other (P8R-16).
        if ((b.embedded && inside(b, a)) || (a.embedded && inside(a, b))) continue;
        out.push(`${a.what} and ${b.what} overlap by ${px(-apartX)} × ${px(-apartY)} px`);
        continue;
      }
      if (!a.bezel || !b.bezel || (a.track !== null && a.track === b.track)) continue;
      if (apartY < 0 && apartX >= 0 && apartX < rules.gap - 0.5) out.push(`${a.what} and ${b.what} are ${px(apartX)} px apart side by side, under ${rules.gap}`);
      if (apartX < 0 && apartY >= 0 && apartY < rules.gap - 0.5) out.push(`${a.what} and ${b.what} are ${px(apartY)} px apart, one above the other, under ${rules.gap}`);
    }
  }
  return out;
}

/** Where the screen's structure falls short, in words. */
export function structureProblems(s) {
  const out = [];
  if (s.mains !== 1) out.push(s.mains === 0 ? 'the screen has no main landmark' : `the screen has ${s.mains} main landmarks`);
  if (s.h1s < 1) out.push('the screen has no level-1 heading');
  for (const u of s.unheaded) out.push(`the open ${u} has no heading of its own`);
  for (const o of s.overflow ?? []) out.push(o);
  for (const b of s.broken ?? []) out.push(b);
  for (const t of s.toasts ?? []) {
    const share = t.h / t.vh;
    if (share > TOAST_SHARE) out.push(`a toast “${t.text}” takes ${Math.round(share * 100)}% of the screen’s height, over ${TOAST_SHARE * 100}%`);
    if (t.words > 1 && t.lines >= t.words) out.push(`a toast “${t.text}” wraps one word to a line`);
  }
  const toasts = s.toasts ?? [];
  const together = toasts.reduce((sum, t) => sum + t.h, 0) / (toasts[0]?.vh ?? 1);
  if (toasts.length > 1 && together > 0.5) out.push(`the ${toasts.length} toasts standing take ${Math.round(together * 100)}% of the screen’s height, more than half`);
  return out;
}
