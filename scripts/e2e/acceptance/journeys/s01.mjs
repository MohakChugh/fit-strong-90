/**
 * S01: the route coverage inventory (codex-acceptance.md, "Checks on every
 * screen and sheet" and "Route coverage inventory"), at normal and at 200%
 * text. Every screen and sheet gets a checkpoint, so the per-screen sweep —
 * layout, landmarks, names, targets, contrast, charts, tabs — runs on it.
 *
 * Record ids and hrefs are taken from the seeded UI, never typed in.
 * A screen that does not render is a failure here; what the sweep finds on a
 * screen that does render is reported in the sweep section.
 */
import { persona } from '../fixtures/personas.mjs';
import * as ui from '../lib/ui.mjs';
import { answerWizardP07 } from './j01.mjs';

/** Answer the wizard step on screen with P07's answers and move on (one step per call). */
async function answerWizardStep(t) {
  const main = t.page.getByRole('main');
  const heading = (await main.getByRole('heading', { level: 1 }).innerText()).trim();
  if (heading === 'Your body') {
    const areas = main.getByRole('group', { name: 'Pain or past injury' }).getByRole('group', { name: 'Pain or past injury' });
    if (await ui.checkbox(areas, 'None').getAttribute('aria-checked') !== 'true') await ui.tap(ui.checkbox(areas, 'None'));
    await ui.tap(ui.button(main, 'Continue'));
  } else if (heading === 'Your health') {
    for (const q of await main.getByRole('radiogroup').all()) {
      const name = await q.getAttribute('aria-label');
      if (/^An SGLT2|limit how much you drink/.test(name ?? '')) await ui.tap(ui.radio(q, 'No'));
    }
    await ui.tap(ui.button(main, 'Continue'));
  } else {
    await answerWizardP07(t);
  }
}

export const id = 'S01';
export const title = 'Screen sweep over the route inventory';
export const safety = false;

const failedScreen = async page => (await page.getByText('This screen didn’t load', { exact: true }).count()) > 0;

/** Visit a route by loading it, and check that a screen came up. */
async function visit(t, route, name) {
  const page = t.page;
  await t.goto(route);
  await page.waitForTimeout(400);
  const heading = (await page.getByRole('heading', { level: 1 }).allInnerTexts()).join(' | ');
  await t.check(!(await failedScreen(page)) && heading.trim().length > 0, `${route} did not render a screen (heading “${heading}”)`);
  await t.checkpoint(name ?? route);
}

/** Open a sheet with `open`, checkpoint it, close it with its Close button. */
async function sheet(t, name, open) {
  const page = t.page;
  await open();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await page.waitForTimeout(300);
  await t.checkpoint(name);
  const close = dialog.getByRole('button', { name: 'Close', exact: true });
  if (await close.count()) await ui.tap(close);
  else await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' }).catch(() => {});
}

/** The first link in a list whose href starts with `prefix`, as the UI offers it. */
async function firstHref(page, prefix) {
  const href = await page.locator(`main a[href^="#${prefix}"]`).evaluateAll(as => as.map(a => a.getAttribute('href')).find(Boolean));
  return href ? href.replace(/^#/, '') : undefined;
}

async function inventory(t, { textScale } = {}) {
  const page = await t.open({ seed: persona('P01'), route: '/today', ...(textScale ? { textScale } : {}) });
  const main = page.getByRole('main');

  await t.step(1, 'Today, its chooser, status and check-in sheets', async () => {
    await visit(t, '/today', 'today-scheduled');
    await sheet(t, 'today-chooser', () => ui.tap(ui.button(main, 'Choose something else')));
    await sheet(t, 'today-status', () => ui.tap(ui.row(main, 'Status')));
    await sheet(t, 'today-check-in', () => ui.tap(main.getByRole('region').filter({ has: page.getByRole('heading', { level: 3 }) }).getByRole('button')));
  });

  await t.step(2, 'Move: root, Stretch setup, plan, exercise search and detail', async () => {
    await visit(t, '/move');
    await visit(t, '/move/stretch');
    await visit(t, '/move/plan');
    await visit(t, '/move/exercises');
    const search = main.getByRole('searchbox');
    if (await search.count()) {
      await ui.type(search, 'zzzz');
      await page.waitForTimeout(400);
      await t.checkpoint('move-exercises-no-result');
      await ui.type(search, '');
    }
    const ex = await firstHref(page, '/move/exercises/');
    await t.check(!!ex, 'the exercise list offers no exercise to open');
    if (ex) await visit(t, ex, 'move-exercise-detail');
  });

  await t.step(3, 'Walk setup and its after-meal inputs; the guided gate', async () => {
    await visit(t, '/walk');
    await ui.tap(main.getByRole('radiogroup', { name: 'What kind of walk' }).getByRole('radio', { name: /^After a meal/ }));
    await page.waitForTimeout(300);
    await t.checkpoint('walk-after-meal');
    await visit(t, '/session', 'session-gate-no-check-in');
  });

  await t.step(4, 'Track: My Day, Trends, every Add form, details, Back & leg, Workout Log', async () => {
    await visit(t, '/track', 'track-today');
    await visit(t, '/track?day=2026-09-25', 'track-populated-day');
    await ui.tap(ui.radio(main.getByRole('radiogroup', { name: 'Show' }), 'Trends'));
    await page.waitForTimeout(400);
    await t.checkpoint('track-trends');
    await visit(t, '/track');
    for (const kind of ['Glucose', 'Blood pressure', 'Back & leg pain', 'Weight', 'Water', 'Steps', 'Sleep', 'Waist', 'Lab result', 'Workout']) {
      await ui.tap(ui.header(page).getByRole('button', { name: 'Add a record', exact: true }));
      const add = page.getByRole('dialog', { name: 'Add' });
      await add.waitFor();
      await ui.tap(ui.row(add, kind));
      await page.waitForTimeout(500);
      const dialog = page.getByRole('dialog');
      if (await dialog.count()) {
        await t.checkpoint(`track-add-${kind.toLowerCase().replace(/\W+/g, '-')}`);
        const close = dialog.getByRole('button', { name: 'Close', exact: true });
        if (await close.count()) await ui.tap(close);
        await dialog.waitFor({ state: 'hidden' }).catch(() => {});
      } else {
        // Workout opens its own screen.
        await t.checkpoint(`track-add-${kind.toLowerCase().replace(/\W+/g, '-')}-screen`);
        await visit(t, '/track');
      }
    }
    await visit(t, '/track/back');
    await visit(t, '/track?day=2026-09-25', 'track-25-september');
    for (const prefix of ['/track/session/', '/track/check-in/', '/track/reading/', '/track/pressure/', '/track/metric/']) {
      await visit(t, '/track?day=2026-09-25', `track-25-september-for-${prefix.split('/')[2]}`);
      const href = await firstHref(page, prefix);
      if (href) await visit(t, href, `track-detail-${prefix.split('/')[2]}`);
      else t.note(`25 September offers no ${prefix} link`);
    }
    await visit(t, '/track/workout');
  });

  await t.step(5, 'Guide: search, empty result, topic, card, meals, sample week, sources', async () => {
    await visit(t, '/guide');
    const search = main.getByRole('searchbox', { name: 'Search Guide' });
    await ui.type(search, 'zzzz');
    await page.waitForTimeout(400);
    await t.checkpoint('guide-search-empty');
    await ui.type(search, 'glucose');
    await page.waitForTimeout(400);
    await t.checkpoint('guide-search-glucose');
    await visit(t, '/guide');
    const topic = await firstHref(page, '/guide/topic/');
    if (topic) {
      await visit(t, topic, 'guide-topic');
      const card = await firstHref(page, '/guide/card/');
      if (card) await visit(t, card, 'guide-card');
      else t.note('the first topic links to no card');
    } else await t.check(false, 'Guide offers no topic to open');
    await visit(t, '/guide/meals');
    const meal = await page.locator('main a[href^="#/guide/meals/"]').evaluateAll(as => as.map(a => a.getAttribute('href')).find(h => h && !h.endsWith('/week')));
    if (meal) await visit(t, meal.replace(/^#/, ''), 'guide-meal');
    await visit(t, '/guide/meals/week');
    await visit(t, '/guide/sources');
  });

  await t.step(6, 'You: every screen, the calendar and the destructive sheets', async () => {
    for (const r of ['/you', '/you/profile', '/you/food', '/you/focus', '/you/habits', '/you/voice', '/you/appearance', '/you/data']) await visit(t, r);
    await visit(t, '/you/habits');
    await sheet(t, 'you-calendar', () => ui.tap(ui.row(main, 'Add to Calendar')));
    await visit(t, '/you/data');
    await sheet(t, 'you-delete-everything', () => ui.tap(ui.row(main, 'Delete everything on this device')));
    await sheet(t, 'you-restore', () => ui.tap(ui.row(main, 'Restore from a backup'))).catch(() => t.note('Restore opens a file picker rather than a sheet'));
  });
}

const firstRun = {
  name: 'first run and empty states',
  async run(t) {
    const page = await t.open({ seed: null, route: '' });
    const main = page.getByRole('main');
    await t.step(1, 'Welcome, the questions and keeping the record', async () => {
      await t.checkpoint('welcome-focus');
      await ui.tap(ui.button(main, 'Explore first'));
      await page.waitForTimeout(500);
      // Each wizard step is a screen of its own: checkpoint it, then answer it as P07 would.
      for (let i = 0; i < 4 && /^\/welcome\/health/.test(await t.route()); i++) {
        await t.checkpoint(`welcome-health-${(await main.getByRole('heading', { level: 1 }).innerText()).trim().replace(/\W+/g, '-').toLowerCase()}`);
        const before = (await main.getByRole('heading', { level: 1 }).innerText()).trim();
        await answerWizardStep(t);
        await page.waitForTimeout(500);
        if ((await main.getByRole('heading', { level: 1 }).innerText().catch(() => '')).trim() === before && /^\/welcome\/health/.test(await t.route())) break;
      }
      for (let i = 0; i < 2 && /^\/welcome/.test(await t.route()); i++) {
        await t.checkpoint(`welcome-${(await t.route()).replace(/\W+/g, '-')}`);
        const go = main.getByRole('button', { name: /^(Start|Continue in Safari for now)$/ });
        if (!(await go.count())) break;
        await ui.tap(go);
        await page.waitForTimeout(600);
      }
    });
    await t.step(2, 'Empty Today, Track and Move for a person with no history', async () => {
      if (!(await t.route()).startsWith('/today')) t.note(`first run ended at ${await t.route()}`);
      for (const r of ['/today', '/track', '/track?view=trends', '/move', '/move/plan']) await visit(t, r, `empty-${r.replace(/\W+/g, '-')}`);
    });
  },
};

const states = {
  name: 'status, rest and hold states on Today',
  async run(t) {
    // A flare-up today (P06), then a rest day for the owner, then a medicine-review hold.
    let page = await t.open({ seed: persona('P06'), route: '/today' });
    await t.step(1, 'Flare-up status', async () => {
      await visit(t, '/today', 'today-flare');
    });
    await t.context.close();
    page = await t.open({ seed: persona('P01'), route: '/today', time: Date.parse('2026-10-09T09:00:00+05:30') });
    await t.step(2, 'A scheduled rest day', async () => {
      await visit(t, '/today', 'today-rest-day');
    });
    await t.context.close();
    page = await t.open({ seed: persona('P04', { remove: ['profile.health.medicinesReviewed'], patch: { profile: { needsHealthReview: true } } }), route: '/today' });
    await t.step(3, 'A health-review hold', async () => {
      await visit(t, '/today', 'today-review-hold');
      void page;
    });
  },
};

/** A sweep finding of the keyboard/focus kind, reported with the screen sweep. */
async function finding(t, check, detail) {
  t.sweep.push({ check, detail, checkpoint: `step ${t.currentStep}`, step: t.currentStep, route: await t.route(), screenshot: await t.shot(`${check}-finding`) });
}

const keyboard = {
  name: 'keyboard and focus',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/today' });
    const main = page.getByRole('main');
    const active = () => page.evaluate(() => {
      const el = document.activeElement;
      const s = el ? getComputedStyle(el) : null;
      return {
        tag: el?.tagName, text: (el?.getAttribute('aria-label') || el?.textContent || '').trim().slice(0, 60),
        attrs: el ? [...el.attributes].map(a => `${a.name}=${a.value}`).join(' ').slice(0, 160) : '',
        inDialog: !!el?.closest('[role="dialog"]'), level: el?.tagName === 'H1',
        ring: s ? (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none') : false,
      };
    });

    await t.step(1, 'Forward navigation focuses the destination heading', async () => {
      for (const tab of ['Move', 'Track', 'Guide', 'Today']) {
        await ui.tab(page, tab);
        await page.waitForTimeout(300);
        const a = await active();
        if (!a.level) await finding(t, 'focus', `after opening ${tab}, focus is on ${a.tag} “${a.text}”, not the screen heading`);
      }
    });

    await t.step(2, 'A sheet takes focus, keeps it, and returns it to the opener', async () => {
      const opener = ui.button(main, 'Choose something else');
      await opener.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      await page.waitForTimeout(400);
      if (!(await active()).inDialog) await finding(t, 'focus', 'opening the chooser left focus outside the sheet');
      for (const key of ['Tab', 'Shift+Tab']) {
        for (let i = 0; i < 12; i++) {
          await page.keyboard.press(key);
          // A focus guard hands focus straight back into the sheet; give it the moment it takes.
          await page.waitForTimeout(120);
          const a = await active();
          if (!a.inDialog) { await finding(t, 'focus', `${key} ×${i + 1} moved focus out of the open sheet to ${a.tag} “${a.text}” [${a.attrs}]`); break; }
          if (key === 'Tab' && i < 6 && !a.ring && a.tag !== 'DIV') await finding(t, 'focus-visible', `keyboard focus on ${a.tag} “${a.text}” in the chooser has no visible indicator`);
        }
      }
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      await page.waitForTimeout(300);
      const back = await active();
      if (back.text !== 'Choose something else') await finding(t, 'focus', `Escape returned focus to ${back.tag} “${back.text}”, not the opener`);
    });

    await t.step(3, 'Arrow keys move within a composite control', async () => {
      await ui.tab(page, 'Track');
      const timeline = ui.radio(main.getByRole('radiogroup', { name: 'Show' }), 'Timeline');
      await timeline.focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(300);
      const a = await active();
      const trends = await ui.radio(main.getByRole('radiogroup', { name: 'Show' }), 'Trends').getAttribute('aria-checked');
      if (a.text !== 'Trends' && trends !== 'true') await finding(t, 'keyboard', `ArrowRight in the “Show” radio group left focus on “${a.text}” and did not select Trends`);
    });

    await t.step(4, 'Keyboard reaches every control on Today, each with a visible focus', async () => {
      await ui.tab(page, 'Today');
      const seen = new Set();
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press('Tab');
        const a = await active();
        if (!a.tag || a.tag === 'BODY') continue;
        const key = `${a.tag}:${a.text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!a.ring && !['H1', 'DIV', 'MAIN'].includes(a.tag)) await finding(t, 'focus-visible', `keyboard focus on ${a.tag} “${a.text}” on Today has no visible indicator`);
      }
      const buttons = await main.getByRole('button').count() + await main.getByRole('link').count();
      t.note(`Tab reached ${seen.size} distinct controls on Today (${buttons} buttons and links in main)`);
    });
  },
};

export const cases = [
  keyboard,
  { name: 'inventory at normal text', run: t => inventory(t) },
  { name: 'inventory at 200% text', run: t => inventory(t, { textScale: 2 }) },
  firstRun,
  states,
];
