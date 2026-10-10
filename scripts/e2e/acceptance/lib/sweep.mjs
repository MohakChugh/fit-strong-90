/**
 * "Checks on every screen and sheet" (codex-acceptance.md): applied at every
 * checkpoint. Layout, landmarks and heading, control names and roles, target
 * size, input size, contrast measured from the rendered colours, finite chart
 * geometry, the tab bar, and leaked placeholder text.
 *
 * Contrast resolves each computed colour through a 1×1 canvas, so oklch(),
 * color-mix() and alpha come out as the sRGB the screen actually shows, and
 * composites translucent backgrounds up the ancestor chain.
 */

/** Runs in the page. Returns raw findings; the caller decides what they mean. */
export function sweepInPage() {
  const issues = [];
  const add = (check, detail, el) => {
    let where = '';
    if (el) {
      const name = (el.getAttribute?.('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      where = `${el.tagName?.toLowerCase() ?? ''}${el.getAttribute?.('role') ? `[role=${el.getAttribute('role')}]` : ''} "${name}"`;
    }
    issues.push({ check, detail, where });
  };

  const doc = document.documentElement;
  const dialog = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].find(d => d.getBoundingClientRect().height > 0);

  // ---- Horizontal layout --------------------------------------------------
  if (doc.scrollWidth > doc.clientWidth + 1) add('overflow', `scrollWidth ${doc.scrollWidth} > clientWidth ${doc.clientWidth}`);

  const hiddenFromAT = el => !!el.closest('[aria-hidden="true"],[inert]');
  const visible = el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    }
    return true;
  };
  const srOnly = el => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return (r.width <= 1 && r.height <= 1) || s.clip === 'rect(0px, 0px, 0px, 0px)' || s.clipPath === 'inset(50%)';
  };

  // ---- Landmarks and heading ---------------------------------------------
  // Under an open sheet the background is meant to be inert, landmark included; that is checked below.
  const mains = [...document.querySelectorAll('main,[role="main"]')].filter(m => !hiddenFromAT(m));
  if (!dialog && mains.length !== 1) add('landmark', `${mains.length} main landmarks`);
  if (!dialog) {
    const h1s = [...document.querySelectorAll('h1')].filter(h => !hiddenFromAT(h) && getComputedStyle(h).display !== 'none' && getComputedStyle(h).visibility !== 'hidden');
    if (h1s.length !== 1) add('heading', `${h1s.length} exposed level-1 headings: ${h1s.map(h => JSON.stringify(h.textContent.trim())).join(', ')}`);
  }

  // ---- Background inert under a sheet -------------------------------------
  if (dialog) {
    const outside = [...document.querySelectorAll('nav[aria-label="Main"] a, main button, main a[href]')]
      .filter(el => !dialog.contains(el) && visible(el) && !hiddenFromAT(el));
    if (outside.length) add('inert', `${outside.length} controls outside the open sheet are still exposed`, outside[0]);
  }

  // ---- Controls -----------------------------------------------------------
  const SEL = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="slider"], [role="menuitem"], [role="option"]';
  const scope = dialog ?? document;
  for (const el of scope.querySelectorAll(SEL)) {
    if (hiddenFromAT(el) && !(dialog && dialog.contains(el) && !el.closest('[aria-hidden="true"]'))) continue;
    if (!visible(el) || srOnly(el)) continue;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
    const r = el.getBoundingClientRect();
    // Inline links inside running text are exempt from the target size (WCAG 2.5.8 inline exception).
    const inlineText = el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.closest('p,li');
    if (!inlineText && (r.width < 43.5 || r.height < 43.5)) add('target', `${Math.round(r.width)}×${Math.round(r.height)} px`, el);
    if (el.matches('input[inputmode="decimal"], input[inputmode="numeric"], input[type="number"], input[type="text"], input[type="time"], input[type="date"], textarea, select')) {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 16) add('input-size', `font-size ${fs}px`, el);
    }
    if (el.matches('input[type="number"]') || (el.matches('input[type="text"]') && /reading|number|steps|weight|waist|glucose|ml|minutes|reps|kg|value/i.test(el.getAttribute('aria-label') ?? ''))) {
      const mode = el.getAttribute('inputmode');
      if (!el.matches('input[type="number"]') && mode !== 'decimal' && mode !== 'numeric') add('input-mode', `numeric field without inputmode (${mode})`, el);
    }
  }

  // ---- Tabs ---------------------------------------------------------------
  const nav = document.querySelector('nav[aria-label="Main"]');
  if (nav && visible(nav) && !hiddenFromAT(nav)) {
    const tabs = [...nav.querySelectorAll('a')].map(a => a.textContent.trim());
    if (tabs.join('|') !== 'Today|Move|Track|Guide') add('tabs', `tab bar shows ${JSON.stringify(tabs)}`);
    // You is not a tab, so nothing is current under it; everywhere else one tab must be.
    if (!location.hash.startsWith('#/you') && ![...nav.querySelectorAll('a')].some(a => a.getAttribute('aria-current') === 'page')) add('tabs', 'no tab marked as the current destination');
  }

  // ---- Leaked placeholders and non-finite numbers --------------------------
  const text = (dialog ?? document.body).innerText;
  for (const bad of ['NaN', 'Infinity', 'undefined', '[object Object]', 'null min', 'null kg']) {
    const re = new RegExp(`(^|[^A-Za-z])${bad.replace(/[[\]]/g, '\\$&')}([^A-Za-z]|$)`);
    if (re.test(text)) add('placeholder', `visible text contains "${bad}"`);
  }
  for (const el of document.querySelectorAll('svg *')) {
    for (const attr of ['x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'width', 'height', 'd', 'points', 'transform', 'stroke-dasharray', 'stroke-dashoffset']) {
      const v = el.getAttribute(attr);
      if (v && /NaN|Infinity|undefined/.test(v)) { add('svg', `${el.tagName} ${attr}="${v.slice(0, 40)}"`); break; }
    }
  }

  // ---- Contrast -----------------------------------------------------------
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  const rgba = css => {
    if (cache.has(css)) return cache.get(css);
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const out = a === 0 ? [0, 0, 0, 0] : [r / (a / 255), g / (a / 255), b / (a / 255), a / 255].map((x, i) => (i < 3 ? Math.min(255, x) : x));
    cache.set(css, out);
    return out;
  };
  const over = (top, under) => {
    const a = top[3] + under[3] * (1 - top[3]);
    if (a === 0) return [0, 0, 0, 0];
    return [0, 1, 2].map(i => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a).concat(a);
  };
  const lum = c => {
    const [r, g, b] = c.slice(0, 3).map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const pageBg = (() => {
    const b = rgba(getComputedStyle(document.body).backgroundColor);
    const h = rgba(getComputedStyle(doc).backgroundColor);
    const base = matchMedia('(prefers-color-scheme: dark)').matches || doc.classList.contains('dark') ? [0, 0, 0, 1] : [255, 255, 255, 1];
    return over(b, over(h, base));
  })();
  const backgroundOf = el => {
    const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== 'none' && !/^url/.test(s.backgroundImage)) return null;
      const c = rgba(s.backgroundColor);
      if (c[3] > 0) { layers.push(c); if (c[3] >= 0.999) break; }
    }
    let bg = pageBg;
    for (const c of layers.reverse()) bg = over(c, bg);
    return bg;
  };
  const opacityOf = el => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; };
  const seen = new Set();
  const walker = document.createTreeWalker(dialog ?? document.body, NodeFilter.SHOW_TEXT);
  let checked = 0;
  for (let node = walker.nextNode(); node && checked < 600; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    const el = node.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    if (!visible(el) || srOnly(el)) continue;
    if (el.closest('[disabled],[aria-disabled="true"],svg,canvas')) continue;
    if (dialog && !dialog.contains(el)) continue;
    checked += 1;
    const s = getComputedStyle(el);
    const fg = rgba(s.color);
    const bg = backgroundOf(el);
    if (!bg) continue;
    const alpha = fg[3] * opacityOf(el);
    const shown = over([fg[0], fg[1], fg[2], alpha], bg);
    const size = parseFloat(s.fontSize);
    const bold = Number(s.fontWeight) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const got = ratio(shown, bg);
    if (got + 0.005 < need) add('contrast', `${got.toFixed(2)}:1 < ${need}:1 (${s.color} on ${bg.slice(0, 3).map(Math.round).join(',')}, ${size}px)`, el);
  }

  return { issues, url: location.hash, dialog: !!dialog, title: document.title };
}

/** Accessible names and roles from Chromium's own accessibility tree. */
export function unnamedControls(snapshot) {
  const roles = /^\s*- (button|link|textbox|checkbox|radio|switch|combobox|slider|spinbutton|tab|menuitem|option|searchbox)(\s*$|:|\s+\[)/;
  return snapshot.split('\n').filter(line => roles.test(line)).map(l => l.trim());
}
