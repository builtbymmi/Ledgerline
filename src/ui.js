/* =========================================================
   Ledgerline — UI: views, sheets, import wizard, charts, AI
   ========================================================= */
const ui = { view: 'overview', month: THIS_MONTH, f: { q: '', month: 'sel', cat: '', acct: '', kind: '', flag: '' }, selecting: false, sel: new Set(), limit: 200, chat: [], imp: null, debtExtra: 200, fi: { contrib: null, ret: null, spend: null }, cutMonthly: null, busy: false };
let D = null, SAMPLE = null, DL = null, SAMPLE_LIMITS = null;
const charts = {};
const REDUCED = IS_DOM && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

const ICONS = {
  home: '<path d="M4 10.5 12 4l8 6.5V20H4z"/><path d="M10 20v-5h4v5"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  pie: '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
  cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1 20 20M8.1 15.9 20 4"/>',
  bank: '<path d="M3 9.5 12 4l9 5.5"/><path d="M5 10v7M9.5 10v7M14.5 10v7M19 10v7"/><path d="M3 20h18"/>',
  plan: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M12 8.5 13.2 11 15.5 12l-2.3 1L12 15.5 10.8 13 8.5 12l2.3-1z"/>',
  gear: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  up: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>'
};
const ico = (n, s) => `<svg viewBox="0 0 24 24" width="${s || 18}" height="${s || 18}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
const VIEWS = [
  { id: 'overview', label: 'Overview', icon: 'home' }, { id: 'activity', label: 'Activity', icon: 'list' }, { id: 'budget', label: 'Budget', icon: 'pie' },
  { id: 'cut', label: 'Cut list', icon: 'cut' }, { id: 'wealth', label: 'Net worth', icon: 'bank' }, { id: 'plan', label: 'Plan', icon: 'plan' },
  { id: 'ask', label: 'Ask Claude', icon: 'spark' }, { id: 'settings', label: 'Settings', icon: 'gear' }
];
const MONTH_VIEWS = new Set(['overview', 'budget', 'cut']);
const IN_CLAUDE = IS_DOM && !!(window.claude && window.claude.use);
const navViews = () => VIEWS.filter(v => IN_CLAUDE || v.id !== 'ask');

/* ---------- small helpers ---------- */
function cv(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function alpha(hex, a) { const h = hex.replace('#', ''); if (h.length !== 6) return hex; const n = parseInt(h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
function toast(msg) { const r = $('#toastRoot'); r.innerHTML = `<div class="toast">${esc(msg)}</div>`; clearTimeout(toast.t); toast.t = setTimeout(() => { r.innerHTML = ''; }, 3400); }
function touch(meta, months) { Store.mark(meta, months); }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
function catOptions(sel, opts = {}) {
  let h = opts.all ? `<option value="">All categories</option>` : '';
  for (const g of Object.keys(GROUPS)) { const cs = state.categories.filter(c => c.group === g); if (!cs.length) continue; h += `<optgroup label="${esc(GROUPS[g])}">` + cs.map(c => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${esc(c.name)}</option>`).join('') + '</optgroup>'; }
  return h;
}
function acctOptions(sel, opts = {}) { return (opts.all ? `<option value="">All accounts</option>` : '') + state.accounts.map(a => `<option value="${a.id}"${a.id === sel ? ' selected' : ''}>${esc(a.name)}</option>`).join(''); }
function acctName(id) { const a = state.accounts.find(x => x.id === id); return a ? a.name : '—'; }
function monogram(name) { return esc((String(name || '?').replace(/[^A-Za-z0-9]/g, '')[0] || '?').toUpperCase()); }
function ensureReal() { if (!state.demo) return false; state = emptyState(); rebuildCats(); Store.status('saving'); toast('Example data cleared. This ledger is yours now.'); return true; }
function armed(el) { if (el.classList.contains('armed')) return true; const t = el.textContent; el.classList.add('armed'); el.textContent = 'Tap again to confirm'; setTimeout(() => { el.classList.remove('armed'); el.textContent = t; }, 3500); return false; }
function budgetFor(cat, m) {
  const b = +state.budgets[cat] || 0; if (!state.rollover[cat] || !b) return b;
  const pm = addMonths(m, -1); const pd = D.months[pm]; if (!pd) return b;
  return b + (b - (pd.byCat[cat] || 0));
}
function cashOnHand(dateEnd) { const ch = cashAccounts(); if (!dateEnd || dateEnd >= TODAY) return sumBy(ch, acctBalance); let t = null; for (const a of ch) { const v = balanceOn(a, dateEnd); if (v != null) t = (t || 0) + v; } return t; }
function monthEnd(m) { return m === THIS_MONTH ? TODAY : m + '-' + pad(daysInMonth(m)); }
function utilCls(u) { return u <= 0.1 ? 'good' : u <= 0.3 ? 'warn' : 'bad'; }
function spendCats() { return state.categories.filter(c => ['needs', 'wants', 'business'].includes(c.group)); }
function paceFrac(m) { return m === THIS_MONTH ? (+TODAY.slice(8)) / daysInMonth(m) : m < THIS_MONTH ? 1 : 0; }
function hasData() { return state.transactions.length > 0 || state.accounts.length > 0; }

/* ---------- charts ---------- */
function killCharts() { for (const k in charts) { try { charts[k].destroy(); } catch (e) { } delete charts[k]; } }
function chartBase(yFmt) {
  return {
    responsive: true, maintainAspectRatio: false, animation: REDUCED ? false : { duration: 350 },
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false }, tooltip: { backgroundColor: cv('--ink'), titleColor: cv('--surface'), bodyColor: cv('--surface'), padding: 10, cornerRadius: 8, boxPadding: 4, callbacks: { label: c => ' ' + (c.dataset.label ? c.dataset.label + ': ' : '') + (yFmt || money)(c.parsed.y) } } },
    scales: {
      x: { grid: { display: false }, border: { color: cv('--line') }, ticks: { color: cv('--muted'), font: { size: 11 }, maxRotation: 0, autoSkipPadding: 10 } },
      y: { grid: { color: cv('--grid') }, border: { display: false }, ticks: { color: cv('--muted'), font: { size: 11 }, maxTicksLimit: 5, callback: v => compact(v) } }
    }
  };
}
function mkChart(id, cfg) { const el = document.getElementById(id); if (!el || !window.Chart) return; charts[id] = new Chart(el, cfg); }

/* ---------- shell rendering ---------- */
function renderNav() {
  $('#railNav').innerHTML = navViews().map(v => `<button class="navbtn" type="button" data-act="nav" data-v="${v.id}"${ui.view === v.id ? ' aria-current="page"' : ''}>${ico(v.icon)}<span>${v.label}</span></button>`).join('');
  const more = !['overview', 'activity', 'cut'].includes(ui.view);
  $('#tabbar').innerHTML = [
    `<button type="button" data-act="nav" data-v="overview"${ui.view === 'overview' ? ' aria-current="page"' : ''}>${ico('home')}Overview</button>`,
    `<button type="button" data-act="nav" data-v="activity"${ui.view === 'activity' ? ' aria-current="page"' : ''}>${ico('list')}Activity</button>`,
    `<button type="button" class="plus" data-act="import"><span class="pl">${ico('up', 20)}</span>Import</button>`,
    `<button type="button" data-act="nav" data-v="cut"${ui.view === 'cut' ? ' aria-current="page"' : ''}>${ico('cut')}Cut list</button>`,
    `<button type="button" data-act="more"${more ? ' aria-current="page"' : ''}>${ico('more')}More</button>`
  ].join('');
}
function storeBadge(s) {
  const el = $('#storeBadge'); if (!el) return;
  let dot = '', txt = '';
  if (state && state.demo) { dot = 'warn'; txt = 'Example data. Nothing is saved until you import or add your own.'; }
  else if (s === 'error') { dot = 'warn'; txt = 'Could not save the last change. It will retry on your next edit.'; }
  else if (Store.mode === 'cloud') { dot = 'ok'; txt = s === 'saving' ? 'Saving…' : 'Saved privately to your Claude account. Only you can see it.'; }
  else if (Store.mode === 'local') { dot = 'ok'; txt = s === 'saving' ? 'Saving…' : 'Saved in this browser only.'; }
  else { dot = 'warn'; txt = 'Storage unavailable here. Export a backup before leaving.'; }
  el.innerHTML = `<span class="dot ${dot}"></span><span>${esc(txt)}</span>`;
}
function render() {
  if (!state) return;
  D = derive(); killCharts(); renderNav();
  const v = VIEWS.find(x => x.id === ui.view) || VIEWS[0];
  $('#viewTitle').textContent = v.label;
  $('#monthPick').hidden = !MONTH_VIEWS.has(ui.view);
  $('#mLabel').textContent = mLabel(ui.month);
  $('#mNext').disabled = ui.month >= THIS_MONTH;
  const fn = { overview: vOverview, activity: vActivity, budget: vBudget, cut: vCut, wealth: vWealth, plan: vPlan, ask: vAsk, settings: vSettings }[ui.view] || vOverview;
  const out = fn();
  $('#view').innerHTML = (state.demo ? demoBanner() : '') + out.html;
  if (out.after) try { out.after(); } catch (e) { console.error(e); }
  storeBadge();
}
function demoBanner() {
  return `<div class="demo-banner"><p><b>You are looking at example data.</b> Import a bank statement, credit card export, or spreadsheet, or restore a Ledgerline backup file. The example clears automatically.</p><button class="btn primary" data-act="import" type="button">${ico('up', 16)} Import statements</button><button class="btn ghost" data-act="startFresh" type="button">Start empty</button></div>`;
}
function emptyCard(msg) { return `<div class="card"><div class="empty">${msg}<div style="margin-top:12px"><button class="btn primary" data-act="import" type="button">Import statements</button></div></div></div>`; }

/* =================== OVERVIEW =================== */
function vOverview() {
  const m = ui.month, md = monthData(D, m);
  const onHand = cashOnHand(monthEnd(m)) || 0; const prevOH = cashOnHand(monthEnd(addMonths(m, -1)));
  const budTot = sumBy(spendCats(), c => budgetFor(c.id, m)); const pace = paceFrac(m);
  const kept = md.income - md.spend; const rate = md.income > 0 ? kept / md.income : null;
  const sts = safeToSpend();
  let spentPill = '';
  if (budTot > 0) { const r = md.spend / budTot; const exp = pace; spentPill = r > 1 ? `<span class="pill bad">▲ over budget</span>` : r > exp + 0.08 ? `<span class="pill warn">● ahead of pace</span>` : `<span class="pill good">✓ on track</span>`; }
  const kpis = `
  <div class="grid g4">
    <div class="card kpi"><span class="eyebrow">Cash on hand</span><span class="v total">${cashAccounts().length ? money(onHand, true) : '—'}</span><span class="d">${!cashAccounts().length ? `Add your checking in <a href="#wealth" data-act="nav" data-v="wealth">Net worth</a>` : prevOH != null ? `<span class="${onHand - prevOH >= 0 ? 'pos' : 'neg'}">${signedMoney(onHand - prevOH).replace(/\.\d\d$/, '')}</span> since ${mShort(addMonths(m, -1))} · checking` : 'In checking'}</span></div>
    <div class="card kpi"><span class="eyebrow">Spent in ${mShort(m)}</span><span class="v total">${money(md.spend)}</span><span class="d">${budTot > 0 ? `of ${money(budTot)} budget ` + spentPill : `<a href="#budget" data-act="nav" data-v="budget">Set a budget</a>`}</span></div>
    <div class="card kpi"><span class="eyebrow">Kept from income</span><span class="v total ${kept < 0 ? 'neg' : ''}">${money(kept)}</span><span class="d">${rate == null ? 'No income recorded' : `<span class="pill ${rate >= 0.2 ? 'good' : rate >= 0.1 ? 'warn' : 'bad'}">${Math.round(rate * 100)}% savings rate</span>`}</span></div>
    <div class="card kpi"><span class="eyebrow">Safe to spend</span><span class="v total ${sts && sts.value < 0 ? 'neg' : ''}">${sts ? money(sts.value) : '—'}</span><span class="d">${sts ? `until ${sts.pay ? 'payday ' + dShort(sts.pay) : dShort(sts.until)} after ${money(sts.billTotal)} in bills` : `Add a checking account in <a href="#wealth" data-act="nav" data-v="wealth">Net worth</a>`}</span></div>
  </div>`;
  if (!state.transactions.length) return { html: kpis + emptyCard('No transactions yet. Import a statement or spreadsheet to see where your money goes.') };
  const months12 = lastNMonths(m, 12).filter(k => k >= (D.list[0] || k));
  const ins = buildInsights(D, m).filter(i => i.yearly > 0);
  const bills = upcomingBills(14);
  const nwMonths = lastNMonths(m, 12); const nwSeries = nwMonths.map(k => { const v = cashOnHand(monthEnd(k)); return v == null ? null : round2(v); });
  const html = kpis + `
  <div class="grid g2">
    <div class="card">
      <div class="card-h"><h2>Cash flow</h2><span class="sub">Last ${months12.length} months</span></div>
      <div class="chartbox"><canvas id="cfChart" aria-label="Income and spending by month"></canvas></div>
      <div class="legend"><span><i style="background:var(--inc)"></i>Income</span><span><i style="background:var(--spend)"></i>Spending</span><span class="muted">Avg kept: ${money(sumBy(months12, k => monthData(D, k).income - monthData(D, k).spend) / Math.max(1, months12.length))}/mo</span></div>
    </div>
    <div class="card">
      <div class="card-h"><h2>Where it went</h2><span class="sub">${mLabel(m, true)}</span></div>
      ${catBars(md, 8)}
    </div>
  </div>
  <div class="card">
    <div class="card-h"><h2>Money flow</h2><span class="sub">Every dollar in ${mLabel(m, true)}, from income to where it landed</span></div>
    <div class="scrollx">${sankey(md)}</div>
  </div>
  <div class="grid g2">
    <div class="card">
      <div class="card-h"><h2>Cut list</h2><button class="btn sm" data-act="nav" data-v="cut" type="button">See all</button></div>
      ${ins.length ? `<div class="big-save" style="margin-bottom:6px"><span class="v">${money(sumBy(ins, 'yearly'))}</span><span class="muted">a year in realistic savings found</span></div>` + ins.slice(0, 3).map(insRow).join('') : '<div class="empty">Nothing stands out this month.</div>'}
    </div>
    <div class="card">
      <div class="card-h"><h2>Coming up</h2><span class="sub">Next 14 days</span></div>
      ${bills.length ? bills.slice(0, 8).map(b => `<div class="kv"><span><b>${esc(b.name)}</b> <span class="muted">· ${dLabel(b.date)}</span></span><span class="num">${money(b.amount, true)}</span></div>`).join('') + `<div class="kv"><span class="muted">Total</span><span class="num"><b>${money(sumBy(bills, 'amount'), true)}</b></span></div>` : '<div class="empty">No recurring bills detected in the next two weeks.</div>'}
    </div>
  </div>
  <div class="grid g2">
    <div class="card">
      <div class="card-h"><h2>Cash on hand</h2><span class="sub">Checking at each month end</span></div>
      <div class="chartbox"><canvas id="nwChart" aria-label="Checking balance by month"></canvas></div>
    </div>
    <div class="card">
      <div class="card-h"><h2>Daily spending</h2><span class="sub">${mLabel(m, true)}</span></div>
      ${calendar(md, m)}
    </div>
  </div>`;
  return {
    html, after() {
      mkChart('cfChart', { type: 'bar', data: { labels: months12.map(mShort), datasets: [
        { label: 'Income', data: months12.map(k => round2(monthData(D, k).income)), backgroundColor: cv('--inc'), borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: false, maxBarThickness: 16, categoryPercentage: .7, barPercentage: .85 },
        { label: 'Spending', data: months12.map(k => round2(monthData(D, k).spend)), backgroundColor: cv('--spend'), borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: false, maxBarThickness: 16, categoryPercentage: .7, barPercentage: .85 }] }, options: chartBase() });
      const st = Math.max(0, nwSeries.findIndex(v => v != null)); lineChart('nwChart', nwMonths.slice(st).map(mShort), nwSeries.slice(st), 'Cash on hand', cv('--inc'), true);
    }
  };
}
function lineChart(id, labels, data, label, color, fill) {
  const last = data.length - 1; const o = chartBase();
  mkChart(id, { type: 'line', data: { labels, datasets: [{ label, data, borderColor: color, backgroundColor: alpha(color, .12), fill: fill ? 'origin' : false, tension: .3, borderWidth: 2, spanGaps: true, pointRadius: data.map((v, i) => i === last ? 4 : 0), pointBackgroundColor: color, pointBorderColor: cv('--surface'), pointBorderWidth: 2, pointHoverRadius: 5 }] }, options: o });
}
function catBars(md, limit, onclick = true) {
  const rows = Object.entries(md.byCat).filter(([, v]) => v > 0.5).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return '<div class="empty">No spending this month.</div>';
  const top = rows.slice(0, limit); const rest = rows.slice(limit); if (rest.length) top.push(['__other', sumBy(rest, r => r[1])]);
  const max = top[0][1]; const total = sumBy(rows, r => r[1]);
  return `<div class="bars">` + top.map(([c, v]) => `<div class="bar-row" ${onclick && c !== '__other' ? `data-act="filterCat" data-cat="${c}" role="button" tabindex="0"` : ''}><span class="nm">${c === '__other' ? 'Everything else (' + rest.length + ')' : esc(catOf(c).name)}</span><span class="amt num">${money(v)} <span class="muted">${Math.round(v / total * 100)}%</span></span><div class="track"><div class="fill" style="width:${(v / max * 100).toFixed(1)}%"></div></div></div>`).join('') + `</div>`;
}
function sankey(md) {
  const narrow = IS_DOM && window.innerWidth < 640;
  const income = Math.max(0, md.income); const cats = Object.entries(md.byCat).filter(([, v]) => v > 1).sort((a, b) => b[1] - a[1]);
  if (!cats.length && !income) return '<div class="empty">No activity this month.</div>';
  const right = cats.slice(0, 7).map(([c, v]) => ({ label: catOf(c).name, v, kind: 'spend' }));
  const restV = sumBy(cats.slice(7), r => r[1]); if (restV > 1) right.push({ label: 'Everything else', v: restV, kind: 'spend' });
  if (md.saved > 1) right.push({ label: 'Saved & invested', v: md.saved, kind: 'save' });
  const used = sumBy(right, 'v'); if (income - used > 1) right.push({ label: 'Left over', v: income - used, kind: 'left' });
  const left = [{ label: 'Income', v: income, kind: 'inc' }]; const totalR = sumBy(right, 'v'); if (totalR - income > 1) left.push({ label: 'From savings or credit', v: totalR - income, kind: 'short' });
  const W = narrow ? 380 : 700, gap = narrow ? 5 : 7, xL = narrow ? 4 : 150, nw = narrow ? 8 : 12, xR = narrow ? W - 150 : W - 210; let H = Math.max(narrow ? 200 : 240, right.length * (narrow ? 26 : 34));
  const k = (H - gap * (right.length - 1)) / totalR;
  const minH = narrow ? 14 : 18; let y = 0; right.forEach(n => { n.y0 = y; n.y1 = y + Math.max(n.v * k, minH); y = n.y1 + gap; }); H = Math.max(H, y - gap);
  const lH = sumBy(left, 'v') * k + gap * (left.length - 1); y = (H - lH) / 2; left.forEach(n => { n.y0 = y; n.y1 = y + n.v * k; y = n.y1 + gap; });
  const bands = []; let li = 0, ri = 0, lUsed = 0, rUsed = 0;
  while (li < left.length && ri < right.length) {
    const L = left[li], R = right[ri]; const amt = Math.min(L.v - lUsed, R.v - rUsed);
    if (amt > 0.01) bands.push({ a0: L.y0 + lUsed * k, a1: L.y0 + (lUsed + amt) * k, b0: R.y0 + rUsed * k, b1: R.y0 + (rUsed + amt) * k, kind: L.kind === 'short' ? 'short' : R.kind });
    lUsed += amt; rUsed += amt; if (L.v - lUsed < 0.01) { li++; lUsed = 0; } if (R.v - rUsed < 0.01) { ri++; rUsed = 0; }
  }
  const col = kind => kind === 'save' ? 'var(--accent)' : kind === 'left' ? 'var(--inc)' : kind === 'short' ? 'var(--bad)' : 'var(--flow)';
  const mx = (xL + nw + xR) / 2;
  const paths = bands.map(b => `<path d="M${xL + nw},${b.a0.toFixed(1)} C${mx},${b.a0.toFixed(1)} ${mx},${b.b0.toFixed(1)} ${xR},${b.b0.toFixed(1)} L${xR},${b.b1.toFixed(1)} C${mx},${b.b1.toFixed(1)} ${mx},${b.a1.toFixed(1)} ${xL + nw},${b.a1.toFixed(1)} Z" fill="${col(b.kind)}" fill-opacity="${b.kind === 'spend' ? .55 : .45}"><title>${money(Math.abs(b.b1 - b.b0) / k)}</title></path>`).join('');
  const lnodes = left.map(n => narrow ? `<rect x="${xL}" y="${n.y0.toFixed(1)}" width="${nw}" height="${Math.max(1, n.y1 - n.y0).toFixed(1)}" rx="3" fill="${n.kind === 'short' ? 'var(--bad)' : 'var(--inc)'}"><title>${esc(n.label)} ${money(n.v)}</title></rect>` : `<rect x="${xL}" y="${n.y0.toFixed(1)}" width="${nw}" height="${Math.max(1, n.y1 - n.y0).toFixed(1)}" rx="3" fill="${n.kind === 'short' ? 'var(--bad)' : 'var(--inc)'}"/><text x="${xL - 10}" y="${((n.y0 + n.y1) / 2 - 3).toFixed(1)}" text-anchor="end" font-size="14" font-weight="600">${esc(n.label)}</text><text class="lbl2" x="${xL - 10}" y="${((n.y0 + n.y1) / 2 + 13).toFixed(1)}" text-anchor="end">${money(n.v)}</text>`).join('');
  const rnodes = right.map(n => { const cy = (n.y0 + n.y1) / 2; return `<rect x="${xR}" y="${n.y0.toFixed(1)}" width="${nw}" height="${Math.max(1, n.y1 - n.y0).toFixed(1)}" rx="3" fill="${n.kind === 'spend' ? 'var(--spend)' : col(n.kind)}"/><text x="${xR + nw + 8}" y="${(cy + 4).toFixed(1)}" font-size="${narrow ? 11.5 : 13}">${esc(narrow && n.label.length > 15 ? n.label.slice(0, 14) + '…' : n.label)}<tspan class="lbl2" dx="6"${narrow ? ' style="font-size:10px"' : ''}>${money(n.v)}</tspan></text>`; }).join('');
  return (narrow ? `<div class="row" style="margin-bottom:8px;font-size:13px"><span class="pill" style="background:var(--surface-2)"><i style="width:8px;height:8px;border-radius:2px;background:var(--inc);display:inline-block"></i>Income ${money(left[0].v)}</span>${left[1] ? `<span class="pill bad">From savings or credit ${money(left[1].v)}</span>` : ''}</div>` : '') + `<svg class="sankey" viewBox="0 0 ${W} ${H}" width="100%" style="${narrow ? '' : 'min-width:560px;'}display:block" role="img" aria-label="Money flow from income to spending categories">${paths}${lnodes}${rnodes}</svg>`;
}
function calendar(md, m) {
  const first = toD(m + '-01').getDay(); const n = daysInMonth(m); const vals = []; for (let d = 1; d <= n; d++) vals.push(md.days[m + '-' + pad(d)] || 0);
  const max = Math.max(...vals, 1);
  let h = '<div class="cal">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => `<div class="dow">${x}</div>`).join('');
  for (let i = 0; i < first; i++) h += '<div class="c e"></div>';
  vals.forEach((v, i) => { const ds = m + '-' + pad(i + 1); const lvl = v <= 0 ? 0 : Math.max(1, Math.ceil(Math.sqrt(v / max) * 5)); h += `<div class="c l${lvl}${ds === TODAY ? ' today' : ''}" title="${dLabel(ds)}: ${money(v, true)}"><span>${i + 1}</span>${v > 0 ? `<b>${compact(v)}</b>` : ''}</div>`; });
  h += '</div>';
  const top = Object.entries(md.days).sort((a, b) => b[1] - a[1])[0];
  return h + `<div class="row between" style="margin-top:10px"><span class="ramp">Less <i style="background:var(--h1)"></i><i style="background:var(--h2)"></i><i style="background:var(--h3)"></i><i style="background:var(--h4)"></i><i style="background:var(--h5)"></i> More</span>${top ? `<span class="muted" style="font-size:12.5px">Biggest day: ${dShort(top[0])}, ${money(top[1])}</span>` : ''}</div>`;
}
function insRow(i) {
  return `<div class="ins"><span class="sev ${i.sev}"></span><div><h3>${esc(i.title)}</h3><p>${esc(i.body)}</p>${i.action === 'aicat' && SAMPLE ? `<div style="margin-top:8px"><button class="btn sm" data-act="aiCat" type="button">${ico('spark', 14)} Categorize with Claude</button></div>` : ''}${i.cat ? `<div style="margin-top:6px"><button class="btn sm ghost" data-act="filterCat" data-cat="${i.cat}" type="button">See transactions</button></div>` : ''}</div><div class="yr">${i.yearly > 0 ? `<b>${money(i.yearly)}</b><span>per year</span>` : ''}</div></div>`;
}

/* =================== ACTIVITY =================== */
function filteredTx() {
  const f = ui.f; const q = f.q.trim().toLowerCase(); const mon = f.month === 'sel' ? ui.month : f.month;
  return state.transactions.filter(t => {
    if (mon && mon !== 'all' && mKey(t.date) !== mon) return false;
    if (f.cat && t.categoryId !== f.cat) return false; if (f.acct && t.accountId !== f.acct) return false;
    if (f.kind === 'out' && t.amount >= 0) return false; if (f.kind === 'in' && t.amount <= 0) return false;
    if (f.flag === 'biz' && !t.business) return false; if (f.flag === 'uncat' && t.categoryId !== 'uncat') return false; if (f.flag === 'excl' && !t.excluded) return false; if (f.flag === 'notes' && !t.notes) return false;
    if (q) { const hay = (t.desc + ' ' + t.merchant + ' ' + (t.notes || '') + ' ' + (t.tags || []).join(' ') + ' ' + catOf(t.categoryId).name + ' ' + Math.abs(t.amount).toFixed(2)).toLowerCase(); if (!hay.includes(q)) return false; }
    return true;
  }).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
}
function vActivity() {
  const f = ui.f; const list = filteredTx(); const months = [...D.list].reverse();
  const out = -sumBy(list.filter(t => t.amount < 0 && !t.excluded), 'amount'), inn = sumBy(list.filter(t => t.amount > 0 && !t.excluded), 'amount');
  const filters = `<div class="card"><div class="filters">
    <input class="input search" id="fq" type="search" placeholder="Search merchant, note, amount…" value="${esc(f.q)}" data-on="input:fq">
    <select class="input" id="fmonth" data-on="change:fmonth"><option value="sel"${f.month === 'sel' ? ' selected' : ''}>${mLabel(ui.month)}</option><option value="all"${f.month === 'all' ? ' selected' : ''}>All dates</option>${months.map(m => `<option value="${m}"${f.month === m ? ' selected' : ''}>${mLabel(m)}</option>`).join('')}</select>
    <select class="input" id="fcat" data-on="change:fcat">${catOptions(f.cat, { all: true })}</select>
    <select class="input" id="facct" data-on="change:facct">${acctOptions(f.acct, { all: true })}</select>
    <select class="input" id="fkind" data-on="change:fkind"><option value="">In & out</option><option value="out"${f.kind === 'out' ? ' selected' : ''}>Money out</option><option value="in"${f.kind === 'in' ? ' selected' : ''}>Money in</option></select>
    <select class="input" id="fflag" data-on="change:fflag"><option value="">Any status</option><option value="uncat"${f.flag === 'uncat' ? ' selected' : ''}>Uncategorized</option><option value="biz"${f.flag === 'biz' ? ' selected' : ''}>Business</option><option value="excl"${f.flag === 'excl' ? ' selected' : ''}>Excluded</option><option value="notes"${f.flag === 'notes' ? ' selected' : ''}>Has notes</option></select>
  </div>
  <div class="row between" style="margin-top:12px"><span class="ink2" style="font-size:13.5px"><b class="num">${list.length}</b> transactions · out <b class="num">${money(out, true)}</b> · in <b class="num">${money(inn, true)}</b></span>
  <span class="row"><button class="btn sm" data-act="toggleSelect" type="button">${ui.selecting ? 'Done selecting' : 'Select'}</button><button class="btn sm" data-act="addTx" type="button">${ico('plus', 14)} Add</button>${SAMPLE && state.transactions.some(t => t.categoryId === 'uncat') ? `<button class="btn sm" data-act="aiCat" type="button">${ico('spark', 14)} Auto-categorize</button>` : ''}</span></div>
  ${ui.selecting ? `<div class="row" style="margin-top:10px;padding:10px;border-radius:10px;background:var(--surface-2)"><b>${ui.sel.size} selected</b><button class="btn sm ghost" data-act="selAll" type="button">Select all shown</button><select class="input" id="bulkCat" data-on="change:bulkCat"><option value="">Set category…</option>${catOptions('')}</select><button class="btn sm" data-act="bulk" data-op="biz" type="button">Mark business</button><button class="btn sm" data-act="bulk" data-op="excl" type="button">Exclude / include</button><button class="btn sm danger" data-act="bulk" data-op="del" type="button">Delete</button></div>` : ''}
  </div>`;
  if (!list.length) return { html: filters + `<div class="card"><div class="empty">${state.transactions.length ? 'No transactions match these filters.' : 'No transactions yet.'}</div></div>` };
  const shown = list.slice(0, ui.limit); let h = ''; let day = null; let dayTot = {};
  for (const t of shown) { dayTot[t.date] = (dayTot[t.date] || 0) + (t.excluded ? 0 : t.amount); }
  for (const t of shown) {
    if (t.date !== day) { day = t.date; h += `<div class="tx-day"><span>${dLabel(day)}</span><span class="num">${signedMoney(dayTot[day])}</span></div>`; }
    const c = catOf(t.categoryId);
    h += `<div class="tx has-chk${t.excluded ? ' excluded' : ''}" data-act="editTx" data-id="${t.id}" role="button" tabindex="0">
      <input class="chk" type="checkbox" aria-label="Select" data-act="selTx" data-id="${t.id}"${ui.sel.has(t.id) ? ' checked' : ''}>
      <span class="mono">${monogram(t.merchant)}</span>
      <span style="min-width:0"><div class="t1">${esc(t.merchant)}${t.business ? '<span class="tag biz">BIZ</span>' : ''}${t.excluded ? '<span class="tag">excluded</span>' : ''}</div><div class="t2">${esc(c.name)} · ${esc(acctName(t.accountId))}${t.notes ? ' · ' + esc(t.notes) : ''}</div></span>
      <span class="amt num ${t.amount > 0 ? 'pos' : ''}">${signedMoney(t.amount)}</span></div>`;
  }
  if (list.length > shown.length) h += `<div style="text-align:center;padding:14px"><button class="btn" data-act="more" data-more="tx" type="button">Show ${Math.min(200, list.length - shown.length)} more</button></div>`;
  return { html: filters + `<div class="card ${ui.selecting ? 'selecting' : ''}" style="padding-top:4px">${h}</div>` };
}

/* =================== BUDGET =================== */
function vBudget() {
  const m = ui.month, md = monthData(D, m), pace = paceFrac(m);
  const cats = spendCats().filter(c => c.id !== 'uncat' || md.byCat.uncat);
  const prior = fullMonthsBefore(D, m, 3);
  const totB = sumBy(cats, c => budgetFor(c.id, m)), totS = sumBy(cats, c => md.byCat[c.id] || 0);
  const incomeRef = prior.length ? sumBy(prior, k => D.months[k].income) / prior.length : md.income;
  const unbudgeted = sumBy(cats.filter(c => !(+state.budgets[c.id])), c => md.byCat[c.id] || 0);
  let rows = '';
  for (const g of ['needs', 'wants', 'business']) {
    const cs = cats.filter(c => c.group === g); if (!cs.length) continue;
    rows += `<tr><td colspan="5" style="padding-top:16px"><span class="eyebrow">${GROUPS[g]}</span></td></tr>`;
    for (const c of cs) {
      const b = budgetFor(c.id, m), s = md.byCat[c.id] || 0, avg = prior.length ? sumBy(prior, k => D.months[k].byCat[c.id] || 0) / prior.length : 0;
      const r = b > 0 ? s / b : 0; const cls = b > 0 ? (r > 1 ? 'over' : r > pace + 0.1 && pace < 1 ? 'near' : 'acc') : '';
      rows += `<tr><td style="min-width:150px"><div style="font-weight:600">${esc(c.name)}</div><div class="muted" style="font-size:12px">avg ${money(avg)}${state.rollover[c.id] && +state.budgets[c.id] ? ' · rolls over' : ''}</div>
        ${b > 0 ? `<div class="track" style="margin-top:6px;width:100%;min-width:120px"><div class="fill ${cls}" style="width:${Math.min(100, r * 100).toFixed(1)}%"></div>${pace < 1 && pace > 0 ? `<span class="pace" style="left:${(pace * 100).toFixed(1)}%"></span>` : ''}</div>` : ''}</td>
        <td class="r"><input class="input num" style="width:92px;text-align:right" type="number" min="0" step="10" inputmode="decimal" id="b-${c.id}" data-on="change:budget" data-cat="${c.id}" value="${+state.budgets[c.id] || ''}" placeholder="—" aria-label="Budget for ${esc(c.name)}"></td>
        <td class="r num">${money(s)}</td><td class="r num ${b > 0 && b - s < 0 ? 'neg' : ''}">${b > 0 ? money(b - s) : '—'}</td>
        <td class="r"><label class="switch" title="Carry unspent budget into next month" style="justify-content:flex-end"><input type="checkbox" data-on="change:rollover" data-cat="${c.id}"${state.rollover[c.id] ? ' checked' : ''}><span class="hide-m" style="font-size:12px">Roll</span></label></td></tr>`;
    }
  }
  const needs = sumBy(state.categories.filter(c => c.group === 'needs'), c => md.byCat[c.id] || 0), wants = sumBy(state.categories.filter(c => c.group === 'wants' || c.group === 'business'), c => md.byCat[c.id] || 0);
  const savedPct = md.income > 0 ? (md.income - md.spend) / md.income : 0;
  const split = md.income > 0 ? [['Needs', needs / md.income, 0.5], ['Wants', wants / md.income, 0.3], ['Saved', savedPct, 0.2]] : null;
  const html = `
  <div class="grid g3">
    <div class="card kpi"><span class="eyebrow">Budgeted for ${mShort(m)}</span><span class="v total">${money(totB)}</span><span class="d">${money(totS)} spent · ${totB ? Math.round(totS / totB * 100) + '%' : '—'} used${pace < 1 && pace > 0 ? ` · ${Math.round(pace * 100)}% of month gone` : ''}</span></div>
    <div class="card kpi"><span class="eyebrow">Left to assign</span><span class="v total ${incomeRef - totB < 0 ? 'neg' : ''}">${money(incomeRef - totB)}</span><span class="d">Typical income ${money(incomeRef)} minus budgets. Give every dollar a job, including savings.</span></div>
    <div class="card kpi"><span class="eyebrow">Unbudgeted spending</span><span class="v total">${money(unbudgeted)}</span><span class="d">Spent in categories without a budget this month.</span></div>
  </div>
  <div class="card">
    <div class="card-h"><h2>Category budgets</h2><span class="row"><button class="btn sm" data-act="autoBudget" type="button">Fill from 3-month average</button><button class="btn sm ghost" data-act="clearBudget" type="button">Clear all</button></span></div>
    <div class="scrollx"><table class="ltable"><thead><tr><th>Category</th><th class="r">Budget</th><th class="r">Spent</th><th class="r">Left</th><th class="r"><span class="hide-m">Rollover</span></th></tr></thead><tbody>${rows}
    <tr class="totalrow"><td>Total</td><td class="r num">${money(totB)}</td><td class="r num">${money(totS)}</td><td class="r num">${money(totB - totS)}</td><td></td></tr></tbody></table></div>
    <p class="muted" style="font-size:12.5px;margin-top:10px">The thin mark on each bar shows where you should be if spending is even across the month.</p>
  </div>
  <div class="card">
    <div class="card-h"><h2>50 / 30 / 20 check</h2><span class="sub">Share of ${mLabel(m)} income</span></div>
    ${split ? `<div class="bars">${split.map(([n, v, t]) => `<div class="bar-row" style="cursor:default"><span class="nm">${n} <span class="muted">target ${n === 'Saved' ? '≥' : '≤'} ${t * 100}%</span></span><span class="amt num">${Math.round(v * 100)}% ${n === 'Saved' ? (v >= t ? '<span class="pill good">✓ met</span>' : '<span class="pill warn">● below</span>') : (v <= t ? '<span class="pill good">✓ within</span>' : '<span class="pill warn">● above</span>')}</span><div class="track"><div class="fill ${n === 'Saved' ? 'acc' : n === 'Needs' ? 'inc' : ''}" style="width:${clamp(v * 100, 0, 100).toFixed(1)}%"></div><span class="pace" style="left:${t * 100}%"></span></div></div>`).join('')}</div>` : '<div class="empty">Record income for this month to see the split.</div>'}
  </div>`;
  return { html };
}

/* =================== CUT LIST =================== */
function vCut() {
  const m = ui.month; const ins = buildInsights(D, m); const rec = detectRecurring();
  const subs = rec.filter(r => r.isSub && !r.ignored); const bills = rec.filter(r => !r.isSub && !r.ignored && r.active);
  const plan = subs.filter(r => state.cancelPlan[r.key]); const planMo = sumBy(plan, 'monthly');
  const potential = sumBy(ins.filter(i => i.yearly > 0), 'yearly');
  const inv = ui.cutMonthly != null ? ui.cutMonthly : Math.round(planMo + potential / 12 * 0.5);
  const ret = (+state.settings.returnRate || 7) / 100;
  const fv = (mo, yrs) => { const r = ret / 12; return mo * ((Math.pow(1 + r, yrs * 12) - 1) / r); };
  const since = addDays(D.latest || TODAY, -90);
  const mer = {}; for (const t of state.transactions) { if (t.excluded || t.date < since || t.amount >= 0) continue; const g = catOf(t.categoryId).group; if (!['needs', 'wants', 'business'].includes(g)) continue; mer[t.merchant] = (mer[t.merchant] || { v: 0, n: 0 }); mer[t.merchant].v += -t.amount; mer[t.merchant].n++; }
  const topM = Object.entries(mer).sort((a, b) => b[1].v - a[1].v).slice(0, 10); const maxM = topM[0] ? topM[0][1].v : 1;
  const dow = [0, 0, 0, 0, 0, 0, 0], dowN = [0, 0, 0, 0, 0, 0, 0]; const seenDays = new Set();
  for (const t of state.transactions) { if (t.excluded || t.date < since || t.amount >= 0) continue; const g = catOf(t.categoryId).group; if (g !== 'wants') continue; const wd = toD(t.date).getDay(); dow[wd] += -t.amount; if (!seenDays.has(t.date)) { seenDays.add(t.date); } }
  for (let d = since; d <= (D.latest || TODAY); d = addDays(d, 1)) dowN[toD(d).getDay()]++;
  const dowAvg = dow.map((v, i) => dowN[i] ? v / dowN[i] : 0); const maxDow = Math.max(...dowAvg, 1);
  const html = `
  <div class="card"><div class="big-save"><div><span class="eyebrow">Realistic savings found</span><div class="v">${money(potential)}<span style="font-size:18px;color:var(--muted)"> /yr</span></div></div><p class="ink2" style="max-width:52ch;font-size:14px">Each item below is sized from your own transactions. Estimates assume partial cuts, not zeroing a category out.</p></div></div>
  <div class="card"><div class="card-h"><h2>What to look at first</h2><span class="sub">Ranked by yearly impact</span></div>${ins.length ? ins.map(insRow).join('') : '<div class="empty">Import a few months of transactions to get suggestions.</div>'}</div>
  <div class="grid g2">
    <div class="card">
      <div class="card-h"><h2>Subscriptions</h2><span class="sub">${money(sumBy(subs.filter(s => s.active), 'monthly'))}/mo active</span></div>
      ${subs.length ? `<div class="scrollx"><table class="ltable"><thead><tr><th>Cancel?</th><th>Service</th><th class="r">Price</th><th class="r">Per year</th><th></th></tr></thead><tbody>${subs.map(s => `<tr${s.active ? '' : ' style="opacity:.55"'}><td><input type="checkbox" style="width:18px;height:18px;accent-color:var(--accent)" data-on="change:cancel" data-key="${esc(s.key)}"${state.cancelPlan[s.key] ? ' checked' : ''} aria-label="Plan to cancel ${esc(s.name)}"></td><td><b>${esc(s.name)}</b><div class="muted" style="font-size:12px">${s.freq} · last ${dShort(s.last)}${s.active ? '' : ' · looks stopped'}${s.priceUp ? ` · <span class="neg">up from ${money(s.priceUp.from, true)}</span>` : ''}</div></td><td class="r num">${money(s.amount, true)}</td><td class="r num">${money(s.yearly)}</td><td class="r"><button class="btn sm ghost" data-act="ignoreRec" data-key="${esc(s.key)}" type="button" title="Not a subscription">Hide</button></td></tr>`).join('')}</tbody></table></div>
      <div class="note" style="margin-top:12px">${plan.length ? `Canceling ${plan.length} saves <b>${money(planMo, true)}/mo</b>, or <b>${money(planMo * 12)}</b> a year.` : 'Tick the ones you would not sign up for again today. Your cancel plan is saved.'}</div>` : '<div class="empty">No subscriptions detected yet. They show up after two or more charges.</div>'}
    </div>
    <div class="card">
      <div class="card-h"><h2>Invest what you cut</h2><span class="sub">at ${state.settings.returnRate || 7}% a year</span></div>
      <label class="f">Monthly amount freed up<input class="input num" type="number" min="0" step="10" id="cutMo" data-on="change:cutMo" value="${inv}"></label>
      <div style="margin-top:12px">${[5, 10, 20, 30].map(y => `<div class="kv"><span>In ${y} years</span><span class="num"><b>${money(fv(inv, y))}</b></span></div>`).join('')}</div>
      <p class="muted" style="font-size:12.5px;margin-top:8px">Growth is an assumption, not a promise. Change the rate in Settings.</p>
    </div>
  </div>
  <div class="grid g2">
    <div class="card"><div class="card-h"><h2>Top merchants</h2><span class="sub">Last 90 days</span></div>
      ${topM.length ? `<div class="bars">${topM.map(([n, o]) => `<div class="bar-row" data-act="searchMerchant" data-q="${esc(n)}" role="button" tabindex="0"><span class="nm">${esc(n)} <span class="muted">· ${o.n}×</span></span><span class="amt num">${money(o.v)}</span><div class="track"><div class="fill" style="width:${(o.v / maxM * 100).toFixed(1)}%"></div></div></div>`).join('')}</div>` : '<div class="empty">No spending in the last 90 days.</div>'}
    </div>
    <div class="card"><div class="card-h"><h2>Wants by weekday</h2><span class="sub">Average per day, last 90 days</span></div>
      <div class="bars">${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((n, i) => `<div class="bar-row" style="cursor:default"><span class="nm">${n}</span><span class="amt num">${money(dowAvg[i])}</span><div class="track"><div class="fill" style="width:${(dowAvg[i] / maxDow * 100).toFixed(1)}%"></div></div></div>`).join('')}</div>
      <p class="muted" style="font-size:12.5px;margin-top:10px">Your heaviest day is ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dowAvg.indexOf(Math.max(...dowAvg))]}. A no-spend rule on that one day is often the easiest single habit change.</p>
    </div>
  </div>
  <div class="card"><div class="card-h"><h2>Recurring bills</h2><span class="sub">${money(sumBy(bills, 'monthly'))}/mo · negotiate or shop these yearly</span></div>
    ${bills.length ? `<div class="scrollx"><table class="ltable"><thead><tr><th>Bill</th><th>Category</th><th class="r">Amount</th><th class="r">Next</th><th></th></tr></thead><tbody>${bills.map(b => `<tr><td><b>${esc(b.name)}</b> <span class="muted" style="font-size:12px">${b.freq}</span></td><td>${esc(catOf(b.cat).name)}</td><td class="r num">${money(b.amount, true)}</td><td class="r">${dShort(b.next)}</td><td class="r"><button class="btn sm ghost" data-act="ignoreRec" data-key="${esc(b.key)}" type="button">Hide</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No recurring bills detected yet.</div>'}
  </div>
  ${businessCard()}`;
  return { html };
}
function businessCard() {
  const y = THIS_MONTH.slice(0, 4); const ytd = state.transactions.filter(t => !t.excluded && t.date.startsWith(y) && (t.business || catOf(t.categoryId).group === 'business' || t.categoryId === 'bizinc'));
  if (!ytd.length) return '';
  const exp = -sumBy(ytd.filter(t => t.amount < 0), 'amount'), inc = sumBy(ytd.filter(t => t.amount > 0), 'amount'); const profit = inc - exp; const rate = (+state.settings.taxRate || 25) / 100;
  return `<div class="card"><div class="card-h"><h2>Business, ${y} to date</h2><span class="sub">Transactions marked business</span></div>
    <div class="kv"><span>Business income</span><span class="num">${money(inc, true)}</span></div><div class="kv"><span>Business expenses</span><span class="num">${money(exp, true)}</span></div>
    <div class="kv"><span><b>Net profit</b></span><span class="num"><b>${money(profit, true)}</b></span></div>
    <div class="kv"><span>Set aside for taxes at ${Math.round(rate * 100)}%</span><span class="num">${money(Math.max(0, profit) * rate, true)}</span></div>
    <p class="muted" style="font-size:12.5px;margin-top:8px">A rule-of-thumb reserve for self-employment and income tax, not tax advice. Export to Excel for your preparer.</p></div>`;
}

/* =================== NET WORTH =================== */
function vWealth() {
  const nw = netWorth(); const assets = sumBy(state.accounts.filter(a => !isLiab(a)), acctBalance), debts = sumBy(state.accounts.filter(isLiab), acctBalance);
  const months = lastNMonths(THIS_MONTH, 12); const series = netWorthSeries(months);
  let groups = '';
  for (const g of Object.keys(ACCT_GROUPS)) {
    const as = state.accounts.filter(a => (ACCT_TYPES[a.type] || {}).group === g); if (!as.length) continue;
    groups += `<div class="group-h"><span class="eyebrow">${ACCT_GROUPS[g]}</span><span class="num muted">${money(sumBy(as, acctBalance) * (g === 'debt' ? -1 : 1))}</span></div>` + as.map(a => {
      const h = a.history || []; const prev = h.length > 1 ? h[h.length - 2].v : null; const stale = h.length ? daysBetween(h[h.length - 1].d, TODAY) : null;
      return `<div class="acct" data-act="editAcct" data-id="${a.id}" role="button" tabindex="0" style="cursor:pointer"><span style="min-width:0"><b>${esc(a.name)}</b><div class="t2">${esc(ACCT_TYPES[a.type].label)}${a.institution ? ' · ' + esc(a.institution) : ''}${isLiab(a) && a.apr ? ' · ' + a.apr + '% APR' : ''}${a.type === 'credit' && +a.limit ? ' · ' + money(acctBalance(a)) + ' of ' + money(+a.limit) + ' used <span class="pill ' + utilCls(acctBalance(a) / a.limit) + '">' + Math.round(acctBalance(a) / a.limit * 100) + '%</span>' : ''}${stale != null && stale > 35 ? ' · <span class="neg">updated ' + stale + ' days ago</span>' : ''}</div></span>
      <span class="num muted" style="font-size:12.5px">${prev != null ? signedMoney(acctBalance(a) - prev).replace(/\.\d\d$/, '') : ''}</span><span class="num"><b>${isLiab(a) && acctBalance(a) > 0.004 ? '−' : ''}${money(acctBalance(a), true)}</b></span></div>`;
    }).join('');
  }
  const ret = state.accounts.filter(a => a.type === 'k401' || a.type === 'roth' || a.type === 'ira');
  const ira = sumBy(ret.filter(a => a.type !== 'k401'), a => +a.contribYTD || 0); const k = sumBy(ret.filter(a => a.type === 'k401'), a => +a.contribYTD || 0);
  const paysLeft = (payDates(TODAY, THIS_MONTH.slice(0, 4) + '-12-31') || []).length || Math.max(1, 12 - +THIS_MONTH.slice(5));
  const inv = state.accounts.filter(isInvest); const holdings = inv.flatMap(a => (a.holdings || []).map(h => ({ ...h, acct: a.name, value: (+h.shares || 0) * (+h.price || 0) })));
  const byClass = {}; for (const h of holdings) byClass[h.cls || 'Other'] = (byClass[h.cls || 'Other'] || 0) + h.value;
  for (const a of inv) if (!(a.holdings || []).length && +a.balance) byClass['Not broken down'] = (byClass['Not broken down'] || 0) + (+a.balance);
  const invTotal = sumBy(Object.values(byClass), x => x); const withEr = holdings.filter(h => h.er !== '' && h.er != null && !isNaN(+h.er));
  const erVal = sumBy(withEr, 'value'); const wEr = erVal ? sumBy(withEr, h => h.value * (+h.er)) / erVal : null;
  const pricey = withEr.filter(h => +h.er >= 0.4);
  const html = `
  <div class="grid g3">
    <div class="card kpi"><span class="eyebrow">Net worth</span><span class="v total">${money(nw)}</span><span class="d">${state.accounts.length} accounts</span></div>
    <div class="card kpi"><span class="eyebrow">Assets</span><span class="v total">${money(assets)}</span><span class="d">Cash, investments, property</span></div>
    <div class="card kpi"><span class="eyebrow">Owed</span><span class="v total ${debts > 0 ? 'neg' : ''}">${money(debts)}</span><span class="d">${(() => { const cs = state.accounts.filter(a => a.type === 'credit' && +a.limit); if (!cs.length) return 'Cards and loans'; const u = sumBy(cs, acctBalance) / sumBy(cs, a => +a.limit); return `Card utilization <span class="pill ${utilCls(u)}">${Math.round(u * 100)}%</span> · aim for under 10%`; })()}</span></div>
  </div>
  <div class="grid g2">
    <div class="card"><div class="card-h"><h2>Accounts</h2><span class="row"><button class="btn sm" data-act="addAcct" type="button">${ico('plus', 14)} Add account</button></span></div>${groups || '<div class="empty">Add your checking, cards, loans, 401(k), Roth IRA and brokerage accounts to track net worth.</div>'}
      <p class="muted" style="font-size:12.5px;margin-top:10px">Tap an account to update its balance or holdings. Each update adds a point to your net worth history.</p></div>
    <div class="card"><div class="card-h"><h2>Net worth over time</h2></div><div class="chartbox tall"><canvas id="nwChart2" aria-label="Net worth history"></canvas></div></div>
  </div>
  <div class="grid g2">
    <div class="card"><div class="card-h"><h2>Retirement contributions</h2><span class="sub">2026 IRS limits, under age 50</span></div>
      ${ret.length ? [['401(k) / 403(b)', k, LIMITS_2026.k401], ['IRA (Roth + traditional combined)', ira, LIMITS_2026.ira]].map(([n, v, L]) => `<div style="margin-bottom:14px"><div class="row between"><b>${n}</b><span class="num">${money(v)} of ${money(L)}</span></div><div class="progress" style="margin-top:6px"><i style="width:${clamp(v / L * 100, 0, 100).toFixed(1)}%"></i></div><div class="muted" style="font-size:12.5px;margin-top:5px">${v >= L ? 'Maxed for the year.' : `${money(L - v)} of room left · about ${money((L - v) / paysLeft)} per paycheck${n.startsWith('IRA') ? ' (IRA contributions for 2026 are allowed until the April 2027 tax deadline)' : ' through December'}`}</div></div>`).join('') : '<div class="empty">Add a 401(k) or IRA account to track contributions against the limits.</div>'}
    </div>
    <div class="card"><div class="card-h"><h2>Investment mix</h2><span class="sub">${money(invTotal)} invested</span></div>
      ${invTotal ? `<div class="bars">${Object.entries(byClass).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div class="bar-row" style="cursor:default"><span class="nm">${esc(c)}</span><span class="amt num">${money(v)} <span class="muted">${Math.round(v / invTotal * 100)}%</span></span><div class="track"><div class="fill acc" style="width:${(v / invTotal * 100).toFixed(1)}%"></div></div></div>`).join('')}</div>
      <div style="margin-top:14px">${wEr != null ? `<div class="kv"><span>Weighted expense ratio</span><span class="num">${wEr.toFixed(3)}%</span></div><div class="kv"><span>Fees per year at this balance</span><span class="num">${money(erVal * wEr / 100, true)}</span></div>` : ''}
      ${pricey.length ? `<div class="note warn" style="margin-top:8px">${pricey.map(h => `<b>${esc(h.sym)}</b> charges ${(+h.er).toFixed(2)}%`).join(', ')}. Over 30 years a 0.75% fee can eat roughly a fifth of the ending balance compared with a 0.05% index fund.</div>` : withEr.length ? '<div class="muted" style="font-size:12.5px;margin-top:6px">No high-fee funds found among holdings with an expense ratio entered.</div>' : '<div class="muted" style="font-size:12.5px;margin-top:6px">Add expense ratios to holdings to see what fees cost you.</div>'}</div>` : '<div class="empty">Add investment accounts and holdings (or import a positions CSV) to see your mix.</div>'}
    </div>
  </div>`;
  return { html, after() { const st = Math.max(0, series.findIndex(v => v != null)); lineChart('nwChart2', months.slice(st).map(mShort), series.slice(st), 'Net worth', cv('--accent'), true); } };
}

/* =================== PLAN =================== */
function vPlan() {
  const fc = forecast(60);
  const inc6 = fullMonthsBefore(D, THIS_MONTH, 6).map(k => D.months[k].income).filter(v => v > 0);
  const avgI = inc6.length ? sumBy(inc6, x => x) / inc6.length : 0, minI = inc6.length ? Math.min(...inc6) : 0, maxI = inc6.length ? Math.max(...inc6) : 0;
  const spend6 = fullMonthsBefore(D, THIS_MONTH, 6).map(k => D.months[k].spend); const avgS = spend6.length ? sumBy(spend6, x => x) / spend6.length : 0;
  const cash = sumBy(state.accounts.filter(a => a.type === 'checking' || a.type === 'savings' || a.type === 'cash'), acctBalance);
  const debts = state.accounts.filter(a => isLiab(a) && acctBalance(a) > 0).map(a => ({ name: a.name, bal: acctBalance(a), apr: +a.apr || 0, min: +a.minPay || Math.max(25, acctBalance(a) * 0.02) }));
  const av = debts.length ? simulateDebts(debts, ui.debtExtra, 'avalanche') : null, sb = debts.length ? simulateDebts(debts, ui.debtExtra, 'snowball') : null, base = debts.length ? simulateDebts(debts, 0, 'avalanche') : null;
  const invested = sumBy(state.accounts.filter(isInvest), acctBalance);
  const savedAvg = fullMonthsBefore(D, THIS_MONTH, 6).length ? sumBy(fullMonthsBefore(D, THIS_MONTH, 6), k => D.months[k].saved) / fullMonthsBefore(D, THIS_MONTH, 6).length : 0;
  const fiContrib = ui.fi.contrib != null ? ui.fi.contrib : Math.round(savedAvg); const fiRet = ui.fi.ret != null ? ui.fi.ret : (+state.settings.returnRate || 7); const fiSpend = ui.fi.spend != null ? ui.fi.spend : Math.round(avgS * 12);
  const fiNum = fiSpend * (+state.settings.fiMultiple || 25);
  let bal = invested, yrs = null; const proj = [Math.round(bal)]; for (let mth = 1; mth <= 600; mth++) { bal = bal * (1 + fiRet / 100 / 12) + fiContrib; if (mth % 12 === 0) proj.push(Math.round(bal)); if (yrs == null && bal >= fiNum) yrs = mth / 12; if (mth >= 480 && yrs != null) break; }
  const age = +state.settings.age || null;
  const goals = state.goals.map(g => { const saved = g.linked ? acctBalance(state.accounts.find(a => a.id === g.linked) || { balance: 0 }) : +g.saved || 0; const months = g.date ? Math.max(1, (+g.date.slice(0, 4) - +TODAY.slice(0, 4)) * 12 + (+g.date.slice(5, 7) - +TODAY.slice(5, 7))) : null; return { ...g, savedNow: saved, need: months ? Math.max(0, (g.target - saved) / months) : null, months }; });
  const html = `
  <div class="card"><div class="card-h"><h2>Cash forecast</h2><span class="sub">Checking balance, next 60 days</span></div>
    ${fc ? `<div class="grid g3" style="margin-bottom:12px">
      <div class="kpi"><span class="eyebrow">Today</span><span class="v" style="font-size:24px">${money(fc.start)}</span></div>
      <div class="kpi"><span class="eyebrow">Lowest point</span><span class="v ${fc.low.v < 0 ? 'neg' : ''}" style="font-size:24px">${money(fc.low.v)}</span><span class="d">${dLabel(fc.low.d)} ${fc.low.v < (+state.settings.buffer || 0) ? '<span class="pill bad">▲ below buffer</span>' : '<span class="pill good">✓ covered</span>'}</span></div>
      <div class="kpi"><span class="eyebrow">Day-to-day spending</span><span class="v" style="font-size:24px">${money(fc.daily)}<span class="muted" style="font-size:14px">/day</span></span><span class="d">Average of non-bill spending, last 60 days</span></div></div>
    <div class="chartbox"><canvas id="fcChart" aria-label="Projected checking balance"></canvas></div>
    <details style="margin-top:10px"><summary class="ink2" style="cursor:pointer;font-size:14px">Scheduled items in this forecast (${fc.events.length})</summary>${fc.events.slice(0, 40).map(e => `<div class="kv"><span>${dShort(e.date)} · ${esc(e.name)}</span><span class="num ${e.amount > 0 ? 'pos' : ''}">${signedMoney(e.amount)}</span></div>`).join('')}</details>
    <p class="muted" style="font-size:12.5px;margin-top:8px">Built from detected bills, your paycheck schedule (Settings)${fc.extraDaily ? ', your average commission and other irregular income' : ''}, and your usual daily spending.</p>` : '<div class="empty">Add a checking account with a balance to project cash flow.</div>'}
  </div>
  <div class="grid g2">
    <div class="card"><div class="card-h"><h2>Income stability</h2><span class="sub">Last ${inc6.length} full months</span></div>
      ${inc6.length ? `<div class="kv"><span>Average month</span><span class="num">${money(avgI)}</span></div><div class="kv"><span>Leanest month</span><span class="num">${money(minI)}</span></div><div class="kv"><span>Best month</span><span class="num">${money(maxI)}</span></div><div class="kv"><span>Swing</span><span class="num">${avgI ? Math.round((maxI - minI) / avgI * 100) : 0}%</span></div>
      <div class="note" style="margin-top:10px">${maxI - minI > avgI * 0.2 ? `Your income moves around. Budget on the leanest month (<b>${money(minI)}</b>) and send anything above it to savings or debt when it lands.` : 'Your income is steady, so a fixed monthly budget works well.'}</div>
      <div class="kv" style="margin-top:8px"><span>Emergency runway</span><span class="num"><b>${avgS ? (cash / avgS).toFixed(1) : '—'} months</b></span></div>` : '<div class="empty">Needs at least one full month of income.</div>'}
    </div>
    <div class="card"><div class="card-h"><h2>Goals</h2><button class="btn sm" data-act="addGoal" type="button">${ico('plus', 14)} Add goal</button></div>
      ${goals.length ? goals.map(g => `<div style="margin-bottom:14px" data-act="editGoal" data-id="${g.id}" role="button" tabindex="0"><div class="row between"><b>${esc(g.name)}</b><span class="num">${money(g.savedNow)} of ${money(g.target)}</span></div><div class="progress" style="margin-top:6px"><i style="width:${clamp(g.savedNow / Math.max(1, g.target) * 100, 0, 100).toFixed(1)}%"></i></div><div class="muted" style="font-size:12.5px;margin-top:5px">${g.savedNow >= g.target ? 'Reached.' : g.need != null ? `${money(g.need)}/mo to hit it by ${toD(g.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : 'No target date'}${g.linked ? ' · tracks ' + esc(acctName(g.linked)) : ''}</div></div>`).join('') : '<div class="empty">Set a goal: emergency fund, down payment, a business launch fund.</div>'}
    </div>
  </div>
  <div class="card"><div class="card-h"><h2>Debt payoff</h2><span class="sub">Avalanche pays highest APR first; snowball pays smallest balance first</span></div>
    ${debts.length ? `<div class="row" style="margin-bottom:12px"><label class="f" style="flex-direction:row;align-items:center;gap:8px">Extra per month <input class="input num" type="number" min="0" step="25" id="debtExtra" style="width:110px" value="${ui.debtExtra}" data-on="change:debtExtra"></label></div>
    <div class="grid g3" style="margin-bottom:12px">${[['Minimums only', base], ['Avalanche', av], ['Snowball', sb]].map(([n, r]) => `<div class="kpi" style="padding:12px;border:1px solid var(--line);border-radius:12px"><span class="eyebrow">${n}</span><span class="v" style="font-size:22px">${r.never ? 'Never' : (r.months / 12).toFixed(1) + ' yrs'}</span><span class="d">${money(r.interest)} interest${n === 'Avalanche' && base && !base.never ? ` · saves <b>${money(base.interest - r.interest)}</b>` : ''}</span></div>`).join('')}</div>
    <div class="chartbox"><canvas id="debtChart" aria-label="Debt balance over time by strategy"></canvas></div>
    <div class="legend"><span><i style="background:var(--inc)"></i>Avalanche</span><span><i style="background:var(--spend)"></i>Snowball</span></div>
    <div style="margin-top:12px"><span class="eyebrow">Avalanche payoff order</span>${av.order.map((d, i) => `<div class="kv"><span>${i + 1}. ${esc(d.name)} <span class="muted">${d.apr}% · ${money(debts.find(x => x.name === d.name).bal)}</span></span><span>${d.paidOff ? toD(addMonthsDate(TODAY, d.paidOff)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}</span></div>`).join('')}</div>` : '<div class="empty">No debts with balances. Add cards and loans (with APR and minimum payment) in Net worth.</div>'}
  </div>
  <div class="card"><div class="card-h"><h2>Financial independence</h2><span class="sub">When investments could cover your spending</span></div>
    <div class="form" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      <label class="f">Invested now<input class="input num" value="${money(invested)}" disabled></label>
      <label class="f">Add per month<input class="input num" type="number" min="0" step="50" id="fiC" value="${fiContrib}" data-on="change:fiC"></label>
      <label class="f">Return per year %<input class="input num" type="number" min="0" max="15" step="0.5" id="fiR" value="${fiRet}" data-on="change:fiR"></label>
      <label class="f">Yearly spending<input class="input num" type="number" min="0" step="1000" id="fiS" value="${fiSpend}" data-on="change:fiS"></label>
    </div>
    <div class="grid g3" style="margin:14px 0">
      <div class="kpi"><span class="eyebrow">FI number</span><span class="v" style="font-size:24px">${money(fiNum)}</span><span class="d">${state.settings.fiMultiple || 25}× yearly spending (the 4% rule)</span></div>
      <div class="kpi"><span class="eyebrow">Time to get there</span><span class="v" style="font-size:24px">${yrs != null ? yrs.toFixed(1) + ' yrs' : '50+ yrs'}</span><span class="d">${yrs != null && age ? 'around age ' + Math.round(age + yrs) : 'Add your age in Settings to see the year'}</span></div>
      <div class="kpi"><span class="eyebrow">+$100/mo more</span><span class="v" style="font-size:24px">${(() => { let b = invested, y = null; for (let i = 1; i <= 600; i++) { b = b * (1 + fiRet / 100 / 12) + fiContrib + 100; if (b >= fiNum) { y = i / 12; break; } } return y != null && yrs != null ? '−' + Math.max(0, yrs - y).toFixed(1) + ' yrs' : '—'; })()}</span><span class="d">How much sooner</span></div>
    </div>
    <div class="chartbox"><canvas id="fiChart" aria-label="Projected investments vs FI number"></canvas></div>
    <div class="legend"><span><i style="background:var(--accent)"></i>Projected investments</span><span><i style="background:var(--muted)"></i>FI number</span></div>
  </div>`;
  return {
    html, after() {
      if (fc) { const o = chartBase(); const lowI = fc.series.findIndex(p => p.d === fc.low.d); mkChart('fcChart', { type: 'line', data: { labels: fc.series.map(p => dShort(p.d)), datasets: [{ label: 'Balance', data: fc.series.map(p => p.v), borderColor: cv('--inc'), backgroundColor: alpha(cv('--inc'), .1), fill: 'origin', tension: .2, borderWidth: 2, pointRadius: fc.series.map((p, i) => i === lowI ? 5 : 0), pointBackgroundColor: cv('--bad'), pointBorderColor: cv('--surface'), pointBorderWidth: 2 }] }, options: { ...o, scales: { ...o.scales, x: { ...o.scales.x, ticks: { ...o.scales.x.ticks, maxTicksLimit: 6 } } } } }); }
      if (av) { const n = Math.max(av.series.length, sb.series.length); const labels = Array.from({ length: n }, (_, i) => i % 12 === 0 ? 'Yr ' + i / 12 : ''); const o = chartBase(); mkChart('debtChart', { type: 'line', data: { labels, datasets: [{ label: 'Avalanche', data: av.series, borderColor: cv('--inc'), borderWidth: 2, pointRadius: 0, tension: .2 }, { label: 'Snowball', data: sb.series, borderColor: cv('--spend'), borderWidth: 2, pointRadius: 0, tension: .2, borderDash: [6, 4] }] }, options: { ...o, scales: { ...o.scales, x: { ...o.scales.x, ticks: { ...o.scales.x.ticks, autoSkip: false, callback: (v, i) => labels[i] } } } } }); }
      const hz = yrs != null ? Math.min(proj.length, Math.max(11, Math.ceil(yrs) + 6)) : proj.length; const pj = proj.slice(0, hz); const labels = pj.map((_, i) => 'Yr ' + i); const o = chartBase();
      mkChart('fiChart', { type: 'line', data: { labels, datasets: [{ label: 'Projected', data: pj, borderColor: cv('--accent'), backgroundColor: alpha(cv('--accent'), .1), fill: 'origin', borderWidth: 2, pointRadius: 0, tension: .2 }, { label: 'FI number', data: pj.map(() => fiNum), borderColor: cv('--muted'), borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0 }] }, options: { ...o, scales: { ...o.scales, x: { ...o.scales.x, ticks: { ...o.scales.x.ticks, maxTicksLimit: 8 } } } } });
    }
  };
}

/* =================== ASK CLAUDE =================== */
function vAsk() {
  const avail = !!SAMPLE;
  const chips = ['Where can I cut $300 a month?', 'Am I on track for retirement at my savings rate?', 'Which debt should I pay off first, and why?', 'Explain my spending this month like a CFO would', 'Build me a realistic budget from my last 3 months', 'How big should my emergency fund be?'];
  const msgs = ui.chat.map(t => `<div class="msg ${t.role === 'user' ? 'u' : 'a'}">${t.role === 'user' ? esc(t.content) : md2html(t.content)}</div>`).join('');
  const html = `<div class="card"><div class="card-h"><h2>Ask Claude about your money</h2><span class="sub">Claude reads a summary of your ledger, never your bank login</span></div>
    ${avail ? '' : '<div class="note warn">Asking Claude is available when this page is opened in Claude while signed in.</div>'}
    <div class="chips" style="margin-top:8px">${chips.map(c => `<button class="chip" type="button" data-act="askChip" data-q="${esc(c)}"${avail ? '' : ' disabled'}>${esc(c)}</button>`).join('')}</div></div>
    <div class="chat" id="chat">${msgs || '<div class="empty">Ask anything: affordability, trade-offs, a plan for a windfall, how to handle a lumpy commission month.</div>'}</div>
    <div class="composer"><textarea class="input" id="askBox" rows="2" placeholder="Can I afford a $450/mo car payment?"${avail ? '' : ' disabled'}></textarea><button class="btn primary" data-act="ask" type="button"${avail && !ui.busy ? '' : ' disabled'}>${ui.busy ? '<span class="spin"></span>' : 'Ask'}</button></div>
    <p class="muted" style="font-size:12px">Answers are general education, not personalized financial, tax or legal advice.</p>`;
  return { html };
}
function md2html(s) {
  const lines = String(s || '').split('\n'); let h = '', inList = false;
  const inline = x => esc(x).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
  for (const l of lines) {
    const li = l.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (li) { if (!inList) { h += '<ul>'; inList = true; } h += `<li>${inline(li[1])}</li>`; continue; }
    if (inList) { h += '</ul>'; inList = false; }
    const hd = l.match(/^#{1,4}\s+(.*)/); if (hd) { h += `<p><b>${inline(hd[1])}</b></p>`; continue; }
    if (l.trim()) h += `<p>${inline(l)}</p>`;
  }
  if (inList) h += '</ul>'; return h;
}
function ledgerContext() {
  const ms = D.list.slice(-6); const lines = [];
  lines.push('Today: ' + TODAY + '. Currency USD. Amounts are monthly totals from the user\'s own imported transactions.');
  for (const m of ms) { const md = D.months[m]; const cats = Object.entries(md.byCat).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([c, v]) => catOf(c).name + ' ' + Math.round(v)).join(', '); lines.push(`${m}${m === THIS_MONTH ? ' (month in progress)' : ''}: income ${Math.round(md.income)}, spending ${Math.round(md.spend)}, moved to savings/investing ${Math.round(md.saved)}. By category: ${cats}`); }
  lines.push('Accounts: ' + state.accounts.map(a => `${a.name} [${ACCT_TYPES[a.type].label}] ${isLiab(a) ? 'owes ' : ''}${Math.round(acctBalance(a))}${a.apr ? ' at ' + a.apr + '% APR' : ''}${a.minPay ? ', min ' + a.minPay : ''}${a.contribYTD ? ', contributed YTD ' + a.contribYTD : ''}`).join('; '));
  lines.push('Net worth: ' + Math.round(netWorth()));
  const rec = detectRecurring().filter(r => r.active && !r.ignored); lines.push('Recurring charges: ' + rec.map(r => `${r.name} ${r.amount} ${r.freq}${r.isSub ? ' (subscription)' : ''}`).join('; '));
  const b = Object.entries(state.budgets).filter(([, v]) => +v > 0); if (b.length) lines.push('Monthly budgets: ' + b.map(([c, v]) => catOf(c).name + ' ' + v).join(', '));
  if (state.goals.length) lines.push('Goals: ' + state.goals.map(g => `${g.name} target ${g.target} by ${g.date || 'no date'}`).join('; '));
  const p = state.settings.pay; if (p && p.amount) lines.push(`Paycheck: ${p.amount} ${p.freq}, next ${p.next}.`);
  if (state.settings.age) lines.push('Age: ' + state.settings.age);
  const ins = buildInsights(D, THIS_MONTH).slice(0, 8); if (ins.length) lines.push('Detected issues: ' + ins.map(i => i.title).join('; '));
  lines.push('2026 limits: 401(k) employee deferral 24,500; IRA 7,500 (under 50).');
  return lines.join('\n').slice(0, 24000);
}
async function askClaude(q) {
  if (!SAMPLE || ui.busy || !q.trim()) return;
  ui.chat.push({ role: 'user', content: q.trim() }); ui.chat.push({ role: 'assistant', content: '…' }); ui.busy = true; render(); scrollChat();
  const rules = 'You are a sharp, plain-spoken personal finance coach inside a budgeting app. Use the ledger below. Be specific with the user\'s own numbers, show quick math, and give a short ranked action list. Keep it under 250 words unless asked for more. Say when something depends on facts you do not have. You are not a licensed advisor; do not recommend specific securities.\n\nLEDGER\n' + ledgerContext();
  const turns = [{ role: 'user', content: rules }, ...ui.chat.slice(0, -1).slice(-10)];
  const bubble = () => $$('#chat .msg.a').pop();
  try {
    const { text } = await SAMPLE(turns, { cache: false, onText: ({ text }) => { ui.chat[ui.chat.length - 1].content = text; const b = bubble(); if (b) b.innerHTML = md2html(text); } });
    ui.chat[ui.chat.length - 1].content = text;
  } catch (e) {
    ui.chat[ui.chat.length - 1].content = (e && e.text ? e.text + '\n\n' : '') + (e && e.code === 'not_granted' ? 'Claude was not allowed for this page. Allow it to use this feature.' : e && e.code === 'rate_limited' ? 'You have hit a usage limit. Try again in a bit.' : 'That did not go through. Try again.');
    if (e && (e.code === 'not_granted' || e.code === 'sampling_disabled')) SAMPLE = null;
  }
  ui.busy = false; render(); scrollChat();
}
function scrollChat() { const c = $('#chat'); if (c) c.lastElementChild && c.lastElementChild.scrollIntoView({ block: 'end', behavior: REDUCED ? 'auto' : 'smooth' }); }
async function aiCategorize() {
  const unc = state.transactions.filter(t => t.categoryId === 'uncat');
  if (!unc.length) { toast('Nothing left to categorize.'); return; }
  if (!SAMPLE) { toast('Open this page in Claude while signed in to use auto-categorize.'); return; }
  const byM = {}; for (const t of unc) { if (!byM[t.merchant]) byM[t.merchant] = { d: t.desc, a: t.amount }; }
  const names = Object.keys(byM).slice(0, 150);
  const cats = state.categories.filter(c => c.id !== 'uncat').map(c => `${c.id} = ${c.name} (${GROUPS[c.group]})`).join('\n');
  const prompt = `Assign each merchant to one category id from this list:\n${cats}\n\nReply with only a JSON object mapping each merchant name exactly as given to a category id, e.g. {"Blue Copper": "coffee"}. Use "uncat" only if truly unknowable. Positive amounts are money in.\n\nMerchants (name | raw bank text | sample amount):\n` + names.map(n => `${n} | ${byM[n].d} | ${byM[n].a}`).join('\n');
  toast('Claude is sorting ' + names.length + ' merchants…');
  try {
    const map = await SAMPLE.json(prompt, { modelTier: 'quick' });
    let n = 0; const months = new Set();
    for (const name of names) { const c = map && map[name]; if (!c || !CATMAP[c] || c === 'uncat') continue; state.rules.push({ id: uid(), text: name, categoryId: c, business: false, auto: true }); for (const t of unc) if (t.merchant === name) { t.categoryId = c; n++; months.add(mKey(t.date)); } }
    touch(true, [...months]); render(); toast(`Categorized ${n} transactions and saved ${names.length} rules for next time.`);
  } catch (e) { toast(e && e.code === 'not_granted' ? 'Claude was not allowed for this page.' : 'Auto-categorize did not finish. Try again.'); }
}

/* =================== SETTINGS =================== */
function vSettings() {
  const s = state.settings; const p = s.pay || {};
  const html = `
  <div class="grid g2">
    <div class="card"><div class="card-h"><h2>Paycheck</h2><span class="sub">Drives safe-to-spend and the forecast</span></div>
      <div class="form">
        <label class="f">How often<select class="input" id="payFreq" data-on="change:setPay"><option value="weekly"${p.freq === 'weekly' ? ' selected' : ''}>Weekly</option><option value="biweekly"${p.freq === 'biweekly' ? ' selected' : ''}>Every 2 weeks</option><option value="semimonthly"${p.freq === 'semimonthly' ? ' selected' : ''}>1st & 15th</option><option value="monthly"${p.freq === 'monthly' ? ' selected' : ''}>Monthly</option></select></label>
        <label class="f">Next payday<input class="input" type="date" id="payNext" value="${esc(p.next || '')}" data-on="change:setPay"></label>
        <label class="f">Base take-home per check<input class="input num" type="number" min="0" step="10" id="payAmt" value="${+p.amount || ''}" data-on="change:setPay"></label>
        <label class="f">Cash buffer to keep<input class="input num" type="number" min="0" step="50" id="setBuffer" value="${s.buffer}" data-on="change:setNum" data-k="buffer"></label>
        <label class="f">Tax set-aside on business profit %<input class="input num" type="number" min="0" max="60" id="setTax" value="${s.taxRate}" data-on="change:setNum" data-k="taxRate"></label>
        <label class="f">Expected investment return %<input class="input num" type="number" min="0" max="15" step="0.5" id="setRet" value="${s.returnRate}" data-on="change:setNum" data-k="returnRate"></label>
        <label class="f">Your age (optional)<input class="input num" type="number" min="14" max="100" id="setAge" value="${esc(s.age)}" data-on="change:setNum" data-k="age"></label>
      </div>
      <p class="muted" style="font-size:12.5px;margin-top:10px">Commission or tips on top of base pay are picked up automatically from your history.</p>
    </div>
    <div class="card"><div class="card-h"><h2>Your data</h2></div>
      <div class="stack">
        <div class="row"><button class="btn" data-act="exportCSV" type="button">Export transactions (CSV)</button><button class="btn" data-act="exportXLSX" type="button">Export workbook (Excel)</button></div>
        <div class="row"><button class="btn" data-act="exportJSON" type="button">Download full backup</button><button class="btn" data-act="import" type="button">Restore a backup</button></div>
        <div class="row"><button class="btn ghost" data-act="loadDemo" type="button">Show example data</button><button class="btn danger" data-act="wipe" type="button">Erase everything</button></div>
        <div class="note">${Store.mode === 'cloud' ? 'Your ledger is stored in your private space on this page, tied to your Claude account. People you share the link with cannot see it.' : Store.mode === 'local' ? 'Your ledger is stored in this browser only. Download a backup now and then.' : 'Storage is not available in this view, so changes last only until you close the page. Download a backup.'}</div>
      </div>
    </div>
  </div>
  <div class="card"><div class="card-h"><h2>Connecting banks, 401(k)s and IRAs</h2></div>
    <div class="stack ink2" style="font-size:14px;max-width:80ch">
      <p><b>Works with every bank today:</b> download a CSV, Excel, OFX/QFX or PDF statement from your bank, card, 401(k) or brokerage and import it here. Ledgerline cleans merchant names, categorizes, and skips duplicates, so overlapping downloads are safe. For holdings, export "Positions" from Fidelity, Schwab, Vanguard or your 401(k) site.</p>
      <p><b>Live sync:</b> automatic bank sync needs a server that holds a secure connection token, which a page like this cannot keep safely. Two options: a SimpleFIN Bridge account (about $15 a year, read-only, US and Canada) with a small sync script, or a Plaid-based version that runs on its own server. Ask Claude to build either one and point it at this ledger.</p>
      <p><b>Privacy:</b> this page never asks for bank usernames or passwords. Don't paste them anywhere in it.</p>
    </div>
  </div>
  <div class="grid g2">
    <div class="card"><div class="card-h"><h2>Categories</h2><button class="btn sm" data-act="addCat" type="button">${ico('plus', 14)} Add</button></div>
      <div class="stack" style="gap:6px">${state.categories.filter(c => c.id !== 'uncat').map(c => `<div class="row" style="flex-wrap:nowrap"><input class="input" style="flex:1" id="cn-${c.id}" value="${esc(c.name)}" data-on="change:catName" data-id="${c.id}" aria-label="Category name"><select class="input" style="width:150px" id="cg-${c.id}" data-on="change:catGroup" data-id="${c.id}" aria-label="Category group">${Object.keys(GROUPS).map(g => `<option value="${g}"${c.group === g ? ' selected' : ''}>${GROUPS[g]}</option>`).join('')}</select></div>`).join('')}</div>
    </div>
    <div class="card"><div class="card-h"><h2>Rules</h2><span class="sub">${state.rules.length} saved · run before built-in matching</span></div>
      ${state.rules.length ? state.rules.map(r => `<div class="kv"><span>“${esc(r.text)}” → <b>${esc(catOf(r.categoryId).name)}</b>${r.business ? ' <span class="tag biz">BIZ</span>' : ''}${r.auto ? ' <span class="tag">by Claude</span>' : ''}</span><button class="btn sm ghost" data-act="delRule" data-id="${r.id}" type="button">Remove</button></div>`).join('') + `<div style="margin-top:10px"><button class="btn sm" data-act="rerunRules" type="button">Re-apply rules to all transactions</button></div>` : '<div class="empty">Rules appear when you tick "Always categorize" while editing a transaction.</div>'}
    </div>
  </div>`;
  return { html };
}

/* =================== SHEETS =================== */
function openSheet(title, body, foot, opts = {}) {
  $('#sheetRoot').innerHTML = `<div class="sheet-bg" data-act="sheetBg"><div class="sheet${opts.wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-h"><h2>${esc(title)}</h2><button class="iconbtn" data-act="closeSheet" type="button" aria-label="Close">${ico('x')}</button></div><div class="sheet-b">${body}</div><div class="sheet-f"${foot ? '' : ' hidden'}>${foot || ''}</div></div></div>`;
  const f = $('#sheetRoot input:not([type=hidden]):not([disabled]), #sheetRoot select, #sheetRoot textarea'); if (f && !opts.noFocus && window.innerWidth > 860) f.focus();
}
function closeSheet() { $('#sheetRoot').innerHTML = ''; ui.imp = null; }

function txSheet(t) {
  const isNew = !t; t = t || { id: '', date: TODAY, desc: '', merchant: '', amount: '', categoryId: 'uncat', accountId: (state.accounts[0] || {}).id || '', notes: '', tags: [], business: false, excluded: false };
  const body = `<div class="form">
    <label class="f">Date<input class="input" type="date" id="eDate" value="${t.date}"></label>
    <label class="f">Amount <span class="muted" style="font-weight:400">(negative = money out)</span><input class="input num" type="number" step="0.01" id="eAmt" value="${t.amount}"></label>
    <label class="f full">Merchant<input class="input" id="eMer" value="${esc(t.merchant)}" placeholder="e.g. Costco"></label>
    ${isNew ? '' : `<div class="full muted" style="font-size:12.5px">Bank text: ${esc(t.desc)}</div>`}
    <label class="f">Category<select class="input" id="eCat">${catOptions(t.categoryId)}</select></label>
    <label class="f">Account<select class="input" id="eAcct">${state.accounts.length ? acctOptions(t.accountId) : '<option value="">Add an account first</option>'}</select></label>
    <label class="f full">Notes<input class="input" id="eNotes" value="${esc(t.notes || '')}" placeholder="What was this for?"></label>
    <label class="f full">Tags <span class="muted" style="font-weight:400">(comma separated)</span><input class="input" id="eTags" value="${esc((t.tags || []).join(', '))}" placeholder="trip-vegas, reimbursable"></label>
    <label class="switch"><input type="checkbox" id="eBiz"${t.business ? ' checked' : ''}> Business expense or income</label>
    <label class="switch"><input type="checkbox" id="eExcl"${t.excluded ? ' checked' : ''}> Exclude from reports</label>
    ${isNew ? '' : `<label class="switch full"><input type="checkbox" id="eRule"> Always categorize “${esc(t.merchant)}” this way (applies to past and future)</label>
    <details class="full"><summary class="ink2" style="cursor:pointer">Split this transaction</summary><div class="row" style="margin-top:8px"><input class="input num" type="number" step="0.01" id="sAmt" placeholder="Amount to split off" style="width:170px"><select class="input" id="sCat">${catOptions('uncat')}</select><button class="btn sm" type="button" data-act="splitTx" data-id="${t.id}">Split</button></div></details>`}
  </div>`;
  const foot = `${isNew ? '' : `<button class="btn danger" data-act="delTx" data-id="${t.id}" type="button" style="margin-right:auto">Delete</button>`}<button class="btn ghost" data-act="closeSheet" type="button">Cancel</button><button class="btn primary" data-act="saveTx" data-id="${t.id}" type="button">${isNew ? 'Add transaction' : 'Save'}</button>`;
  openSheet(isNew ? 'Add transaction' : 'Edit transaction', body, foot);
}
function acctSheet(a) {
  const isNew = !a; a = a || { id: '', name: '', type: 'checking', institution: '', balance: '', apr: '', minPay: '', contribYTD: '', holdings: [] };
  const hold = (a.holdings || []);
  const body = `<div class="form">
    <label class="f">Name<input class="input" id="aName" value="${esc(a.name)}" placeholder="e.g. Chase checking"></label>
    <label class="f">Type<select class="input" id="aType" data-on="change:acctType">${Object.entries(ACCT_TYPES).map(([k, v]) => `<option value="${k}"${a.type === k ? ' selected' : ''}>${v.label}</option>`).join('')}</select></label>
    <label class="f">Institution<input class="input" id="aInst" value="${esc(a.institution || '')}" placeholder="Bank or provider"></label>
    <label class="f">${isLiab(a) ? 'Amount owed' : 'Balance'}${isInvest(a) && hold.length ? ' <span class="muted" style="font-weight:400">(from holdings)</span>' : ''}<input class="input num" type="number" step="0.01" id="aBal" value="${isInvest(a) && hold.length ? round2(holdingsValue(a)) : (a.balance === '' ? '' : a.balance)}"${isInvest(a) && hold.length ? ' disabled' : ''}></label>
    <label class="f" ${isLiab(a) ? '' : 'hidden'} id="aAprW">APR %<input class="input num" type="number" step="0.01" id="aApr" value="${esc(a.apr || '')}"></label>
    <label class="f" ${isLiab(a) ? '' : 'hidden'} id="aMinW">Minimum payment<input class="input num" type="number" step="1" id="aMin" value="${esc(a.minPay || '')}"></label>
    <label class="f" ${a.type === 'credit' ? '' : 'hidden'} id="aLimW">Credit limit<input class="input num" type="number" step="1" min="0" id="aLim" value="${esc(a.limit || '')}"></label>
    <label class="f" ${['k401', 'roth', 'ira'].includes(a.type) ? '' : 'hidden'} id="aConW">Contributed this year<input class="input num" type="number" step="1" id="aCon" value="${esc(a.contribYTD || '')}"></label>
  </div>
  <div id="holdWrap" ${isInvest(a) ? '' : 'hidden'}>
    <div class="row between"><span class="eyebrow">Holdings</span><button class="btn sm" data-act="addHolding" type="button">${ico('plus', 14)} Add holding</button></div>
    <div class="scrollx"><table class="ltable" id="holdTable"><thead><tr><th>Symbol</th><th class="r">Shares</th><th class="r">Price</th><th class="r">Exp. ratio %</th><th>Class</th><th></th></tr></thead><tbody>${hold.map(holdRow).join('')}</tbody></table></div>
    <p class="muted" style="font-size:12.5px">Prices do not update live. Re-import a positions CSV or edit prices when you check your account.</p>
  </div>`;
  const foot = `${isNew ? '' : `<button class="btn danger" data-act="delAcct" data-id="${a.id}" type="button" style="margin-right:auto">Delete</button>`}<button class="btn ghost" data-act="closeSheet" type="button">Cancel</button><button class="btn primary" data-act="saveAcct" data-id="${a.id}" type="button">${isNew ? 'Add account' : 'Save'}</button>`;
  openSheet(isNew ? 'Add account' : a.name, body, foot, { wide: true });
}
function holdRow(h) { return `<tr class="hrow"><td><input class="input" style="width:90px" data-h="sym" value="${esc(h.sym || '')}" aria-label="Symbol"></td><td class="r"><input class="input num" style="width:90px" type="number" step="any" data-h="shares" value="${h.shares ?? ''}" aria-label="Shares"></td><td class="r"><input class="input num" style="width:90px" type="number" step="any" data-h="price" value="${h.price ?? ''}" aria-label="Price"></td><td class="r"><input class="input num" style="width:80px" type="number" step="any" data-h="er" value="${h.er ?? ''}" aria-label="Expense ratio"></td><td><select class="input" data-h="cls" aria-label="Asset class">${ASSET_CLASSES.map(c => `<option${(h.cls || 'Other') === c ? ' selected' : ''}>${c}</option>`).join('')}</select><input type="hidden" data-h="name" value="${esc(h.name || '')}"><input type="hidden" data-h="cost" value="${h.cost || 0}"></td><td><button class="iconbtn" type="button" data-act="rmHolding" aria-label="Remove">${ico('x', 16)}</button></td></tr>`; }
function goalSheet(g) {
  const isNew = !g; g = g || { id: '', name: '', target: '', saved: '', linked: '', date: '' };
  const body = `<div class="form"><label class="f full">Goal<input class="input" id="gName" value="${esc(g.name)}" placeholder="Emergency fund"></label>
    <label class="f">Target amount<input class="input num" type="number" min="0" step="50" id="gT" value="${g.target}"></label><label class="f">Target date<input class="input" type="date" id="gD" value="${g.date || ''}"></label>
    <label class="f">Track an account's balance<select class="input" id="gL"><option value="">No, enter manually</option>${state.accounts.filter(a => !isLiab(a)).map(a => `<option value="${a.id}"${g.linked === a.id ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
    <label class="f">Saved so far<input class="input num" type="number" min="0" step="10" id="gS" value="${g.saved}"></label></div>`;
  openSheet(isNew ? 'Add goal' : 'Edit goal', body, `${isNew ? '' : `<button class="btn danger" data-act="delGoal" data-id="${g.id}" type="button" style="margin-right:auto">Delete</button>`}<button class="btn ghost" data-act="closeSheet" type="button">Cancel</button><button class="btn primary" data-act="saveGoal" data-id="${g.id}" type="button">Save goal</button>`);
}
function moreSheet() {
  openSheet('More', `<div class="stack" style="gap:4px">${navViews().filter(v => !['overview', 'activity', 'cut'].includes(v.id)).map(v => `<button class="navbtn" type="button" data-act="nav" data-v="${v.id}" style="padding:13px 10px">${ico(v.icon, 20)}<span style="font-size:16px">${v.label}</span></button>`).join('')}<button class="navbtn" type="button" data-act="addTx" style="padding:13px 10px">${ico('plus', 20)}<span style="font-size:16px">Add transaction</span></button></div><div class="store-badge" id="storeBadge2"></div>`, '', { noFocus: true });
  const b = $('#storeBadge2'); if (b) b.innerHTML = $('#storeBadge').innerHTML;
}

/* =================== IMPORT WIZARD =================== */
const LIB = (IS_DOM && window.LL_LIB) || { xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', pdf: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js', pdfw: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js' };
const loaded = {};
function loadScript(src) { return loaded[src] || (loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('Could not load a helper library. Check your connection and try again.')); }; document.head.appendChild(s); })); }
function importSheet() {
  ui.imp = { step: 'pick' };
  const body = `<label class="drop" id="drop" for="fileIn"><span>${ico('up', 28)}</span><b>Drop statements here, or tap to choose</b><span class="muted" style="font-size:13px">CSV · Excel (.xlsx/.xls) · OFX/QFX · PDF statements${SAMPLE ? ' · screenshots' : ''} · Ledgerline files (.json)</span></label>
  <input type="file" id="fileIn" multiple hidden accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.ofx,.qfx,.qbo,.pdf,.png,.jpg,.jpeg,.webp,.json">
  <details><summary class="ink2" style="cursor:pointer;font-weight:600">Paste from Google Sheets or Excel</summary><p class="muted" style="font-size:13px;margin:6px 0">Select the cells (include the header row) and copy, then paste below.</p><textarea class="input" id="pasteBox" rows="5" style="width:100%" placeholder="Date	Description	Amount"></textarea><div style="margin-top:8px"><button class="btn sm" type="button" data-act="usePaste">Use pasted rows</button></div></details>
  <details><summary class="ink2" style="cursor:pointer;font-weight:600">Where to find the download at your bank</summary><div class="stack" style="font-size:13.5px;margin-top:8px;gap:6px">
    <div><b>Most banks and cards:</b> open the account, find Activity or Statements, then Download or Export. Choose CSV, Excel, or Quicken/QFX.</div>
    <div><b>401(k), IRA, brokerage:</b> Positions or Holdings page, then Download. Ledgerline reads symbol, shares, price and cost basis.</div>
    <div><b>Only PDFs?</b> Upload the PDF. ${SAMPLE ? 'Claude reads the statement and pulls out each transaction.' : 'Ledgerline will try to read the transaction lines.'}</div>
    <div><b>Google Sheets:</b> File → Download → .xlsx or .csv, or copy and paste the cells above.</div>
    <div>Overlapping date ranges are fine. Duplicates are skipped.</div></div></details>`;
  openSheet('Import statements', body, '', { wide: true, noFocus: true });
  wireDrop();
}
function wireDrop() {
  const dz = $('#drop'), fi = $('#fileIn'); if (!dz) return;
  fi.addEventListener('change', () => { if (fi.files.length) handleFiles([...fi.files]); });
  ['dragenter', 'dragover'].forEach(e => dz.addEventListener(e, ev => { ev.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(e => dz.addEventListener(e, ev => { ev.preventDefault(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', ev => { const fs = [...(ev.dataTransfer.files || [])]; if (fs.length) handleFiles(fs); });
}
function setFoot(h) { const f = $('.sheet-f'); if (f) { f.innerHTML = h || ''; f.hidden = !h; } }
function working(msg) { $('.sheet-b').innerHTML = `<div class="empty"><span class="spin"></span> ${esc(msg)}</div>`; setFoot(''); }
function importError(msg) { $('.sheet-b').innerHTML = `<div class="note warn">${esc(msg)}</div><div><button class="btn" type="button" data-act="import">Try another file</button></div>`; }
function readText(f) { return f.text ? f.text() : new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Could not read the file.')); r.readAsText(f); }); }
function readBuf(f) { return f.arrayBuffer ? f.arrayBuffer() : new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Could not read the file.')); r.readAsArrayBuffer(f); }); }
async function handleFiles(files) {
  const queue = files.slice(); ui.imp = { step: 'working', queue };
  await nextFile();
}
async function nextFile() {
  const f = ui.imp && ui.imp.queue.shift(); if (!f) return;
  const name = f.name || 'pasted'; const ext = (name.split('.').pop() || '').toLowerCase();
  working('Reading ' + name + '…');
  try {
    if (ext === 'json') { const data = JSON.parse(await readText(f)); if (data && data.kind === 'ledgerline-import' && Array.isArray(data.transactions)) { ui.imp = { ...ui.imp, kind: 'llimport', data, file: name }; return llImportStep(); }
      if (!data || !Array.isArray(data.transactions) || !Array.isArray(data.categories)) throw new Error('That JSON file is not a Ledgerline backup.'); ui.imp = { ...ui.imp, kind: 'backup', data, file: name }; return backupStep(); }
    if (['ofx', 'qfx', 'qbo'].includes(ext)) { const r = parseOFX(await readText(f)); if (!r.records.length) throw new Error('No transactions found in that OFX/QFX file.'); ui.imp = { ...ui.imp, kind: 'records', records: r.records, balance: r.balance, file: name, flip: false }; return recordsStep(); }
    if (ext === 'pdf') return pdfFile(f, name);
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return imageFiles([f], name);
    let rows;
    if (['xlsx', 'xls', 'xlsm'].includes(ext)) {
      await loadScript(LIB.xlsx); const wb = XLSX.read(await readBuf(f), { type: 'array', cellDates: true });
      let best = null; for (const sn of wb.SheetNames) { const r = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '' }).map(row => row.map(c => c instanceof Date ? c : typeof c === 'number' ? c : String(c).trim())).filter(row => row.some(c => c !== '')); if (!best || (detectHeader(r) >= 0 && detectHeader(best) < 0) || (r.length > best.length && (detectHeader(r) >= 0) === (detectHeader(best) >= 0))) best = r; }
      rows = best || [];
    } else rows = parseDelimited(await readText(f));
    tableStep(rows, name);
  } catch (e) { importError(e.message || 'Could not read that file.'); }
}
function tableStep(rows, name) {
  if (!rows.length) return importError('That file looks empty.');
  if (isPositionsTable(rows)) { const hs = parsePositions(rows); if (!hs.length) return importError('Found a positions header but no holdings rows.'); ui.imp = { ...ui.imp, kind: 'positions', holdings: hs, file: name }; return positionsStep(); }
  const map = guessMapping(rows); const pre = rowsToRecords(rows, map, false);
  ui.imp = { ...ui.imp, kind: 'table', rows, map, file: name, flip: guessFlip(pre.records) };
  mapStep();
}
function acctPicker() {
  const im = ui.imp; const guess = im.acctId || (state.demo ? '' : (state.accounts.find(a => im.file && im.file.toLowerCase().includes(a.name.toLowerCase().split(' ')[0])) || {}).id) || '';
  const realAccts = state.demo ? [] : state.accounts;
  return `<div class="form"><label class="f">Import into account<select class="input" id="impAcct" data-on="change:impAcct"><option value="__new"${!guess ? ' selected' : ''}>New account…</option>${realAccts.map(a => `<option value="${a.id}"${a.id === guess ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
  <label class="switch full" id="cutW" hidden><input type="checkbox" id="impCut" checked> <span id="cutTxt"></span></label>
  <span id="newAcctW" class="form" style="grid-column:1/-1;${guess ? 'display:none' : ''}"><label class="f">Account name<input class="input" id="impName" value="${esc(im.newName || (im.file || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 40))}"></label><label class="f">Type<select class="input" id="impType">${Object.entries(ACCT_TYPES).filter(([k]) => ['checking', 'savings', 'credit', 'cash', 'loan', 'brokerage', 'k401', 'roth', 'ira', 'hsa', 'crypto'].includes(k)).map(([k, v]) => `<option value="${k}"${(im.newType || 'checking') === k ? ' selected' : ''}>${v.label}</option>`).join('')}</select></label></span></div>`;
}
function updateCut() {
  const w = $('#cutW'), sel = $('#impAcct'); if (!w || !sel) return;
  const last = sel.value !== '__new' ? lastPostedDate(sel.value) : null;
  w.hidden = !last; if (last) $('#cutTxt').textContent = `Only add transactions after ${dShort(last)}, the latest already in this account. Turn off to bring in older ones (exact repeats are still skipped).`;
}
function previewTable(records) {
  const sample = records.slice(0, 8);
  return `<div class="scrollx"><table class="ltable"><thead><tr><th>Date</th><th>Description</th><th>Category guess</th><th class="r">Amount</th></tr></thead><tbody>${sample.map(r => { const t = { desc: r.desc, merchant: merchantName(r.desc), amount: r.amount }; return `<tr><td>${dShort(r.date)}</td><td><b>${esc(t.merchant)}</b><div class="muted" style="font-size:12px">${esc(r.desc.slice(0, 48))}</div></td><td>${esc(catOf(categorize(t).cat).name)}</td><td class="r num ${r.amount > 0 ? 'pos' : ''}">${signedMoney(r.amount)}</td></tr>`; }).join('')}</tbody></table></div>`;
}
function mapStep() {
  const im = ui.imp; const H = im.map.headerIdx >= 0 ? im.rows[im.map.headerIdx] : im.rows[0].map((_, i) => 'Column ' + (i + 1));
  const sel = (key, label, none) => `<label class="f">${label}<select class="input" data-on="change:mapCol" data-key="${key}" id="map-${key}">${none ? '<option value="-1">— none —</option>' : ''}${H.map((h, i) => `<option value="${i}"${im.map[key] === i ? ' selected' : ''}>${esc(String(h || 'Column ' + (i + 1)).slice(0, 30))}</option>`).join('')}</select></label>`;
  const { records, skipped } = rowsToRecords(im.rows, im.map, im.flip);
  const outCount = records.filter(r => r.amount < 0).length;
  $('.sheet-b').innerHTML = `<div class="row between"><b>${esc(im.file)}</b><span class="muted">${records.length} transactions found${skipped ? ` · ${skipped} rows skipped (headers, totals, blanks)` : ''}</span></div>
    <div class="form" style="grid-template-columns:repeat(3,minmax(0,1fr))">${sel('date', 'Date column')}${sel('desc', 'Description column')}${sel('amount', 'Amount column', true)}${sel('debit', 'Debit / money out', true)}${sel('credit', 'Credit / money in', true)}${sel('category', 'Category (optional)', true)}</div>
    <label class="switch"><input type="checkbox" id="flipSign" data-on="change:flip"${im.flip ? ' checked' : ''}> Purchases show as positive numbers in this file (flip signs)</label>
    <div class="note">${outCount} of ${records.length} rows are money out. Purchases should show with a minus sign below; if they don't, tick the box above.</div>
    ${acctPicker()}${previewTable(records)}`;
  setFoot(`<button class="btn ghost" data-act="import" type="button">Back</button><button class="btn primary" data-act="doImport" type="button"${records.length ? '' : ' disabled'}>Import ${records.length} transactions</button>`);
  updateCut();
}
function recordsStep() {
  const im = ui.imp; const records = im.records.map(r => ({ ...r, amount: im.flip ? -r.amount : r.amount }));
  $('.sheet-b').innerHTML = `<div class="row between"><b>${esc(im.file)}</b><span class="muted">${records.length} transactions found${im.via ? ' · ' + esc(im.via) : ''}</span></div>
    <label class="switch"><input type="checkbox" id="flipSign" data-on="change:flip"${im.flip ? ' checked' : ''}> Flip all signs (if purchases show as positive)</label>
    ${acctPicker()}${previewTable(records)}${im.via ? '<div class="note">Read from a PDF or image. Spot-check a few amounts against your statement before relying on the totals.</div>' : ''}`;
  setFoot(`<button class="btn ghost" data-act="import" type="button">Back</button><button class="btn primary" data-act="doImport" type="button"${records.length ? '' : ' disabled'}>Import ${records.length} transactions</button>`);
  updateCut();
}
function positionsStep() {
  const im = ui.imp; const inv = state.demo ? [] : state.accounts.filter(isInvest);
  $('.sheet-b').innerHTML = `<div class="row between"><b>${esc(im.file)}</b><span class="muted">${im.holdings.length} holdings · ${money(sumBy(im.holdings, h => h.shares * h.price))}</span></div>
    <div class="form"><label class="f">Put these holdings in<select class="input" id="posAcct" data-on="change:posAcct"><option value="__new">New account…</option>${inv.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></label>
    <span id="posNewW" class="form" style="grid-column:1/-1"><label class="f">Account name<input class="input" id="posName" value="${esc(im.file.replace(/\.[^.]+$/, '').slice(0, 40))}"></label><label class="f">Type<select class="input" id="posType">${['k401', 'roth', 'ira', 'brokerage', 'hsa', 'crypto'].map(k => `<option value="${k}">${ACCT_TYPES[k].label}</option>`).join('')}</select></label></span></div>
    <div class="scrollx"><table class="ltable"><thead><tr><th>Symbol</th><th>Class</th><th class="r">Shares</th><th class="r">Price</th><th class="r">Value</th></tr></thead><tbody>${im.holdings.slice(0, 30).map(h => `<tr><td><b>${esc(h.sym)}</b><div class="muted" style="font-size:12px">${esc(h.name.slice(0, 40))}</div></td><td>${esc(h.cls)}</td><td class="r num">${h.shares}</td><td class="r num">${money(h.price, true)}</td><td class="r num">${money(h.shares * h.price, true)}</td></tr>`).join('')}</tbody></table></div>
    <div class="note">Importing replaces that account's holdings with this snapshot and records today's value in your net worth history.</div>`;
  setFoot(`<button class="btn ghost" data-act="import" type="button">Back</button><button class="btn primary" data-act="doPositions" type="button">Save holdings</button>`);
}
function llImportStep() {
  const d = ui.imp.data; const ds = d.transactions.map(t => t.date).sort();
  $('.sheet-b').innerHTML = `<div class="stack"><h2 style="font-size:20px">${esc(d.title || 'Transactions prepared by Claude')}</h2>
    <div class="kv"><span>Transactions</span><span class="num">${d.transactions.length}</span></div>
    ${ds.length ? `<div class="kv"><span>Dates</span><span>${dShort(ds[0])} – ${dShort(ds[ds.length - 1])}</span></div>` : ''}
    ${(d.accounts || []).map(a => `<div class="kv"><span>${esc(a.name)}</span><span class="num">${a.balance != null ? money(a.balance, true) + (a.balanceAsOf ? ' on ' + dShort(a.balanceAsOf) : '') : ''}</span></div>`).join('')}
    <div class="note">These get added to what you already have. Anything already in Ledgerline is skipped, and charges you entered as pending are swapped for the posted versions.</div></div>`;
  setFoot(`<button class="btn ghost" data-act="import" type="button">Back</button><button class="btn primary" data-act="doLLImport" type="button">Add to my ledger</button>`);
}
function applyLedgerFile(d) {
  ensureReal();
  for (const c of d.categories || []) if (c && c.id && !CATMAP[c.id]) state.categories.push({ id: c.id, name: c.name || c.id, group: GROUPS[c.group] ? c.group : 'wants' });
  rebuildCats();
  const amap = {};
  for (const a of d.accounts || []) {
    let ex = state.accounts.find(x => x.id === a.id) || state.accounts.find(x => x.name.toLowerCase() === String(a.name || '').toLowerCase());
    if (!ex) { ex = { id: a.id || uid(), name: a.name || 'Account', type: ACCT_TYPES[a.type] ? a.type : 'checking', institution: a.institution || '', balance: 0, history: [], holdings: [], apr: '', minPay: '', contribYTD: '' }; state.accounts.push(ex); }
    amap[a.id] = ex.id;
    if (a.balance != null && a.balanceAsOf) { ex.history = (ex.history || []).filter(h => h.d !== a.balanceAsOf); ex.history.push({ d: a.balanceAsOf, v: +a.balance }); ex.history.sort((x, y) => x.d < y.d ? -1 : 1); ex.balance = ex.history[ex.history.length - 1].v; }
  }
  const counts = {}; for (const t of state.transactions) { const k = txKey(t); counts[k] = (counts[k] || 0) + 1; }
  const added = [], months = new Set(); let dupes = 0, replaced = 0;
  for (const r of d.transactions) {
    const accountId = amap[r.accountId] || r.accountId; if (!state.accounts.some(a => a.id === accountId)) continue;
    const t = { id: uid(), date: r.date, desc: r.desc || r.merchant || '', amount: round2(r.amount), accountId, merchant: r.merchant || merchantName(r.desc), categoryId: CATMAP[r.categoryId] ? r.categoryId : 'uncat', notes: r.notes || '', tags: r.tags || [], business: !!r.business, excluded: !!r.excluded };
    if (!t.date || !isFinite(t.amount)) continue;
    const k = txKey(t); if (counts[k]) { counts[k]--; dupes++; continue; }
    if (t.categoryId === 'uncat') { const c = categorize(t); t.categoryId = c.cat; applyRuleExtras(t, c.rule); }
    const p = /pending/i.test(t.notes) ? null : takePending(t); if (p) { replaced++; months.add(mKey(p.date)); }
    added.push(t); months.add(mKey(t.date));
  }
  state.transactions.push(...added);
  for (const r of d.rules || []) if (r && r.text && !state.rules.some(x => x.text.toUpperCase() === String(r.text).toUpperCase())) state.rules.push({ id: uid(), text: r.text, categoryId: r.categoryId, business: !!r.business });
  if (d.settings && d.settings.pay) state.settings.pay = { ...state.settings.pay, ...d.settings.pay };
  touch(true, [...months]);
  return { added: added.length, dupes, replaced };
}
function backupStep() {
  const d = ui.imp.data;
  $('.sheet-b').innerHTML = `<p>This backup has <b>${d.transactions.length}</b> transactions and <b>${(d.accounts || []).length}</b> accounts.</p><div class="note warn">Restoring replaces everything currently in Ledgerline.</div>`;
  setFoot(`<button class="btn ghost" data-act="import" type="button">Back</button><button class="btn primary" data-act="doRestore" type="button">Restore backup</button>`);
}
async function pdfFile(f, name) {
  working('Reading the PDF…');
  await loadScript(LIB.pdfw); await loadScript(LIB.pdf);
  const lib = window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = LIB.pdfw;
  const pdf = await lib.getDocument({ data: new Uint8Array(await readBuf(f)) }).promise; let text = '';
  for (let p = 1; p <= Math.min(pdf.numPages, 40); p++) {
    const pg = await pdf.getPage(p); const tc = await pg.getTextContent(); const lines = {};
    for (const it of tc.items) { const y = Math.round(it.transform[5] / 2) * 2; (lines[y] = lines[y] || []).push({ x: it.transform[4], s: it.str }); }
    text += Object.keys(lines).map(Number).sort((a, b) => b - a).map(y => lines[y].sort((a, b) => a.x - b.x).map(o => o.s).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n') + '\n';
  }
  if (text.trim().length < 40) { if (SAMPLE) return importError('This PDF is a scanned image with no text. Take screenshots of the transaction pages and upload those instead.'); return importError('This PDF has no readable text. Download a CSV from your bank instead.'); }
  let records = [], via = '';
  if (SAMPLE) {
    working('Claude is reading your statement…');
    const chunks = []; for (let i = 0; i < text.length && chunks.length < 4; i += 60000) chunks.push(text.slice(i, i + 60000));
    try { for (const c of chunks) { const r = await SAMPLE.json(extractPrompt() + '\n\nSTATEMENT TEXT:\n' + c, { modelTier: 'default' }); if (Array.isArray(r)) records.push(...r); } via = 'read by Claude'; }
    catch (e) { records = []; }
  }
  if (!records.length) { records = regexExtractStatement(text); via = 'read by pattern matching'; }
  records = cleanAiRecords(records);
  if (!records.length) return importError('No transactions could be found in that PDF. Try a CSV download from your bank.');
  ui.imp = { ...ui.imp, kind: 'records', records, file: name, via, flip: false }; recordsStep();
}
async function imageFiles(files, name) {
  if (!SAMPLE) return importError('Reading screenshots needs Claude. Open this page in Claude while signed in, or download a CSV from your bank.');
  working('Claude is reading the image…');
  try { const r = await SAMPLE.json(extractPrompt() + '\n\nThe statement or receipt is in the attached image.', { images: files, modelTier: 'default' }); const records = cleanAiRecords(Array.isArray(r) ? r : []); if (!records.length) return importError('No transactions found in that image.'); ui.imp = { ...ui.imp, kind: 'records', records, file: name, via: 'read by Claude from an image', flip: false }; recordsStep(); }
  catch (e) { importError(e && e.code === 'images_unavailable' ? 'Image reading is not available in this view.' : 'Claude could not read that image. Try a clearer screenshot.'); }
}
function extractPrompt() { return `Extract every individual transaction from this bank, credit card, or brokerage statement. Reply with only a JSON array of objects: {"date":"YYYY-MM-DD","description":string,"amount":number}. Amount is NEGATIVE for money leaving the account (purchases, withdrawals, fees, interest charged, payments sent) and POSITIVE for money coming in (deposits, paychecks, refunds, credits, payments received on a credit card). Skip balances, subtotals, summaries and headers. If the year is not on a line, infer it from the statement period. Today is ${TODAY}.`; }
function cleanAiRecords(arr) { return arr.map(r => ({ date: parseDateAny(r.date), desc: String(r.description || r.desc || '').trim() || 'Transaction', amount: round2(typeof r.amount === 'number' ? r.amount : parseAmount(r.amount)) })).filter(r => r.date && r.amount && isFinite(r.amount)); }
function resolveImportAccount() {
  const sel = $('#impAcct') ? $('#impAcct').value : '__new';
  if (sel !== '__new') return state.accounts.find(a => a.id === sel);
  const a = { id: uid(), name: ($('#impName').value || 'Imported account').trim(), type: $('#impType').value, institution: '', balance: 0, history: [], holdings: [], apr: '', minPay: '', contribYTD: '' };
  state.accounts.push(a); return a;
}
function doImport() {
  const im = ui.imp; let records;
  if (im.kind === 'table') records = rowsToRecords(im.rows, im.map, im.flip).records; else records = im.records.map(r => ({ ...r, amount: im.flip ? -r.amount : r.amount }));
  const selVal = $('#impAcct') ? $('#impAcct').value : '__new'; const newName = $('#impName') ? $('#impName').value : ''; const newType = $('#impType') ? $('#impType').value : 'checking';
  ensureReal();
  if ($('#impAcct')) { /* re-resolve after a possible demo reset */ }
  let acct = selVal !== '__new' ? state.accounts.find(a => a.id === selVal) : null;
  if (!acct) { acct = { id: uid(), name: (newName || 'Imported account').trim(), type: newType, institution: '', balance: 0, history: [], holdings: [], apr: '', minPay: '', contribYTD: '' }; state.accounts.push(acct); }
  let older = 0; const cutOn = $('#impCut') && $('#impCut').checked && !$('#cutW').hidden; const cut = cutOn ? lastPostedDate(acct.id) : null;
  if (cut) { const n = records.length; records = records.filter(r => r.date > cut); older = n - records.length; }
  const { added, dupes, replaced } = buildTransactions(records, acct.id);
  state.transactions.push(...added);
  if (im.balance != null && !isNaN(im.balance)) { acct.balance = isLiab(acct) ? Math.abs(im.balance) : im.balance; recordBalance(acct); }
  touch(true, [...txMonths(added), ...txMonths(replaced)]);
  const latest = added.reduce((m, t) => t.date > m ? t.date : m, ''); if (latest) ui.month = mKey(latest) > THIS_MONTH ? THIS_MONTH : mKey(latest);
  const unc = added.filter(t => t.categoryId === 'uncat').length;
  render();
  $('.sheet-b').innerHTML = `<div class="stack"><h2 style="font-size:22px">Imported ${added.length} transactions into ${esc(acct.name)}</h2>
    <div class="kv"><span>Skipped as duplicates</span><span class="num">${dupes.length}</span></div>${older ? `<div class="kv"><span>Older than what's already here (skipped)</span><span class="num">${older}</span></div>` : ''}${replaced.length ? `<div class="kv"><span>Pending charges replaced by posted ones</span><span class="num">${replaced.length}</span></div>` : ''}<div class="kv"><span>Still uncategorized</span><span class="num">${unc}</span></div>
    ${!(acctBalance(acct)) ? `<label class="f">Current balance of ${esc(acct.name)} (for net worth and safe-to-spend)<input class="input num" type="number" step="0.01" id="postBal" placeholder="e.g. 1520.33"></label>` : ''}</div>`;
  setFoot(`${unc && SAMPLE ? `<button class="btn" data-act="aiCat" type="button">${ico('spark', 14)} Categorize ${unc} with Claude</button>` : ''}${ui.imp.queue && ui.imp.queue.length ? `<button class="btn" data-act="nextFile" type="button">Next file (${ui.imp.queue.length} left)</button>` : `<button class="btn" data-act="import" type="button">Import another</button>`}<button class="btn primary" data-act="finishImport" data-id="${acct.id}" type="button">Done</button>`);
  ui.imp.lastAcct = acct.id;
}
function txMonths(list) { return [...new Set(list.map(t => mKey(t.date)))]; }

/* =================== EXPORTS =================== */
async function saveFile(filename, data, fallbackText) {
  if (DL) { try { await DL.save({ filename, data }); toast('Saved ' + filename); return; } catch (e) { if (e && e.code === 'declined') return; } }
  if (!IN_CLAUDE) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: filename.endsWith('.csv') ? 'text/csv' : filename.endsWith('.json') ? 'application/json' : 'application/octet-stream' });
    try { const file = new File([blob], filename, { type: blob.type }); if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: filename }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); toast('Saved ' + filename); return; } catch (e) { }
  }
  if (fallbackText != null) openSheet('Copy your export', `<p class="muted">Downloads are not available in this view. Copy the text below into a file named <b>${esc(filename)}</b>.</p><textarea class="input num" id="copyOut" rows="14" style="width:100%" readonly>${esc(fallbackText)}</textarea>`, `<button class="btn primary" data-act="copyOut" type="button">Copy</button>`);
  else toast('Downloads are not available in this view.');
}
function csvCell(v) { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function txCSV() { const rows = [['Date', 'Merchant', 'Bank description', 'Category', 'Group', 'Account', 'Amount', 'Business', 'Excluded', 'Notes', 'Tags']]; for (const t of [...state.transactions].sort((a, b) => a.date < b.date ? -1 : 1)) rows.push([t.date, t.merchant, t.desc, catOf(t.categoryId).name, GROUPS[catOf(t.categoryId).group], acctName(t.accountId), t.amount.toFixed(2), t.business ? 'yes' : '', t.excluded ? 'yes' : '', t.notes || '', (t.tags || []).join('; ')]); return rows.map(r => r.map(csvCell).join(',')).join('\n'); }
async function exportXLSX() {
  try { await loadScript(LIB.xlsx); } catch (e) { toast(e.message); return; }
  const wb = XLSX.utils.book_new();
  const tx = [...state.transactions].sort((a, b) => a.date < b.date ? -1 : 1).map(t => ({ Date: t.date, Merchant: t.merchant, 'Bank description': t.desc, Category: catOf(t.categoryId).name, Group: GROUPS[catOf(t.categoryId).group], Account: acctName(t.accountId), Amount: t.amount, Business: t.business ? 'yes' : '', Excluded: t.excluded ? 'yes' : '', Notes: t.notes || '' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tx), 'Transactions');
  const mon = D.list.map(m => { const md = D.months[m]; return { Month: m, Income: round2(md.income), Spending: round2(md.spend), 'Saved & invested': round2(md.saved), Kept: round2(md.income - md.spend), 'Savings rate': md.income ? round2((md.income - md.spend) / md.income) : '' }; });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mon), 'Monthly summary');
  const cats = spendCats().map(c => { const row = { Category: c.name, Group: GROUPS[c.group] }; for (const m of D.list) row[m] = round2(D.months[m].byCat[c.id] || 0); return row; });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cats), 'Spending by category');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.accounts.map(a => ({ Account: a.name, Type: ACCT_TYPES[a.type].label, Institution: a.institution, Balance: round2(signedBal(a)), APR: a.apr || '', 'Min payment': a.minPay || '' }))), 'Accounts');
  const biz = state.transactions.filter(t => t.business || catOf(t.categoryId).group === 'business').map(t => ({ Date: t.date, Merchant: t.merchant, Category: catOf(t.categoryId).name, Amount: t.amount, Notes: t.notes || '' }));
  if (biz.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(biz), 'Business');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  await saveFile('ledgerline-' + TODAY + '.xlsx', new Blob([buf]), null);
}

/* =================== EVENTS =================== */
const ACT = {
  nav(el) { closeSheet(); ui.view = el.dataset.v; lsSet('ll:view', ui.view); ui.selecting = false; ui.sel.clear(); render(); window.scrollTo({ top: 0 }); },
  more(el) { if (el.dataset.more === 'tx') { ui.limit += 200; render(); return; } moreSheet(); },
  import() { importSheet(); }, closeSheet, sheetBg(el, ev) { if (ev.target === el) closeSheet(); },
  startFresh() { state = emptyState(); rebuildCats(); Store.markAll(state); render(); toast('Started an empty ledger.'); },
  loadDemo() { if (!state.demo && hasData()) { toast('Erase your data first. Example data never overwrites your ledger.'); return; } state = buildDemo(); rebuildCats(); render(); },
  filterCat(el) { ui.f = { q: '', month: 'sel', cat: el.dataset.cat, acct: '', kind: '', flag: '' }; ui.view = 'activity'; render(); },
  searchMerchant(el) { ui.f = { q: el.dataset.q, month: 'all', cat: '', acct: '', kind: '', flag: '' }; ui.view = 'activity'; render(); },
  editTx(el, ev) { if (ev.target.closest('input')) return; if (ui.selecting) { const id = el.dataset.id; ui.sel.has(id) ? ui.sel.delete(id) : ui.sel.add(id); render(); return; } txSheet(state.transactions.find(t => t.id === el.dataset.id)); },
  selTx(el, ev) { ev.stopPropagation(); const id = el.dataset.id; el.checked ? ui.sel.add(id) : ui.sel.delete(id); render(); },
  toggleSelect() { ui.selecting = !ui.selecting; ui.sel.clear(); render(); },
  selAll() { for (const t of filteredTx().slice(0, ui.limit)) ui.sel.add(t.id); render(); },
  bulk(el) {
    const ids = ui.sel; if (!ids.size) { toast('Select transactions first.'); return; }
    const list = state.transactions.filter(t => ids.has(t.id)); const op = el.dataset.op;
    if (op === 'del') { if (!armed(el)) return; state.transactions = state.transactions.filter(t => !ids.has(t.id)); }
    else if (op === 'biz') { const v = !list.every(t => t.business); list.forEach(t => t.business = v); }
    else if (op === 'excl') { const v = !list.every(t => t.excluded); list.forEach(t => t.excluded = v); }
    touch(false, txMonths(list)); ui.sel.clear(); render(); toast('Updated ' + list.length + ' transactions.');
  },
  addTx() { closeSheet(); txSheet(null); },
  saveTx(el) {
    const id = el.dataset.id; const amt = parseFloat($('#eAmt').value); const date = $('#eDate').value;
    if (!date || isNaN(amt)) { toast('Enter a date and an amount.'); return; }
    if (!id) {
      if (ensureReal()) { }
      let acctId = $('#eAcct').value; if (!state.accounts.find(a => a.id === acctId)) { const a = { id: uid(), name: 'Cash & manual', type: 'cash', institution: '', balance: 0, history: [], holdings: [] }; state.accounts.push(a); acctId = a.id; }
      const mer = $('#eMer').value.trim() || 'Manual entry';
      const t = { id: uid(), date, desc: mer, merchant: mer, amount: round2(amt), accountId: acctId, categoryId: $('#eCat').value, notes: $('#eNotes').value.trim(), tags: $('#eTags').value.split(',').map(s => s.trim()).filter(Boolean), business: $('#eBiz').checked, excluded: $('#eExcl').checked };
      if (t.categoryId === 'uncat') { const c = categorize(t); t.categoryId = c.cat; }
      state.transactions.push(t); touch(true, [mKey(date)]); closeSheet(); render(); toast('Added.'); return;
    }
    const t = state.transactions.find(x => x.id === id); if (!t) return; const oldM = mKey(t.date);
    t.date = date; t.amount = round2(amt); t.merchant = $('#eMer').value.trim() || t.merchant; t.categoryId = $('#eCat').value; t.accountId = $('#eAcct').value || t.accountId; t.notes = $('#eNotes').value.trim(); t.tags = $('#eTags').value.split(',').map(s => s.trim()).filter(Boolean); t.business = $('#eBiz').checked; t.excluded = $('#eExcl').checked;
    const months = new Set([oldM, mKey(date)]); let n = 0;
    if ($('#eRule') && $('#eRule').checked) {
      const text = t.merchant; state.rules = state.rules.filter(r => r.text.toUpperCase() !== text.toUpperCase());
      state.rules.unshift({ id: uid(), text, categoryId: t.categoryId, business: t.business });
      for (const x of state.transactions) if (x !== t && x.merchant.toUpperCase() === text.toUpperCase()) { x.categoryId = t.categoryId; if (t.business) x.business = true; months.add(mKey(x.date)); n++; }
    }
    touch(true, [...months]); closeSheet(); render(); toast(n ? `Saved. Updated ${n} other ${t.merchant} transactions too.` : 'Saved.');
  },
  splitTx(el) {
    const t = state.transactions.find(x => x.id === el.dataset.id); const a = Math.abs(parseFloat($('#sAmt').value)); if (!t || !a || a >= Math.abs(t.amount)) { toast('Enter an amount smaller than the transaction.'); return; }
    const sign = t.amount < 0 ? -1 : 1; t.amount = round2(t.amount - sign * a);
    state.transactions.push({ ...t, id: uid(), amount: round2(sign * a), categoryId: $('#sCat').value, notes: 'Split from ' + t.merchant });
    touch(false, [mKey(t.date)]); closeSheet(); render(); toast('Split into two transactions.');
  },
  delTx(el) { if (!armed(el)) return; const t = state.transactions.find(x => x.id === el.dataset.id); state.transactions = state.transactions.filter(x => x.id !== el.dataset.id); if (t) touch(false, [mKey(t.date)]); closeSheet(); render(); toast('Deleted.'); },
  addAcct() { acctSheet(null); }, editAcct(el) { acctSheet(state.accounts.find(a => a.id === el.dataset.id)); },
  addHolding() { $('#holdTable tbody').insertAdjacentHTML('beforeend', holdRow({ sym: '', shares: '', price: '', er: '', cls: 'US stocks' })); },
  rmHolding(el) { el.closest('tr').remove(); },
  saveAcct(el) {
    const id = el.dataset.id; const name = $('#aName').value.trim(); if (!name) { toast('Give the account a name.'); return; }
    if (!id) ensureReal();
    let a = state.accounts.find(x => x.id === id); const isNew = !a;
    if (!a) { a = { id: uid(), history: [], holdings: [] }; state.accounts.push(a); }
    a.name = name; a.type = $('#aType').value; a.institution = $('#aInst').value.trim(); a.apr = $('#aApr').value; a.minPay = $('#aMin').value; a.limit = $('#aLim').value; a.contribYTD = $('#aCon').value;
    a.holdings = isInvest(a) ? $$('#holdTable tr.hrow').map(tr => { const o = {}; $$('[data-h]', tr).forEach(i => o[i.dataset.h] = i.value); return { sym: o.sym.trim().toUpperCase(), name: o.name, shares: +o.shares || 0, price: +o.price || 0, er: o.er === '' ? '' : +o.er, cls: o.cls || guessClass(o.sym, o.name), cost: +o.cost || 0 }; }).filter(h => h.sym) : [];
    if (!(isInvest(a) && a.holdings.length)) a.balance = parseFloat($('#aBal').value) || 0;
    recordBalance(a); touch(true, []); closeSheet(); render(); toast(isNew ? 'Account added.' : 'Saved. Net worth history updated.');
  },
  delAcct(el) { if (!armed(el)) return; const id = el.dataset.id; const n = state.transactions.filter(t => t.accountId === id).length; const months = txMonths(state.transactions.filter(t => t.accountId === id)); state.accounts = state.accounts.filter(a => a.id !== id); state.transactions = state.transactions.filter(t => t.accountId !== id); touch(true, months); closeSheet(); render(); toast('Deleted the account' + (n ? ' and its ' + n + ' transactions.' : '.')); },
  addGoal() { goalSheet(null); }, editGoal(el) { goalSheet(state.goals.find(g => g.id === el.dataset.id)); },
  saveGoal(el) { const name = $('#gName').value.trim(); const target = parseFloat($('#gT').value); if (!name || !target) { toast('Add a name and a target amount.'); return; } if (!el.dataset.id) ensureReal(); let g = state.goals.find(x => x.id === el.dataset.id); if (!g) { g = { id: uid() }; state.goals.push(g); } Object.assign(g, { name, target, date: $('#gD').value, linked: $('#gL').value, saved: parseFloat($('#gS').value) || 0 }); touch(true, []); closeSheet(); render(); },
  delGoal(el) { if (!armed(el)) return; state.goals = state.goals.filter(g => g.id !== el.dataset.id); touch(true, []); closeSheet(); render(); },
  autoBudget() { const m = ui.month; for (const c of spendCats()) { const ms = fullMonthsBefore(D, m, 3); if (!ms.length) continue; const avg = sumBy(ms, k => D.months[k].byCat[c.id] || 0) / ms.length; if (avg > 5 && c.id !== 'uncat') state.budgets[c.id] = Math.ceil(avg / 10) * 10; } touch(true, []); render(); toast('Budgets set from your 3-month averages.'); },
  clearBudget(el) { if (!armed(el)) return; state.budgets = {}; touch(true, []); render(); },
  ignoreRec(el) { state.ignoreRecurring[el.dataset.key] = true; touch(true, []); render(); toast('Hidden. It will not count as recurring.'); },
  aiCat() { closeSheet(); aiCategorize(); },
  ask() { const b = $('#askBox'); const q = b.value; b.value = ''; askClaude(q); },
  askChip(el) { askClaude(el.dataset.q); },
  addCat() { const id = 'c' + uid().slice(0, 6); state.categories.push({ id, name: 'New category', group: 'wants' }); rebuildCats(); touch(true, []); render(); setTimeout(() => { const i = $('#cn-' + id); if (i) { i.focus(); i.select(); } }, 30); },
  delRule(el) { state.rules = state.rules.filter(r => r.id !== el.dataset.id); touch(true, []); render(); },
  rerunRules() { let n = 0; const months = new Set(); for (const t of state.transactions) { const c = categorize(t); if (c.rule && c.cat !== t.categoryId) { t.categoryId = c.cat; applyRuleExtras(t, c.rule); n++; months.add(mKey(t.date)); } } touch(false, [...months]); render(); toast('Re-categorized ' + n + ' transactions.'); },
  exportCSV() { const s = txCSV(); saveFile('ledgerline-transactions-' + TODAY + '.csv', s, s); },
  exportXLSX() { exportXLSX(); },
  exportJSON() { const s = JSON.stringify({ ...state, exportedAt: new Date().toISOString() }); saveFile('ledgerline-backup-' + TODAY + '.json', s, s); },
  copyOut() { const t = $('#copyOut'); const done = () => toast('Copied.'); if (navigator.clipboard) navigator.clipboard.writeText(t.value).then(done, () => { t.select(); toast('Press copy on your keyboard.'); }); else { t.select(); } },
  async wipe(el) { if (!armed(el)) return; await Store.wipe(); state = emptyState(); rebuildCats(); render(); toast('Everything erased.'); },
  usePaste() { const v = $('#pasteBox').value; if (!v.trim()) { toast('Paste some rows first.'); return; } ui.imp = { queue: [] }; tableStep(parseDelimited(v), 'Pasted rows'); },
  doImport() { doImport(); },
  doLLImport() { const r = applyLedgerFile(ui.imp.data); render(); $('.sheet-b').innerHTML = `<div class="stack"><h2 style="font-size:22px">Added ${r.added} transactions</h2><div class="kv"><span>Already in Ledgerline (skipped)</span><span class="num">${r.dupes}</span></div><div class="kv"><span>Pending charges replaced by posted ones</span><span class="num">${r.replaced}</span></div></div>`; setFoot(`<button class="btn primary" data-act="closeSheet" type="button">Done</button>`); },
  nextFile() { const lastAcct = ui.imp.lastAcct; ui.imp.acctId = lastAcct; nextFile(); },
  finishImport(el) { const v = $('#postBal') && $('#postBal').value; if (v) { const a = state.accounts.find(x => x.id === el.dataset.id); if (a) { a.balance = Math.abs(parseFloat(v)) * (isLiab(a) ? 1 : Math.sign(parseFloat(v)) || 1); recordBalance(a); touch(true, []); } } closeSheet(); ui.view = 'overview'; render(); },
  doPositions() {
    const im = ui.imp; const sel = $('#posAcct').value; const name = $('#posName').value; const type = $('#posType').value;
    ensureReal(); let a = state.accounts.find(x => x.id === sel);
    if (!a) { a = { id: uid(), name: (name || 'Investments').trim(), type, institution: '', balance: 0, history: [], holdings: [], contribYTD: '' }; state.accounts.push(a); }
    const old = {}; for (const h of a.holdings || []) old[h.sym] = h.er; a.holdings = im.holdings.map(h => ({ ...h, er: old[h.sym] != null ? old[h.sym] : h.er }));
    recordBalance(a); touch(true, []); closeSheet(); ui.view = 'wealth'; render(); toast('Saved ' + a.holdings.length + ' holdings to ' + a.name + '.');
  },
  doRestore() { const d = ui.imp.data; state = { ...emptyState(), ...d, demo: false }; delete state.exportedAt; rebuildCats(); Store.markAll(state); closeSheet(); render(); toast('Backup restored.'); }
};
const ON = {
  fq(el) { ui.f.q = el.value; ui.limit = 200; const pos = el.selectionStart; render(); const n = $('#fq'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { } } },
  fmonth(el) { ui.f.month = el.value; render(); }, fcat(el) { ui.f.cat = el.value; render(); }, facct(el) { ui.f.acct = el.value; render(); }, fkind(el) { ui.f.kind = el.value; render(); }, fflag(el) { ui.f.flag = el.value; render(); },
  bulkCat(el) { if (!el.value || !ui.sel.size) return; const list = state.transactions.filter(t => ui.sel.has(t.id)); list.forEach(t => t.categoryId = el.value); touch(false, txMonths(list)); ui.sel.clear(); render(); toast('Recategorized ' + list.length + '.'); },
  budget(el) { const v = parseFloat(el.value); if (v > 0) state.budgets[el.dataset.cat] = v; else delete state.budgets[el.dataset.cat]; touch(true, []); render(); },
  rollover(el) { state.rollover[el.dataset.cat] = el.checked; touch(true, []); render(); },
  cancel(el) { if (el.checked) state.cancelPlan[el.dataset.key] = true; else delete state.cancelPlan[el.dataset.key]; touch(true, []); render(); },
  cutMo(el) { ui.cutMonthly = Math.max(0, parseFloat(el.value) || 0); render(); },
  debtExtra(el) { ui.debtExtra = Math.max(0, parseFloat(el.value) || 0); render(); },
  fiC(el) { ui.fi.contrib = Math.max(0, parseFloat(el.value) || 0); render(); }, fiR(el) { ui.fi.ret = clamp(parseFloat(el.value) || 0, 0, 20); render(); }, fiS(el) { ui.fi.spend = Math.max(0, parseFloat(el.value) || 0); render(); },
  setPay() { state.settings.pay = { freq: $('#payFreq').value, next: $('#payNext').value, amount: parseFloat($('#payAmt').value) || 0 }; touch(true, []); toast('Paycheck saved.'); },
  setNum(el) { state.settings[el.dataset.k] = el.value === '' ? '' : parseFloat(el.value); touch(true, []); },
  catName(el) { const c = CATMAP[el.dataset.id]; if (c && el.value.trim()) { c.name = el.value.trim(); touch(true, []); } },
  catGroup(el) { const c = CATMAP[el.dataset.id]; if (c) { c.group = el.value; touch(true, []); } },
  acctType(el) { const t = el.value; const a = { type: t }; $('#aAprW').hidden = !isLiab(a); $('#aMinW').hidden = !isLiab(a); $('#aLimW').hidden = t !== 'credit'; $('#aConW').hidden = !['k401', 'roth', 'ira'].includes(t); $('#holdWrap').hidden = !isInvest(a); },
  mapCol(el) { ui.imp.map[el.dataset.key] = parseInt(el.value, 10); if (el.dataset.key === 'amount' && ui.imp.map.amount >= 0) { } mapStep(); },
  flip(el) { ui.imp.flip = el.checked; ui.imp.kind === 'table' ? mapStep() : recordsStep(); },
  impAcct(el) { ui.imp.acctId = el.value === '__new' ? '' : el.value; const w = $('#newAcctW'); if (w) w.style.display = el.value === '__new' ? '' : 'none'; updateCut(); },
  posAcct(el) { $('#posNewW').style.display = el.value === '__new' ? '' : 'none'; }
};

function boot() {
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-act]'); if (!el) return;
    const fn = ACT[el.dataset.act]; if (!fn) return;
    if (el.tagName === 'A') ev.preventDefault();
    if (el.type === 'checkbox' && el.dataset.act !== 'selTx') return;
    fn(el, ev);
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && $('#sheetRoot').innerHTML) { closeSheet(); return; }
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[role="button"][data-act]')) { ev.preventDefault(); ev.target.click(); }
    if (ev.key === 'Enter' && ev.target.id === 'askBox' && !ev.shiftKey) { ev.preventDefault(); ACT.ask(); }
  });
  let qTimer = null;
  const onEv = ev => { const el = ev.target.closest('[data-on]'); if (!el) return; const [type, name] = el.dataset.on.split(':'); if (type !== ev.type) return; if (name === 'fq') { clearTimeout(qTimer); qTimer = setTimeout(() => ON.fq(el), 220); return; } ON[name] && ON[name](el, ev); };
  document.addEventListener('change', onEv); document.addEventListener('input', onEv);
  document.addEventListener('paste', ev => { if (!ui.imp || ui.imp.step !== 'pick' || ev.target.id === 'pasteBox') return; const t = ev.clipboardData && ev.clipboardData.getData('text'); if (t && t.includes('\t')) { ev.preventDefault(); ui.imp = { queue: [] }; tableStep(parseDelimited(t), 'Pasted rows'); } });
  $('#mPrev').addEventListener('click', () => { ui.month = addMonths(ui.month, -1); render(); });
  $('#mNext').addEventListener('click', () => { if (ui.month < THIS_MONTH) { ui.month = addMonths(ui.month, 1); render(); } });
  $('#addTxTop').addEventListener('click', () => txSheet(null));
  $('#railImport').addEventListener('click', importSheet);
  const rerender = () => { if (state) render(); };
  if (window.matchMedia) { const mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener ? mq.addEventListener('change', rerender) : mq.addListener(rerender); }
  new MutationObserver(rerender).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (window.Chart) { Chart.defaults.font.family = '"Instrument Sans", system-ui, sans-serif'; Chart.defaults.color = cv('--muted'); }
  Store.onStatus = s => storeBadge(s);
  const hv = (location.hash || '').slice(1); const saved = lsGet('ll:view');
  ui.view = navViews().some(v => v.id === hv) ? hv : navViews().some(v => v.id === saved) ? saved : 'overview';
  state = buildDemo(); rebuildCats(); render();
  (async () => {
    await Store.init();
    const data = await Store.load();
    if (data && Array.isArray(data.transactions)) { state = { ...emptyState(), ...data, settings: { ...emptyState().settings, ...(data.settings || {}) }, demo: false }; rebuildCats(); const l = state.transactions.reduce((m, t) => t.date > m ? t.date : m, ''); if (l && mKey(l) < THIS_MONTH && !state.transactions.some(t => mKey(t.date) === THIS_MONTH)) ui.month = mKey(l); }
    if (Store.mode === 'local' && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    render(); storeBadge('saved');
    try { if (window.claude && claude.use) { const [s, dl] = await Promise.all([claude.use('sample'), claude.use('downloads')]); SAMPLE = s; DL = dl; if (SAMPLE && SAMPLE.limits) SAMPLE_LIMITS = await SAMPLE.limits().catch(() => null); if (ui.view === 'ask') render(); } } catch (e) { }
  })();
}
if (IS_DOM) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot(); }
