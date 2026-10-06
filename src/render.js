const hm = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);

export function render(d) {
  const title = d.from === d.to ? d.from : `${d.from} to ${d.to}`;
  if (!d.projects.length) return `# ${title}\n\nNothing recorded for this period.\n`;
  const out = [`# ${title}`, '', `${d.projects.length} project${d.projects.length === 1 ? '' : 's'}, about ${dur(d.totalMinutes)} of active work.`, ''];
  for (const p of d.projects) {
    out.push(`## ${p.name}`);
    out.push(`${dur(p.activeMinutes)} between ${hm(p.firstAt)} and ${hm(p.lastAt)} · ${p.sessions} session${p.sessions === 1 ? '' : 's'} · ${p.filesChanged} file${p.filesChanged === 1 ? '' : 's'} changed`);
    if (p.titles.length) out.push(`Sessions: ${p.titles.join('; ')}`);
    if (p.commits.length) {
      out.push('', 'Commits:');
      for (const c of p.commits) out.push(`- ${c.subject} (${c.hash})`);
    }
    if (p.requests.length) {
      out.push('', `What you asked for${p.requestCount > p.requests.length ? ` (first ${p.requests.length} of ${p.requestCount})` : ''}:`);
      for (const r of p.requests) out.push(`- ${r}`);
    }
    out.push('');
  }
  return out.join('\n');
}
