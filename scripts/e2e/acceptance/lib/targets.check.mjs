#!/usr/bin/env node
/**
 * The target rule's own check (J§20.4 rule 1, board D122): each rule fails
 * when it should, and each exception excuses only what it names.
 *
 *   node scripts/e2e/acceptance/lib/targets.check.mjs
 */
import assert from 'node:assert/strict';
import { problems, structureProblems } from './targets.mjs';

const c = over => ({ what: 'button “x”', x: 0, y: 0, w: 120, h: 48, inline: false, bezel: false, main: false, track: null, embedded: false, clipped: false, cut: false, ...over });

assert.deepEqual(problems([c({})]), []);
assert.match(problems([c({ h: 44 })])[0], /120 × 44 px, under 48 × 48/);
assert.match(problems([c({ w: 44, h: 48 })])[0], /44 × 48 px/);
// An inline link in running text is the text's size (WCAG 2.5.8).
assert.deepEqual(problems([c({ w: 40, h: 22, inline: true })]), []);
assert.match(problems([c({ main: true, h: 56 })])[0], /a main target 56 px tall, under 60/);
assert.deepEqual(problems([c({ main: true, h: 60 })]), []);
// Bezelled neighbours: 8 px apart side by side, 6 px one above the other; 12 is enough.
assert.match(problems([c({ bezel: true }), c({ bezel: true, x: 128 })])[0], /8 px apart side by side, under 12/);
assert.deepEqual(problems([c({ bezel: true }), c({ bezel: true, x: 132 })]), []);
assert.match(problems([c({ bezel: true }), c({ bezel: true, y: 54 })])[0], /6 px apart, one above the other, under 12/);
// Neighbours without an edge of their own aren't spaced.
assert.deepEqual(problems([c({}), c({ x: 124 })]), []);
// The segments of one segmented control are one control; two controls' segments aren't.
assert.deepEqual(problems([c({ bezel: true, track: 0 }), c({ bezel: true, track: 0, x: 124 })]), []);
assert.equal(problems([c({ bezel: true, track: 0 }), c({ bezel: true, track: 1, x: 124 })]).length, 1);
// Two controls under one finger, partly or wholly, are a finding, edged or not (P8R-16).
assert.match(problems([c({ bezel: true, w: 48 }), c({ bezel: true, w: 48, x: 40 })])[0], /overlap by 8 × 48 px/);
assert.match(problems([c({ bezel: true }), c({ bezel: true })])[0], /overlap by 120 × 48 px/);
assert.match(problems([c({}), c({ x: 60 })])[0], /overlap/);
// A control its owner marks as drawn inside it, such as a search field's Clear button, is spaced by that field.
assert.deepEqual(problems([c({ bezel: true, w: 300 }), c({ bezel: true, x: 252, w: 48, embedded: true })]), []);
// Inside, but not marked: a finding.
assert.match(problems([c({ bezel: true, w: 300 }), c({ bezel: true, x: 252, w: 48 })])[0], /overlap/);
// A bar fixed in place (the tab bar, a sheet's own bar) and what scrolls under it aren't under one finger
// together; two controls in the same bar, or both in the page, are.
assert.deepEqual(problems([c({ layer: 0 }), c({ layer: -1, x: 60 })]), []);
assert.match(problems([c({ layer: 0 }), c({ layer: 0, x: 60 })])[0], /overlap/);
assert.match(problems([c({ layer: -1, bezel: true }), c({ layer: -1, bezel: true, x: 124 })])[0], /4 px apart side by side/);
assert.deepEqual(problems([c({ layer: 1, bezel: true }), c({ layer: 2, bezel: true, x: 124 })]), []);
// A control whose words don't fit it.
assert.match(problems([c({ clipped: true })])[0], /its words don’t fit it/);
// A control the screen's edge, or a box around it, cuts off: a sheet's Close, a unit shown as "mg/" (Plan 6's report).
assert.match(problems([c({ cut: true })])[0], /is cut off: part of it can’t be seen/);
assert.deepEqual(problems([c({ cut: false })]), []);
// A screen's landmark and heading, and an open sheet's or menu's own heading.
assert.deepEqual(structureProblems({ dialog: false, mains: 1, h1s: 1, unheaded: [] }), []);
assert.match(structureProblems({ dialog: false, mains: 0, h1s: 1, unheaded: [] })[0], /no main landmark/);
assert.match(structureProblems({ dialog: false, mains: 1, h1s: 0, unheaded: [] })[0], /no level-1 heading/);
assert.match(structureProblems({ dialog: true, mains: 1, h1s: 1, unheaded: ['menu “More”'] })[0], /menu “More” has no heading of its own/);
// Wider than the screen: the page, or an open sheet (Plan 6's report: the safety surface at 200% text).
assert.deepEqual(structureProblems({ dialog: false, mains: 1, h1s: 1, unheaded: [], overflow: [] }), []);
assert.match(structureProblems({ dialog: false, mains: 1, h1s: 1, unheaded: [], overflow: ['the page is 24 px wider than the screen'] })[0], /the page is 24 px wider than the screen/);
// A heading that breaks a word across lines (Plan 6's report, "emergen-cy").
assert.match(structureProblems({ dialog: false, mains: 1, h1s: 1, unheaded: [], broken: ['the heading “No exercise today” breaks “exercise” across lines'] })[0], /breaks “exercise” across lines/);
assert.deepEqual(structureProblems({ dialog: false, mains: 1, h1s: 1, unheaded: [], broken: [] }), []);
// A standing toast: never most of the screen, never one word to a line (the coordinator's 200% finding).
const toast = over => ({ text: 'Water 300 ml deleted', h: 90, vh: 568, lines: 1, words: 4, ...over });
assert.deepEqual(structureProblems({ dialog: false, mains: 1, h1s: 1, unheaded: [], toasts: [toast({})] }), []);
assert.match(structureProblems({ dialog: false, mains: 1, h1s: 1, unheaded: [], toasts: [toast({ h: 290 })] })[0], /toast “Water 300 ml deleted” takes 51% of the screen’s height, over 40%/);
// One toast is never a stack: it is said once.
assert.equal(structureProblems({ dialog: false, mains: 1, h1s: 1, unheaded: [], toasts: [toast({ h: 290 })] }).length, 1);
assert.match(structureProblems({ dialog: false, mains: 1, h1s: 1, unheaded: [], toasts: [toast({ lines: 4 })] })[0], /toast “Water 300 ml deleted” wraps one word to a line/);
assert.deepEqual(structureProblems({ dialog: false, mains: 1, h1s: 1, unheaded: [], toasts: [toast({ lines: 2 })] }), []);
// Two standing toasts never cover most of the screen together; two smaller ones are fine.
assert.match(structureProblems({ dialog: false, mains: 1, h1s: 1, unheaded: [], toasts: [toast({ h: 180 }), toast({ h: 180 })] })[0], /the 2 toasts standing take 63% of the screen’s height, more than half/);
assert.deepEqual(structureProblems({ dialog: false, mains: 1, h1s: 1, unheaded: [], toasts: [toast({}), toast({})] }), []);
// A one-word toast on one line is fine.
assert.deepEqual(structureProblems({ dialog: false, mains: 1, h1s: 1, unheaded: [], toasts: [toast({ text: 'Saved', words: 1, lines: 1 })] }), []);
console.log('targets: every rule fails when it should, and every exception excuses only its own.');
