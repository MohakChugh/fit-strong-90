/**
 * Food journeys' helpers (V-J03, V-J28 to V-J31): meals seeded through Me →
 * Data's own Merge, the Food tile and hub, and the "Log a meal" sheet. Names
 * are the food table's (src/data/food/foods.json) and the sheet's own words
 * (src/food/copy.ts).
 */
import * as data from './data.mjs';
import * as ui from './ui.mjs';

/** 13:20 on Thursday 8 October: lunchtime by the sheet's clock. */
export const LUNCHTIME = Date.parse('2026-10-08T13:20:00+05:30');

/** An item from the food table, as a meal keeps it (src/food/types.ts `FoodItem`). */
export const item = (foodId, name, unit, count, gramsPerPortion) => ({ kind: 'food', foodId, rev: 1, name, unit, count, gramsPerPortion });
export const ROTI = item('roti', 'Roti (whole-wheat)', 'piece', 2, 40);
export const DAL = item('toor-dal', 'Toor dal', 'katori', 1, 150);
export const DAHI = item('dahi', 'Dahi (curd)', 'katori', 1, 100);

/** A logged meal (src/food/types.ts `MealRecord`). */
export const meal = (id, at, slot, items, level = 'meals') => ({ id, at, day: at.slice(0, 10), meal: slot, items, level, loggedAt: at, edits: [] });

/** Yesterday's lunch, 13:10: roti, dal and dahi. */
export const USUAL_LUNCH = meal('meal-seed-lunch', '2026-10-07T13:10:00.000+05:30', 'lunch', [ROTI, DAL, DAHI]);

/** Meals put on this phone the way a person would: a backup file, through Me → Data → Restore → Merge. */
export async function seedMeals(t, meals) {
  const file = data.writeFixture(t, 'meals.json', data.transferDoc({ schemaVersion: 6, stores: ['meals'], records: { meals } }));
  const sheet = await data.chooseRestore(t, file);
  await data.merge(t, sheet);
  await ui.tap(ui.button(sheet, 'Done'));
  await sheet.waitFor({ state: 'hidden' });
}

const esc = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A list group by its own header, never a section around it. Headers are drawn in capitals, so the match ignores case. */
export const group = (scope, header) => scope.locator('section > h2').filter({ hasText: new RegExp(`^\\s*${esc(header)}\\s*$`, 'i') }).locator('xpath=..');

/** One of the hub's regions, named by its visible heading ("Right now", "Today", "This week"). */
export const region = (page, title) => page.getByRole('region', { name: title, exact: true });

/** Home's Food tile. */
export const tile = page => page.locator('[data-tile="food"]').getByRole('link');

/** Food, from Home's tile, the way a person gets there. Returns the hub's main region. */
export async function openHub(t, tap = ui.tap) {
  const page = t.page;
  await ui.tab(page, 'Home');
  await tap(tile(page));
  await page.getByRole('heading', { level: 1, name: 'Food', exact: true }).waitFor();
  // The hub's skeleton has its title too: wait for its content (`ui.LOADING`), as hub.openHub does.
  await ui.loaded(page);
  return page.getByRole('main');
}

/** The open "Log a meal" sheet, or "Edit lunch" and the like. */
export const logSheet = page => page.getByRole('dialog', { name: /^(Log a meal|Edit (breakfast|lunch|snack|dinner))$/ });

/** The tray's item names, in order. */
export const trayNames = sheet => sheet.locator('[data-item]').evaluateAll(els => els.map(e => e.getAttribute('data-item')));

/** One tray item, by its name. */
export const trayItem = (sheet, name) => sheet.locator(`[data-item="${name}"]`);

/** A food row's "+": its accessible name is "Add <food>". */
export const addButton = (sheet, name) => sheet.getByRole('button', { name: `Add ${name}`, exact: true });

/** A toast's exact words. */
export const toast = (page, text) => page.locator('#toasts').getByText(text, { exact: true });

/** The meals stored for a day, in a database snapshot. */
export const mealsOn = (snap, day) => (snap.meals ?? []).filter(m => m.day === day);

/** Words that must never show while counts-free (B-11). */
export const FIGURES = /\bkcal\b|\bg carbs\b|Estimated/;
