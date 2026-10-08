/**
 * results.json plus a readable report.md: the journey × project table that
 * decides the release, every failure with its evidence, and the screen sweep.
 */
import fs from 'node:fs';
import path from 'node:path';

const cell = rs => {
  if (!rs.length) return '—';
  const failed = rs.filter(r => r.status === 'fail').length;
  const pending = rs.filter(r => r.status === 'pending').length;
  const tail = pending ? `, ${pending} pending` : '';
  return failed ? `**FAIL** ${failed}/${rs.length}${tail}` : pending ? `pending ${pending}/${rs.length}` : `pass ${rs.length}/${rs.length}`;
};

export function writeReport({ root, results, journeys, projects, elapsed, devUrl, previewUrl }) {
  fs.writeFileSync(path.join(root, 'results.json'), JSON.stringify({ elapsed, devUrl, previewUrl, results }, null, 2));
  const lines = [];
  const mins = (elapsed / 60000).toFixed(1);
  const passed = results.filter(r => r.status === 'pass').length;
  const pendingCount = results.filter(r => r.status === 'pending').length;
  const failedCount = results.filter(r => r.status === 'fail').length;
  lines.push('# Acceptance run', '');
  lines.push(`${results.length} cases, ${passed} passed, ${failedCount} failed, ${pendingCount} pending an agreed app change, in ${mins} min. Dev server ${devUrl}${previewUrl ? `, preview ${previewUrl}` : ''}.`, '');
  lines.push('Cells give failing cases / cases (“pending” cases failed nothing but have a step waiting on an agreed app change).', '');
  lines.push(`| Journey | ${projects.map(p => p.label).join(' | ')} |`);
  lines.push(`|---|${projects.map(() => '---').join('|')}|`);
  for (const j of journeys) {
    const row = projects.map(p => cell(results.filter(r => r.journey === j.id && r.project === p.id)));
    lines.push(`| ${j.id}${j.safety ? ' (safety)' : ''} ${j.title} | ${row.join(' | ')} |`);
  }
  lines.push('');

  const pendingItems = results.flatMap(r => r.pending ?? []);
  if (pendingItems.length) {
    lines.push('## Pending an agreed app change', '');
    const seen = new Map();
    for (const p of pendingItems) {
      const key = `${p.journey}|${p.case}|${p.step}|${p.message}`;
      if (!seen.has(key)) seen.set(key, { ...p, projects: [] });
      seen.get(key).projects.push(p.project);
    }
    for (const p of seen.values()) lines.push(`- **${p.journey} ${p.case}, step ${p.step}** (${p.projects.join(', ')}): ${p.message}`);
    lines.push('');
  }

  lines.push('## Failures', '');
  for (const j of journeys) {
    const fails = results.filter(r => r.journey === j.id).flatMap(r => r.failures);
    if (!fails.length) continue;
    lines.push(`### ${j.id} ${j.title}`, '');
    // The same step failing the same way in several projects is one finding.
    const groups = new Map();
    for (const f of fails) {
      const key = `${f.case}|${f.step}|${f.message}`;
      if (!groups.has(key)) groups.set(key, { ...f, projects: [] });
      groups.get(key).projects.push(f.project);
    }
    for (const g of groups.values()) {
      lines.push(`- **${g.case}, step ${g.step}** (${g.projects.join(', ')}): ${g.message}`);
      if (g.input) lines.push(`  - Input: ${g.input}`);
      if (g.route) lines.push(`  - Route: \`${g.route}\``);
      if (g.screenshot) lines.push(`  - Screenshot: ${g.screenshot}`);
      if (g.visible) lines.push(`  - Visible: ${g.visible.replace(/\n/g, ' ⏎ ').slice(0, 500)}`);
      if (g.dbDiff) lines.push(`  - Database difference: ${g.dbDiff.replace(/\n/g, '; ').slice(0, 600)}`);
    }
    lines.push('');
  }

  lines.push('## Screen sweep', '');
  const sweep = results.flatMap(r => r.sweep.map(s => ({ ...s, journey: r.journey, project: r.project })));
  // One finding per cause: contrast by colour pair, the rest by check, screen and element.
  const keyOf = s => (s.check === 'contrast'
    ? `contrast|${s.detail.replace(/, \d+(\.\d+)?px\)$/, ')')}`
    : `${s.check}|${s.route.split('?')[0]}|${s.detail.replace(/\d+(\.\d+)?/g, 'n')}|${s.where ?? ''}`);
  const byCheck = new Map();
  for (const s of sweep) {
    const key = keyOf(s);
    if (!byCheck.has(key)) byCheck.set(key, { ...s, count: 0, projects: new Set(), journeys: new Set(), routes: new Set(), examples: new Set() });
    const g = byCheck.get(key);
    g.count += 1; g.projects.add(s.project); g.journeys.add(s.journey); g.routes.add(s.route.split('?')[0]);
    if (s.where && g.examples.size < 4) g.examples.add(s.where);
  }
  const groups = [...byCheck.values()].sort((a, b) => a.check.localeCompare(b.check) || b.count - a.count);
  lines.push(`${sweep.length} findings in ${groups.length} distinct groups.`, '');
  for (const g of groups.slice(0, 300)) {
    const where = g.check === 'contrast' ? [...g.examples].join('; ') : (g.where ?? '');
    const routes = [...g.routes].slice(0, 8).join(', ');
    lines.push(`- [${g.check}] ${g.detail}${where ? ` — ${where}` : ''} (×${g.count}; routes ${routes}; ${[...g.projects].join(', ')}; ${[...g.journeys].join(', ')}; e.g. ${g.screenshot ?? ''})`);
  }
  const file = path.join(root, 'report.md');
  fs.writeFileSync(file, lines.join('\n'));
  // Heading, counts, legend, then the table header, divider and one row per journey.
  const summary = lines.slice(0, 6 + 2 + journeys.length).join('\n');
  return { file, summary };
}
