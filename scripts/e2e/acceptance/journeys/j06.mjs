/**
 * J06, P01: what to track and what a result means
 * (codex-acceptance.md; basis C11, D9, D22, D27, D32, D33).
 *
 * Cases: the main P01 journey (steps 1–7, one context, as a sequence); the
 * monitoring situations step 1 says must be distinguished (basal insulin,
 * sulfonylurea, multiple daily injections); the HbA1c cadence rows; and the
 * interpretation boundary rows, each value in its own fresh context, entered
 * through Track → Add.
 */
import { docs } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as ui from '../lib/ui.mjs';
import * as g from '../lib/guide.mjs';

export const id = 'J06';
export const title = 'What to track and what a result means';
export const safety = false;

const NOT_ADVICE = 'General information, not medical advice.';

// ---------------------------------------------------------------- Guide helpers

/** Type a query into Guide search and return the result titles and the page text. */
async function searchGuide(t, query) {
  const page = t.page;
  if (!(await t.route()).startsWith('/guide')) await g.tabTo(t, 'Guide');
  const main = page.getByRole('main');
  if (await t.route() !== '/guide' && !(await t.route()).startsWith('/guide?')) await g.tabTo(t, 'Guide');
  await ui.type(main.getByRole('searchbox', { name: 'Search Guide' }), query);
  await page.waitForTimeout(400);
  const links = await main.getByRole('link').all();
  const results = [];
  for (const l of links) {
    const name = ((await l.getAttribute('aria-label')) ?? (await l.innerText())).replace(/\s+/g, ' ').trim();
    if (!/^You:/.test(name)) results.push(name);
  }
  return { results, text: (await main.innerText()).replace(/\s+/g, ' ') };
}

/** Open a Guide topic from the Guide root by its exact title. */
async function openTopic(t, topic) {
  const page = t.page;
  await g.tabTo(t, 'Guide');
  const main = page.getByRole('main');
  const search = main.getByRole('searchbox', { name: 'Search Guide' });
  if (await search.inputValue()) await ui.tap(ui.button(main, 'Clear search'));
  await ui.tap(ui.row(main, topic, 'link'));
  await page.getByRole('heading', { level: 1, name: topic, exact: true }).waitFor();
}

/** Open a card from the topic screen by its exact title; returns its text and source links. */
async function openCard(t, cardTitle) {
  const page = t.page;
  const main = page.getByRole('main');
  await ui.tap(ui.row(main, cardTitle, 'link'));
  await page.getByRole('heading', { level: 1, name: cardTitle, exact: true }).waitFor();
  await page.waitForTimeout(200);
  return cardContent(page);
}

async function cardContent(page) {
  const main = page.getByRole('main');
  const text = (await main.innerText()).replace(/\s+/g, ' ');
  const sources = [];
  const section = main.locator('h2', { hasText: /^Sources$/ });
  if (await section.count()) {
    for (const a of await main.locator('a[target="_blank"], a[href^="http"]').all()) {
      sources.push({ name: ((await a.getAttribute('aria-label')) ?? (await a.innerText())).replace(/\s+/g, ' ').trim(), href: await a.getAttribute('href') });
    }
  }
  return { text, sources };
}

/** Back out of a pushed Guide screen with its own Back button. */
async function back(t) {
  const page = t.page;
  await ui.tap(ui.header(page).getByRole('button', { name: /^Back/ }));
  await page.waitForTimeout(400);
}

/** No source link carries the person's health data in its address. */
function cleanHrefs(sources) {
  return sources.filter(s => s.href && /[?&](q|glucose|bp|diabetes|metformin|age|weight|profile|user)=|type2|metformin/i.test(s.href.split('#')[0].split('?')[1] ?? ''));
}

// ---------------------------------------------------------------- the main journey

async function main(t) {
  const page = await t.open({ seed: persona('P01'), route: '/today' });
  const mainEl = page.getByRole('main');
  const labsBefore = { count: 0 };

  await t.step(1, 'Guide search for glucose/diabetes monitoring; inspect cadence and Sources', async () => {
    const queries = ['glucose monitoring', 'diabetes monitoring', 'how often check glucose', 'blood sugar test', 'glucose'];
    const found = [];
    let card;
    for (const q of queries) {
      const r = await searchGuide(t, q);
      // An answer about checking glucose: it names glucose or sugar and checking, testing or monitoring.
      const hits = r.results.filter(name => /glucose|blood sugar|sugar/i.test(name) && /monitor|check|test|how often|reading/i.test(name));
      found.push({ q, results: r.results.length, hits, titles: r.results.map(n => n.split(/ (?=[A-Z][a-z]+ [a-z])/)[0].slice(0, 40)) });
      if (hits.length && !card) {
        await ui.tap(mainEl.getByRole('link', { name: hits[0], exact: true }));
        await page.waitForTimeout(400);
        card = await cardContent(page);
        await t.checkpoint('monitoring-card');
        await back(t);
      }
    }
    await t.checkpoint('guide-search-glucose');
    t.note(`Guide results: ${found.map(f => `“${f.q}”: ${f.titles.join(' / ')}`).join('; ')}`);
    await t.check(!!card,
      `Guide has no glucose-monitoring cadence: searches ${found.map(f => `“${f.q}” → ${f.results} result(s)${f.results ? ` (${f.titles.slice(0, 4).join('; ')}${f.results > 4 ? '; …' : ''})` : ''}`).join(', ')} return nothing about how often to check glucose`);
    if (card) {
      // Whatever it is, it must not give a confirmed metformin-only person a daily fasting check.
      await t.check(!/(every|each) (day|morning)[^.]*fasting|daily fasting (check|test|reading)/i.test(card.text), 'the monitoring guidance gives a metformin-only person a daily fasting check');
      await t.check(/basal/i.test(card.text) && /sulfonylurea|gliclazide|glimepiride/i.test(card.text) && /several injections|multiple (daily )?injections|mealtime insulin/i.test(card.text),
        'the monitoring guidance does not distinguish basal insulin, sulfonylurea and multiple-injection situations');
      await t.check(card.sources.every(s => /\d{4}|edition|Published|reviewed|updated/i.test(s.name)), 'a monitoring source has no edition');
    }
    // Today must not invent a daily glucose mandate for confirmed metformin-only treatment.
    await g.tabTo(t, 'Today');
    const today = (await mainEl.innerText()).replace(/\s+/g, ' ');
    await t.check(!/check (your )?(blood )?(glucose|sugar) (every|each) (day|morning)|daily (fasting )?glucose/i.test(today), `Today asks a metformin-only person for a daily glucose check: ${today.slice(0, 200)}`);
  }, { input: 'searches: glucose monitoring, diabetes monitoring, how often check glucose, blood sugar test, glucose' });

  await t.step(2, 'BP guidance and its measurement instructions', async () => {
    const r = await searchGuide(t, 'blood pressure');
    const measuring = r.results.filter(n => /measur|check(ing)? (your )?(blood )?pressure|monitor|cuff|reading/i.test(n));
    await t.checkpoint('guide-search-bp');
    // Everything the person can read about measuring: any Guide answer about it, the BP form and the BP chart.
    let corpus = '';
    for (const name of measuring) {
      await searchGuide(t, 'blood pressure');
      await ui.tap(mainEl.getByRole('link', { name, exact: true }));
      await page.waitForTimeout(300);
      corpus += ` ${(await mainEl.innerText()).replace(/\s+/g, ' ')}`;
      await back(t);
    }
    const form = await g.openAdd(t, 'Blood pressure');
    corpus += ` ${(await form.innerText()).replace(/\s+/g, ' ')}`;
    await t.checkpoint('bp-form');
    await ui.tap(ui.button(form, 'Close'));
    await form.waitFor({ state: 'hidden' });
    await t.goto('/track/metric/bloodPressure');
    corpus += ` ${(await mainEl.innerText()).replace(/\s+/g, ' ')}`;
    await t.checkpoint('bp-metric');
    const required = [
      ['a validated upper-arm cuff', /validated[^.]*(upper[- ]arm|cuff)|upper[- ]arm[^.]*(cuff|monitor)/i],
      ['a bare arm', /bare (upper )?arm|sleeve/i],
      ['the arm supported at heart level', /heart level|level (with|of) (your|the) heart/i],
      ['a 5-minute rest', /5 minutes|five minutes/i],
      ['back supported', /back (is )?supported|support(ed)? (your )?back|lean back/i],
      ['feet flat', /feet flat|flat on the floor/i],
      ['no talking', /no talking|don.t talk|without talking|not talk/i],
      ['two readings at least one minute apart', /two readings[^.]*(a|one|1) minute apart|readings[^.]*(a|one|1) minute apart/i],
    ];
    const missing = required.filter(([, re]) => !re.test(corpus)).map(([name]) => name);
    await t.check(missing.length === 0, `BP measurement instructions are missing: ${missing.join('; ')} (searched the Guide “blood pressure” answers, Track → Add → Blood pressure and the BP chart)`);
    const nice = /135\/85/.test(corpus);
    const clinic = /140\/90/.test(corpus);
    const ada = /130\/80/.test(corpus) && /ADA|American Diabetes/i.test(corpus);
    await t.check(nice && clinic && ada,
      `NICE home 135/85 ${nice ? 'shown' : 'missing'}, clinic 140/90 ${clinic ? 'shown' : 'missing'}, ADA diabetes goal ${ada ? 'shown' : 'missing'}: the three are not distinguished side by side`);
  }, { input: 'Guide search “blood pressure”, Track → Add → Blood pressure, Track → Blood pressure' });

  await t.step(3, 'Add HbA1c 6.5%, B12 350 pg/mL, D 50.1 ng/mL; open their details', async () => {
    labsBefore.count = (await t.db()).observations?.length ?? 0;
    await g.tabTo(t, 'Track');
    await g.addLab(t, 'HbA1c', '6.5', { unit: '%' });
    await g.addLab(t, 'Vitamin B12', '350', { unit: 'pg/mL' });
    await g.addLab(t, 'Vitamin D', '50.1', { unit: 'ng/mL' });
    await ui.trackDay(page, '2026-10-08');
    await t.checkpoint('labs-saved');

    await g.openRecord(t, 'HbA1c');
    let it = await g.interpretationText(page);
    await t.checkpoint('hba1c-detail');
    await t.check(/goal for many adults/i.test(it) && /clinician may set a different goal/i.test(it) && /ADA Standards of Care 2026/.test(it),
      `HbA1c 6.5% is not given an explicitly general, individualisable ADA goal: “${it}”`);
    await back(t);

    await g.openRecord(t, 'Vitamin B12');
    it = await g.interpretationText(page);
    await t.checkpoint('b12-detail');
    await t.check(/indeterminate/i.test(it) && /NICE NG239, Table 1/.test(it), `B12 350 pg/mL is not “indeterminate” with NICE NG239 Table 1: “${it}”`);
    await back(t);

    await g.openRecord(t, 'Vitamin D');
    it = await g.interpretationText(page);
    await t.checkpoint('vitd-detail');
    await t.check(/possible harm|adverse/i.test(it) && /clinician/i.test(it) && /NIH Office of Dietary Supplements/.test(it) && !/\badequate\b/i.test(it),
      `vitamin D 50.1 ng/mL is not “potential adverse effects / clinician review” from NIH ODS: “${it}”`);
    await back(t);

    // The labs alone are no acute exercise emergency.
    await g.tabTo(t, 'Today');
    const card = (await mainEl.getByRole('region').first().innerText()).replace(/\s+/g, ' ');
    await t.check(!/emergency|No exercise today|Check again before you start/i.test(card), `the lab results changed Today into a stop: “${card.slice(0, 200)}”`);
    const snap = await t.checkpoint('today-after-labs');
    const lab = (kind, value, unit) => g.ofKind(snap, kind).filter(o => o.value === value && o.unit === unit && o.source === 'manual' && o.scope === 'pointInTime' && o.day === '2026-10-08');
    await t.check(lab('hba1c', 6.5, '%').length === 1 && lab('b12', 350, 'pg/mL').length === 1 && lab('vitaminD', 50.1, 'ng/mL').length === 1,
      `stored labs: ${JSON.stringify(['hba1c', 'b12', 'vitaminD'].flatMap(k => g.ofKind(snap, k).map(o => ({ k, v: o.value, u: o.unit, s: o.source, scope: o.scope, day: o.day }))))}`);
  }, { input: 'HbA1c 6.5 %; B12 350 pg/mL; vitamin D 50.1 ng/mL, all dated today' });

  await t.step(4, 'B12 and vitamin D articles for this vegetarian metformin profile', async () => {
    await openTopic(t, 'Vitamin B12');
    await t.check(/For you/.test(await mainEl.innerText()), 'Vitamin B12 is not marked For you for a metformin user');
    const why = await openCard(t, 'B12 and metformin');
    await t.checkpoint('b12-why');
    await t.check(/more than four years on metformin/i.test(why.text) && /every year|once a year|yearly|annual/i.test(why.text),
      'the annual B12 check after more than four years of metformin is not explained');
    // The claim must rest on ADA 2026 recommendation 3.10 and its discussion: the source names the
    // recommendation, and the source locator or the claim itself names the discussion.
    const ada310 = why.sources.find(s => /Standards of Care in Diabetes—2026, Section 3/.test(s.name) && /Recommendation 3\.10/.test(s.name));
    await t.check(!!ada310 && (/Discussion of recommendation 3\.10/.test(ada310.name) || /discussion that goes with its B12 recommendation/i.test(why.text)),
      `the B12/metformin claim does not cite ADA 2026 recommendation 3.10 and its discussion: ${why.sources.map(s => s.name.slice(0, 120)).join(' | ')}`);
    await back(t);
    const food = await openCard(t, 'Foods with B12');
    await t.checkpoint('b12-food');
    await t.check(/(dal|plant foods)[^.]*(contain|have) no B12|no B12 unless/i.test(food.text), 'dal and greens are not said to contain no B12 unless fortified');
    await t.check(!/(fermented|idli|dosa|dhokla)[^.]*(B12|vitamin B12)/i.test(food.text) || /fermented[^.]*(not|no)[^.]*B12/i.test(food.text),
      'fermented foods are presented as a B12 source');
    const sourceLinks = [...why.sources, ...food.sources];
    await t.check(cleanHrefs(sourceLinks).length === 0, `source links carry health data in their address: ${cleanHrefs(sourceLinks).map(s => s.href).join(', ')}`);
    await back(t);

    await openTopic(t, 'Vitamin D');
    const get = await openCard(t, 'Getting vitamin D');
    await t.checkpoint('vitd-get');
    await back(t);
    const test = await openCard(t, 'Vitamin D tests');
    await t.checkpoint('vitd-test');
    const both = `${get.text} ${test.text}`;
    await t.check(!/(test|check)[^.]*vitamin D[^.]*(every|once a|each) year|annual vitamin D/i.test(both), 'an automatic annual vitamin D test is recommended');
    await t.check(!/\b\d+\s*(?:to\s*\d+\s*)?(minutes|min)\b[^.]*(sun|sunlight)|(sun|sunlight)[^.]*\b\d+\s*(minutes|min)\b/i.test(both), 'a fixed sunlight timer is given');
    await t.check(!/\b\d[\d,]*\s*(IU|µg|mcg|micrograms)\b/i.test(both), 'a vitamin D treatment dose is given');
  });

  await t.step(5, 'BMI and waist for 78 kg, 175 cm and waist 90 cm, with the framework comparisons', async () => {
    await g.tabTo(t, 'Track');
    await g.addMeasure(t, 'Waist', '90');
    await t.goto('/track/metric/weight');
    const weight = (await mainEl.innerText()).replace(/\s+/g, ' ');
    await t.checkpoint('weight-metric');
    await t.check(/BMI 25\.[45]\b/.test(weight), `BMI for 78 kg at 175 cm is not shown as about 25.5: ${weight.match(/BMI [\d.]+[^.]*/)?.[0] ?? 'no BMI line'}`);
    await t.check(/RSSDI-ESI 2020/.test(weight), 'the BMI line does not name the RSSDI-ESI 2020 Indian cut-offs');
    await t.check(/ICMR-NIN 2024(?:[^.]|\.\d)*above 27\.5/.test(weight), 'NIN 2024’s different above-27.5 obesity definition is not explained');
    await t.check(!/obes\w* \(30 or more\)|BMI[^.]*30 or more[^.]*only/i.test(weight), 'WHO’s 30 is given as the only obesity answer');
    await t.goto('/track/metric/waist');
    const waist = (await mainEl.innerText()).replace(/\s+/g, ' ');
    await t.checkpoint('waist-metric');
    await t.check(/90 cm or more for men/.test(waist) && /RSSDI-ESI 2020/.test(waist), `the men’s 90 cm RSSDI threshold is not stated: ${waist.slice(0, 200)}`);
    await t.check(/NIN[^.]*(above|more than|over) 90/i.test(waist), 'waist: NIN 2024’s strict above-90 cm wording is not explained beside RSSDI’s 90-or-more');
    await t.check(!/(you|your waist)[^.]*(are|is) (at|above)[^.]*(men|male)/i.test(waist) && /women/.test(waist),
      'the waist flag is applied by sex without an explicit clinical sex answer (the demo figure is not one)');
  }, { input: 'Waist 90 cm via Track → Add → Waist; weight 78 kg and height 175 cm from the profile' });

  await t.step(6, 'Guide → Meal ideas, vegetarian North Indian; a roti/dal meal and its Sources', async () => {
    await openTopic(t, 'Food & diabetes');
    await g.tabTo(t, 'Guide');
    await ui.tap(ui.row(mainEl, 'Meal ideas', 'link'));
    await page.getByRole('heading', { level: 1, name: 'Meal ideas', exact: true }).waitFor();
    await ui.tap(ui.row(mainEl, 'What you eat'));
    const picker = page.getByRole('dialog', { name: 'Your food' });
    await picker.waitFor();
    await t.checkpoint('food-picker');
    for (const label of ['Vegetarian', 'North Indian']) {
      // Each choice is a native radio inside its row's label: tap the row, as a person does.
      const rowLabel = picker.locator('label').filter({ has: page.getByText(label, { exact: true }) });
      await t.must(await rowLabel.count() === 1, `the food picker has ${await rowLabel.count()} “${label}” rows`);
      await ui.tap(rowLabel);
      await t.check(await rowLabel.locator('input[type="radio"]').isChecked(), `“${label}” did not become the chosen answer`);
    }
    await ui.tap(ui.button(picker, 'Show meal ideas'));
    await picker.waitFor({ state: 'hidden' });
    await ui.tap(ui.row(mainEl, 'Roti, dal and sabzi', 'link'));
    await page.getByRole('heading', { level: 1, name: 'Roti, dal and sabzi', exact: true }).waitFor();
    const meal = await cardContent(page);
    await t.checkpoint('meal-roti-dal');
    await t.check(/half the plate/i.test(meal.text) && /quarter of the plate/i.test(meal.text), 'the meal has no authored portions');
    await t.check(/swaps/i.test(meal.text), 'the meal has no substitutions');
    await t.check(/carbohydrate/i.test(meal.text) && /salt/i.test(meal.text), 'the meal lacks carbohydrate or salt context');
    await t.check(/curd|dahi|milk/i.test(meal.text), 'the meal has no dairy context');
    const forbidden = [
      ['required weighing', /weigh (your|the)? ?(food|portion|rice|roti)|kitchen scale|\b\d+\s*g of (rice|roti|dal|atta)/i],
      ['a food diary', /food diary|log (your|every|each) meal/i],
      ['calories', /calorie|kcal/i],
      ['a glucose prediction', /will (raise|spike|lower) (your )?(blood )?(sugar|glucose)|predicted (glucose|sugar)|glycaemic load of/i],
      ['an IFCT nutrient table', /IFCT/i],
      ['a guaranteed “diabetes safe” food', /diabetes[- ]safe|safe for diabetes|diabetic[- ]friendly|guaranteed/i],
      ['a supplement dose', /\b\d[\d,]*\s*(mg|mcg|µg|IU)\b/],
    ].filter(([, re]) => re.test(meal.text)).map(([name]) => name);
    await t.check(forbidden.length === 0, `the meal shows ${forbidden.join(', ')}`);
    await t.check(meal.sources.some(s => /ICMR–National Institute of Nutrition · 2024/.test(s.name)) && meal.sources.some(s => /American Diabetes Association/.test(s.name)),
      `the meal’s Sources do not name ADA and ICMR-NIN 2024: ${meal.sources.map(s => s.name.slice(0, 60)).join(' | ')}`);
    await t.reload();
    await t.goto('/guide/meals');
    const prefs = (await mainEl.innerText()).replace(/\s+/g, ' ');
    const snap = await t.checkpoint('meals-after-reload');
    const food = docs(snap).profile?.food;
    await t.check(/Vegetarian · North Indian/.test(prefs) && food?.pattern === 'vegetarian' && food?.region === 'north',
      `food preferences did not persist: shown “${prefs.match(/What you eat[^C]*/)?.[0] ?? '?'}”, stored ${JSON.stringify(food)}`);
  }, { input: 'What you eat: Vegetarian, North Indian; Roti, dal and sabzi' });

  await t.step(7, 'Desk, sitting, hydration and sleep topics: every actionable number has its source', async () => {
    await openTopic(t, 'Desk setup & sitting');
    const desk = await openCard(t, 'Setting up your desk');
    await back(t);
    const sitting = await openCard(t, 'Getting up from your desk');
    await t.checkpoint('sitting-card');
    await back(t);
    const posture = await openCard(t, 'Is there a right posture?');
    await back(t);
    await openTopic(t, 'Water');
    const water = await openCard(t, 'How much water?');
    await t.checkpoint('water-card');
    await back(t);
    await openTopic(t, 'Sleep');
    const sleep = await openCard(t, 'How much sleep?');
    await t.checkpoint('sleep-card');
    await t.check(/every 30 minutes/.test(sitting.text) && sitting.sources.some(s => /American Diabetes Association/.test(s.name) && /5\.34/.test(s.name)),
      'the sitting-break cadence does not identify ADA (recommendation 5.34)');
    await t.check(desk.sources.some(s => /Occupational Safety and Health Administration|OSHA|Health and Safety Executive/.test(s.name)), 'desk geometry does not identify OSHA or an equivalent');
    await t.check(/hot weather|heat|hard work|exercise|activity/i.test(water.text) && /all drinks/i.test(water.text),
      'fluid advice does not explain individual variation or that all drinks count');
    await t.check(sleep.sources.some(s => /Centers for Disease Control|CDC/.test(s.name)) && /CDC/.test(sleep.text), 'the sleep hours do not identify their source');
    const everything = [desk, sitting, posture, water, sleep].map(c => c.text).join(' ');
    const bad = [
      ['a posture cure', /cure|fix(es)? your back|correct your posture for good/i],
      ['a camera score', /camera|posture score|form score/i],
      ['a glucose-per-hour-of-sleep formula', /per hour of sleep|each hour of sleep[^.]*(glucose|sugar)/i],
      ['a compulsory two-litre plain-water target', /(must|have to|need to) drink (at least )?(2|two) (litres|liters)|(2|two) (litres|liters) of plain water/i],
    ].filter(([, re]) => re.test(everything)).map(([n]) => n);
    await t.check(bad.length === 0, `these topics show ${bad.join(', ')}`);
    await t.check([desk, sitting, posture, water, sleep].every(c => c.text.includes(NOT_ADVICE)), 'a health card lacks “General information, not medical advice.” near its advice');
    const snap = await t.db();
    const added = (snap.observations?.length ?? 0) - labsBefore.count;
    await t.check(added === 4, `opening sources and articles changed the measurements: ${added} observations were added since step 3 (expected the 3 labs and 1 waist)`);
  });
}

// ---------------------------------------------------------------- monitoring situations (step 1)

const MONITORING = [
  {
    name: 'monitoring: basal insulin (P04)',
    seed: () => persona('P04'),
    expect: [
      ['the care-team plan for basal insulin without a universal count', /basal/i, /care team|clinician|your plan/i],
    ],
    forbid: /\b(6|six) to (10|ten) (times|checks)/i,
  },
  {
    name: 'monitoring: sulfonylurea (P03)',
    seed: () => persona('P03'),
    expect: [['checks with a sulfonylurea (low risk, around activity)', /sulfonylurea|gliclazide|glimepiride/i, /low|hypo|activity|exercise/i]],
  },
  {
    name: 'monitoring: multiple daily injections (P04)',
    seed: () => persona('P04', { patch: { profile: { health: { insulinRegimen: 'multipleDaily' } } } }),
    expect: [['before meals, bedtime, activity and rescue checks', /before (meals|eating)/i, /bedtime|activity|exercise|low/i]],
    forbid: /\b(6|six) to (10|ten) (times|checks)/i,
  },
];

function monitoringCase(row) {
  return {
    name: row.name,
    async run(t) {
      const page = await t.open({ seed: row.seed(), route: '/guide' });
      await t.step(1, 'Guide search for glucose monitoring for this treatment', async () => {
        let corpus = '';
        const counts = [];
        for (const q of ['glucose monitoring', 'how often check glucose', 'glucose', 'insulin']) {
          const r = await searchGuide(t, q);
          counts.push(`“${q}” → ${r.results.length}`);
          for (const name of r.results.filter(n => /glucose|sugar|insulin/i.test(n) && /monitor|check|test|how often|reading|insulin/i.test(n))) {
            await ui.tap(page.getByRole('main').getByRole('link', { name, exact: true }));
            await page.waitForTimeout(300);
            corpus += ` ${(await page.getByRole('main').innerText()).replace(/\s+/g, ' ')}`;
            await back(t);
          }
        }
        await t.checkpoint('guide-monitoring');
        for (const [what, a, b] of row.expect) {
          await t.check(a.test(corpus) && b.test(corpus), `Guide does not explain ${what} (searches ${counts.join(', ')})`);
        }
        if (row.forbid) await t.check(!row.forbid.test(corpus), 'Guide assigns a fixed daily glucose-check count');
      }, { input: 'searches: glucose monitoring, how often check glucose, glucose, insulin' });
    },
  };
}

// ---------------------------------------------------------------- HbA1c cadence rows

const CADENCE = [
  { name: 'HbA1c cadence: at goal, 6 months', value: '6.5', day: '2026-03-01', months: 6, re: /within the usual goal \(under 7%\)[^.]*\. About every 6 months is usual/ },
  { name: 'HbA1c cadence: not at goal, 3 months', value: '7.5', day: '2026-06-01', months: 3, re: /not yet within the usual goal \(under 7%\)[^.]*\. About every 3 months is usual/ },
  { name: 'HbA1c cadence: clinician goal 8%', value: '7.5', day: '2026-03-01', months: 6, goal: 8, re: /within your clinician’s goal \(under 8%\)[^.]*\. About every 6 months is usual/ },
];

function cadenceCase(row) {
  return {
    name: row.name,
    async run(t) {
      const seed = persona('P01', row.goal ? { patch: { profile: { health: { clinicianTargets: { hba1cPercent: row.goal } } } } } : {});
      const page = await t.open({ seed, route: '/track' });
      await t.step(1, `Enter HbA1c ${row.value}% dated ${row.day} through Track → Add → Lab result`, async () => {
        await g.addLab(t, 'HbA1c', row.value, { unit: '%', day: row.day });
        await t.checkpoint('hba1c-saved');
      }, { input: `HbA1c ${row.value} %, Date of test ${row.day}${row.goal ? `, clinician goal ${row.goal}%` : ''}` });
      await t.step(2, 'Today names the next test as a conditional suggestion from ADA 2026 recommendation 6.2', async () => {
        await g.tabTo(t, 'Today');
        const today = (await page.getByRole('main').innerText()).replace(/\s+/g, ' ');
        await t.checkpoint('today-hba1c-due');
        await t.check(row.re.test(today), `Today does not say ${row.months} months for this result: “${today.match(/HbA1c[^]*?(usual[^.]*\.|$)/)?.[0]?.slice(0, 220) ?? 'no HbA1c prompt'}”`);
        await t.check(/ADA Standards of Care 2026, recommendation 6\.2/.test(today), 'the HbA1c suggestion does not cite ADA 2026 recommendation 6.2');
        await t.check(!/must|required|overdue!/i.test(today.match(/HbA1c due[^]*?Add a result/)?.[0] ?? ''), 'the HbA1c suggestion is phrased as a mandate');
      });
      await t.step(3, 'The HbA1c chart states both conditions and identifies recommendation 6.2', async () => {
        await t.goto('/track/metric/hba1c');
        await ui.tap(ui.radio(page.getByRole('main').getByRole('radiogroup', { name: 'Period' }), 'Year'));
        const text = (await page.getByRole('main').innerText()).replace(/\s+/g, ' ');
        await t.checkpoint('hba1c-metric');
        await t.check(/twice a year|6 months/.test(text) && /3 months/.test(text) && /treatment change/.test(text),
          `the HbA1c chart does not state the 6-month and 3-month conditions: ${text.match(/ADA suggests[^.]*\./)?.[0] ?? 'no cadence line'}`);
        await t.check(/recommendation 6\.2/.test(text), `the HbA1c cadence on the chart is attributed to “${text.match(/ADA Standards of Care 2026, recommendation [\d.a-z]+/)?.[0] ?? 'no recommendation'}”, not ADA 2026 recommendation 6.2`);
      });
    },
  };
}

// ---------------------------------------------------------------- interpretation boundary rows

const LABS = [
  ...[['179.9', /under 180[^.]*deficiency/i, 'deficiency'], ['180', /indeterminate/i, 'indeterminate'], ['350', /indeterminate/i, 'indeterminate'], ['350.1', /deficiency is unlikely/i, 'deficiency unlikely']]
    .map(([v, re, label]) => ({ name: `B12 ${v} pg/mL: ${label}`, lab: 'Vitamin B12', unit: 'pg/mL', value: v, re, framework: /NICE NG239, Table 1/, kind: 'b12' })),
  ...[['11.9', /risk of deficiency/i, 'deficiency risk'], ['12', /generally inadequate/i, 'inadequate'], ['19.9', /generally inadequate/i, 'inadequate'],
    ['20', /adequate for most people/i, 'adequate for most'], ['50', /adequate for most people/i, 'adequate for most'], ['50.1', /possible harm[^.]*\.[^.]*clinician/i, 'possible harm, review']]
    .map(([v, re, label]) => ({ name: `vitamin D ${v} ng/mL: ${label}`, lab: 'Vitamin D', unit: 'ng/mL', value: v, re, framework: /NIH Office of Dietary Supplements, Vitamin D, Table 1/, kind: 'vitaminD' })),
];

function labCase(row) {
  return {
    name: row.name,
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/track' });
      await t.step(1, `Enter ${row.lab} ${row.value} ${row.unit} and open its detail`, async () => {
        await g.addLab(t, row.lab, row.value, { unit: row.unit });
        await ui.trackDay(page, '2026-10-08');
        await g.openRecord(t, row.lab);
        const it = await g.interpretationText(page);
        const shown = (await page.getByRole('main').innerText()).replace(/\s+/g, ' ');
        const snap = await t.checkpoint('lab-detail');
        await t.check(row.re.test(it) && row.framework.test(it), `${row.lab} ${row.value} ${row.unit} reads “${it}”, not ${row.name.split(': ')[1]}`);
        const stored = g.ofKind(snap, row.kind);
        await t.check(stored.length === 1 && stored[0].value === Number(row.value) && stored[0].unit === row.unit && stored[0].source === 'manual',
          `stored ${JSON.stringify(stored.map(o => ({ v: o.value, u: o.unit, s: o.source })))}, not ${row.value} ${row.unit} manual`);
        t.note(`detail shows: ${shown.match(/Vitamin (B12|D) [\d.,]+ \S+/)?.[0] ?? shown.slice(0, 80)}`);
      }, { input: `${row.lab} ${row.value} ${row.unit}, dated today` });
    },
  };
}

const BMI = [
  { bmi: '23', kg: '92', rssdi: /BMI 23\.0: in the overweight range \(23 to 24\.9\)/, label: 'RSSDI overweight; NIN upper recommended boundary' },
  { bmi: '25', kg: '100', rssdi: /BMI 25\.0: in the obesity range \(25 or more\)/, label: 'RSSDI obesity; NIN overweight' },
  { bmi: '27.5', kg: '110', rssdi: /BMI 27\.5: in the obesity range \(25 or more\)/, label: 'RSSDI obesity; NIN overweight (obesity only above 27.5)' },
];

function bmiCase(row) {
  return {
    name: `BMI exactly ${row.bmi}: ${row.label}`,
    async run(t) {
      // Height 200 cm makes the BMI boundaries whole kilograms: 92, 100 and 110 kg.
      const page = await t.open({ seed: persona('P01', { patch: { profile: { heightCm: 200 } } }), route: '/track' });
      await t.step(1, `Enter weight ${row.kg} kg (BMI ${row.bmi} at 200 cm) and open its detail`, async () => {
        await g.addMeasure(t, 'Weight', row.kg);
        await ui.trackDay(page, '2026-10-08');
        await g.openRecord(t, 'Weight');
        const it = await g.interpretationText(page);
        await t.checkpoint('weight-detail');
        await t.check(row.rssdi.test(it) && /RSSDI-ESI 2020/.test(it), `BMI ${row.bmi} reads “${it}”`);
        await t.check(/ICMR-NIN 2024 uses over 23 to 27\.5 for overweight and above 27\.5 for obesity/.test(it),
          'the NIN 2024 comparison (over 23 overweight; obesity strictly above 27.5) is not shown beside the RSSDI reading');
        await t.check(!/NIN[^.]*(obesity range|obese)[^.]*27\.5 or more/i.test(it), 'NIN obesity is shown as starting at 27.5 rather than above it');
      }, { input: `weight ${row.kg} kg, height 200 cm` });
    },
  };
}

export const cases = [
  { name: 'P01 main', run: main },
  ...MONITORING.map(monitoringCase),
  ...CADENCE.map(cadenceCase),
  ...LABS.map(labCase),
  ...BMI.map(bmiCase),
];
