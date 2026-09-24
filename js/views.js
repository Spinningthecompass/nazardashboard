// ================================================================
//  VIEW LAYER — reads only DATA / ACCOUNTS_DB / PERFORMERS / SYNC_INFO
//  produced by db/pipeline.py. No numbers are stored or computed by
//  hand here beyond formatting, so views cannot drift from the data.
// ================================================================

// ---------- formatting (null-safe: a missing value renders "—", never throws)
function money(v){ return (v === null || v === undefined || isNaN(v)) ? "\u2014" : "$" + Number(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function num(v){ return (v === null || v === undefined) ? "\u2014" : Number(v).toLocaleString("en-US"); }
function pct(v){ return (v === null || v === undefined) ? "\u2014" : Number(v).toFixed(2) + "%"; }
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function cpaClass(cpa){
  if (cpa === null || cpa === undefined) return "cpa-na";
  if (cpa >= SYNC_INFO.targetCpa[1]) return "cpa-bad";
  if (cpa >= SYNC_INFO.targetCpa[0]) return "cpa-warn";
  return "cpa-good";
}
function cpaPill(cpa){ return (cpa === null || cpa === undefined) ? '<span class="muted">\u2014</span>' : '<span class="cpa-pill ' + cpaClass(cpa) + '">' + money(cpa) + '</span>'; }
function dot(status){ return '<span class="tab-dot ' + (status === "ACTIVE" ? "active" : "paused") + '"></span>'; }
function share(part, whole){ return whole ? Math.round(part / whole * 100) + "%" : "\u2014"; }

const VERDICT_CLASS = {
  // green: right call (killed on time, hold, scale) · yellow: early / debatable / relaunch · red: late or kill now · blue: accruing
  scale: "v-scale", hold: "v-scale", killed_rule: "v-scale", killed_cpa: "v-scale",
  watch: "v-watch", killed_early: "v-watch", killed_manual: "v-watch", starved: "v-watch",
  rule_break: "v-cut", front_bad: "v-cut", cut: "v-cut", killed_late: "v-cut",
  accruing: "v-hold"
};
function verdictPill(kind, label, detail){
  return '<span class="verdict-block"><span class="verdict ' + (VERDICT_CLASS[kind] || "v-data") + '" title="' + esc(detail) + '">' + esc(label) + '</span>' +
    '<span class="verdict-detail">' + esc(detail) + '</span></span>';
}
function cpaSparkline(daily, targetLo, targetHi){ return trendChart(daily); }
function trendChart(daily){
  if (!daily || daily.length < 2) return '<p class="muted small">Мало дней для графика.</p>';
  const M = RULES_META || {};
  const W = 660, H = 190, L = 44, Rr = 66, T = 16, B = 34, plotH = H - T - B, n = daily.length;
  const bw = (W - L - Rr) / n;
  const x = i => L + bw * i + bw / 2;
  // 3-day rolling CPA from daily spend / purchases
  const roll = daily.map((d, i) => {
    let s = 0, p = 0; for (let j = Math.max(0, i - 2); j <= i; j++) { s += daily[j].daySpend; p += daily[j].dayPurch; }
    return p ? s / p : null;
  });
  const cpas = daily.map(d => d.cpa).concat(roll).filter(v => v !== null);
  const target = M.holdCpa || null;
  const maxC = Math.max(...(cpas.length ? cpas : [10]), target || 0) * 1.1;
  const yC = v => T + plotH - Math.min(v, maxC) / maxC * plotH;
  const maxS = Math.max(...daily.map(d => d.daySpend), 1);
  const yS = v => T + plotH - v / maxS * plotH * 0.55;
  let g = '<svg class="trend" viewBox="0 0 ' + W + ' ' + H + '">';
  // grid + left axis (CPA)
  [0, 0.5, 1].forEach(f => { const v = maxC * f, y = yC(v);
    g += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y + '" y2="' + y + '" class="tg"/><text x="' + (L - 6) + '" y="' + (y + 3) + '" class="ta" text-anchor="end">$' + Math.round(v) + '</text>'; });
  g += '<text x="' + (W - Rr + 6) + '" y="' + (yS(maxS) + 3) + '" class="ta">▮ $' + Math.round(maxS) + '/день</text>';
  // spend bars + purchase dots + hover
  daily.forEach((d, i) => {
    const y = yS(d.daySpend);
    g += '<g><title>' + d.date + ': расход ' + money(d.daySpend) + ', покупок ' + d.dayPurch + (d.dayPurch ? ', CPA дня ' + money(d.daySpend / d.dayPurch) : '') + ', накопленный CPA ' + (d.cpa ? money(d.cpa) : '—') + '</title>' +
         '<rect x="' + (x(i) - bw * 0.36) + '" y="' + y + '" width="' + (bw * 0.72) + '" height="' + (T + plotH - y) + '" class="tb"/>' +
         '<rect x="' + (x(i) - bw / 2) + '" y="' + T + '" width="' + bw + '" height="' + plotH + '" fill="transparent"/></g>';
    if (d.dayPurch) g += '<circle cx="' + x(i) + '" cy="' + (y - 5) + '" r="' + Math.min(6, 2 + d.dayPurch * 0.6) + '" class="tp"/>';
  });
  if (target) g += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + yC(target) + '" y2="' + yC(target) + '" class="tt"/><text x="' + (W - Rr + 4) + '" y="' + (yC(target) + 3) + '" class="tt-l" text-anchor="start">цель ' + money(target) + '</text>';
  const path = arr => { let p = '', on = false; arr.forEach((v, i) => { if (v === null) { on = false; return; } p += (on ? ' L' : ' M') + x(i).toFixed(1) + ' ' + yC(v).toFixed(1); on = true; }); return p; };
  g += '<path d="' + path(roll) + '" class="tr"/><path d="' + path(daily.map(d => d.cpa)) + '" class="tc"/>';
  // x labels
  [0, Math.floor((n - 1) / 2), n - 1].forEach(i => { const dd = daily[i].date.slice(8, 10) + '.' + daily[i].date.slice(5, 7);
    g += '<text x="' + x(i) + '" y="' + (H - 16) + '" class="ta" text-anchor="middle">' + dd + '</text>'; });
  g += '</svg>';
  // trend summary: last 3 days vs previous 3
  const win = (a, b) => { let s = 0, p = 0; for (let i = Math.max(0, a); i < b; i++) { s += daily[i].daySpend; p += daily[i].dayPurch; } return { s, p, c: p ? s / p : null }; };
  const now = win(n - 3, n), prev = win(n - 6, n - 3);
  let trend = '';
  if (now.c && prev.c) { const up = now.c > prev.c * 1.1, dn = now.c < prev.c * 0.9;
    trend = '<span class="trend-badge ' + (up ? 'r' : (dn ? 'g' : 'n')) + '">' + (up ? '▲ дорожает' : (dn ? '▼ дешевеет' : '▬ стабильно')) + '</span> CPA последних 3 дней <b>' + money(now.c) + '</b> против ' + money(prev.c) + ' до этого';
  } else if (now.s > 0 && !now.p) trend = '<span class="trend-badge r">нет продаж</span> за последние 3 дня при расходе ' + money(now.s);
  else trend = '<span class="trend-badge n">мало данных</span> для сравнения последних дней';
  return '<div class="trend-wrap"><div class="trend-head">' + trend + '</div>' + g +
    '<div class="trend-legend"><i class="lg-c"></i>накопленный CPA <i class="lg-r"></i>CPA за 3 дня <i class="lg-b"></i>расход в день <i class="lg-p"></i>покупки <i class="lg-t"></i>цель в Ads Manager</div></div>';
}

// ---------- verdicts: chip on the card line + full explanation inside
const VERDICT_ACTION = {
  accruing: "Ничего не трогать — копить данные.",
  starved: "Вынести креатив в отдельный адсет со своим бюджетом или заменить: в текущем адсете Meta его не откручивает.",
  rule_break: "Выключить.",
  front_bad: "Выключить: при такой цене регистрации креатив не окупится даже в лучшем случае.",
  watch: "Бюджет не трогать, смотреть ежедневно. Если CPA не опустится — выключать.",
  cut: "Выключить или урезать бюджет. Перед этим сверить выручку в биллинге: когорты молодые.",
  hold: "Держать, бюджет не менять, копить подписчиков для подтверждения.",
  scale: "Масштабировать: перенести в скейл-структуру или поднимать бюджет.",
  killed_rule: "Выключено вовремя — не перезапускать в том же виде.",
  killed_late: "Выключено, но поздно: расход ушёл далеко за порог. В следующий раз выключать на пороге.",
  killed_cpa: "Выключено правильно — CPA выше цели на достаточной выборке.",
  killed_early: "Выключено до порога — решение данными не подтверждено. Можно перезапустить в отдельном адсете.",
  killed_manual: "Выключено при CPA в цели — выяснить причину. Кандидат на перезапуск."
};
function verdictChip(x){
  return '<span class="verdict verdict-chip ' + (VERDICT_CLASS[x.verdictKind] || "v-data") + '" title="' + esc(x.verdictDetail || "") + '">' + esc(x.verdict || "") + '</span>';
}
function nextMilestone(x){
  const R = LIFECYCLE_DB ? LIFECYCLE_DB.rulesCw : null, M = RULES_META || {};
  if (x.status !== "ACTIVE" || !R) return null;
  const isNew = x.launch === "new";
  const s0 = isNew ? M.stop0New : M.stop0, s1 = isNew ? M.stop1New : M.stop1;
  const out = [];
  if (x.purchases === 0) out.push("до порога остановки без продаж осталось " + money(Math.max(0, s0 - x.spend)));
  else if (x.purchases === 1) out.push("до порога для одной продажи осталось " + money(Math.max(0, s1 - x.spend)));
  if ((x.regs || 0) < R.front_min_regs) out.push("до оценки по фронту ещё " + (R.front_min_regs - (x.regs || 0)) + " рег." + (x.cpr ? " (~" + money((R.front_min_regs - (x.regs || 0)) * x.cpr) + ")" : ""));
  const n = x.cwSubs || 0;
  if (n < R.judge_cpa_from_purchases_cw) out.push("до оценки CPA по биллингу ещё " + (R.judge_cpa_from_purchases_cw - n) + " подп.");
  else if (x.cwCpa) {
    if (x.cwCpa > R.hold_cpa_cw) out.push("чтобы перейти в «Держать», CPA по биллингу должен опуститься с " + money(x.cwCpa) + " до " + money(R.hold_cpa_cw));
    else if (x.cwCpa > R.scale_cpa_cw) out.push("для «Масштаба» CPA по биллингу должен опуститься до " + money(R.scale_cpa_cw));
    if (n < R.confirm_purchases_cw) out.push("для подтверждения нужно ещё " + (R.confirm_purchases_cw - n) + " подп.");
  }
  return out.length ? out : null;
}
function verdictExplain(x, account){ return verdictStory(x, account); }
function verdictStory(x, account){
  const R = LIFECYCLE_DB ? LIFECYCLE_DB.rulesCw : {}, M = RULES_META || {};
  const PA = (FUNNEL_DB && FUNNEL_DB.perAccount) ? FUNNEL_DB.perAccount[account] : null;
  const isNew = x.launch === 'new', live = x.status === 'ACTIVE';
  const who = x.ads ? 'Адсет' : (isNew ? 'Новый креатив' : 'Креатив (перезапуск)');
  const s0 = isNew ? M.stop0New : M.stop0, s1 = isNew ? M.stop1New : M.stop1;
  const t = [];
  t.push(who + (live ? ' потратил ' : ' успел потратить ') + money(x.spend) + ' и дал ' + x.purchases + ' ' + (x.purchases === 1 ? 'покупку' : (x.purchases >= 2 && x.purchases <= 4 ? 'покупки' : 'покупок')) + (x.cpa ? ' по ' + money(x.cpa) + ' в Ads Manager' : '') + '.');
  if (x.cwSubs !== null && x.cwSubs !== undefined && x.purchases) {
    if (x.cwSubs < (R.judge_cpa_from_purchases_cw || 5)) t.push('В биллинге пока ' + x.cwSubs + ' подписч. — слишком мало, чтобы судить по CPA: на старте он гуляет на ±30%.');
    else t.push('В биллинге это ' + x.cwSubs + ' подписчиков по ' + money(x.cwCpa) + (x.cwCpa > R.cut_cpa_cw ? ' — дороже порога $' + R.cut_cpa_cw + ', при котором выключаем.' : (x.cwCpa <= R.scale_cpa_cw ? ' — ниже $' + R.scale_cpa_cw + ', это уровень масштабирования.' : (x.cwCpa <= R.hold_cpa_cw ? ' — в цели (до $' + R.hold_cpa_cw + ').' : ' — между целью $' + R.hold_cpa_cw + ' и порогом $' + R.cut_cpa_cw + '.'))));
  }
  if (x.regs >= (R.front_min_regs || 10) && x.cpr && PA && PA.breakevenCpr)
    t.push('Регистрация стоит ' + money(x.cpr) + ' при окупаемой ' + money(PA.breakevenCpr) + (x.cpr > PA.breakevenCpr * 1.2 ? ' — фронт не сходится' : (x.cpr <= PA.breakevenCpr ? ' — фронт в норме' : ' — фронт на грани')) + (x.purchases >= 3 && x.r2p !== null ? ', до покупки доходит ' + pct(x.r2p) + ' регистраций' : '') + '.');
  const why = {
    accruing: x.purchases === 0 ? 'Продаж пока нет, но до порога ' + money(s0) + ' ещё ' + money(Math.max(0, s0 - x.spend)) + ' — судить рано.' : 'Данных для оценки CPA пока мало.',
    starved: 'Meta почти не тратит на него в этом адсете — бюджет забирает сосед. Из 150+ таких новых запусков винером не стал ни один.',
    rule_break: 'Порог остановки пройден: ' + x.verdictDetail.replace(/\s*\[.*\]$/, '') + '.',
    front_bad: 'Даже при лучшей конверсии рега→покупка он не окупится.',
    cut: 'Выборка уже достаточная, и CPA стабильно выше порога — креатив не окупается.',
    watch: 'CPA между целью и порогом выключения — однозначного сигнала нет.',
    hold: 'CPA в цели.',
    scale: 'CPA ниже уровня масштабирования на достаточной выборке — 96% таких креативов оказались прибыльными.',
    killed_rule: 'Выключен на пороге — по правилу.',
    killed_late: 'Выключен, но расход ушёл далеко за порог: ' + x.verdictDetail.replace(/^[^:]*:\s*/, '') + '.',
    killed_cpa: 'Выключен, когда CPA на достаточной выборке был выше цели.',
    killed_early: 'Выключен раньше, чем набралось достаточно данных — по сути не протестирован.',
    killed_manual: 'Выключен при CPA в цели — по правилам причины не было.'
  }[x.verdictKind] || '';
  const act = {
    accruing: 'Ничего не трогать.',
    starved: 'Вынести в отдельный адсет со своим бюджетом или заменить.',
    rule_break: 'Выключить сейчас.',
    front_bad: 'Выключить.',
    cut: 'Урезать бюджет или выключить. Перед этим сверить выручку через 1–2 недели — когорты молодые.',
    watch: 'Бюджет не менять, смотреть тренд каждый день.',
    hold: 'Держать бюджет, копить до ' + (R.confirm_purchases_cw || 10) + ' подписчиков.',
    scale: 'Масштабировать.',
    killed_rule: 'Решение верное, не перезапускать в том же виде.',
    killed_late: 'На будущее — выключать на пороге.',
    killed_cpa: 'Решение верное.',
    killed_early: 'Можно перезапустить в отдельном адсете.',
    killed_manual: 'Выяснить причину; кандидат на перезапуск.'
  }[x.verdictKind] || '';
  const nx = nextMilestone(x);
  const cls = VERDICT_CLASS[x.verdictKind] || 'v-data';
  let h = '<div class="story ' + cls + '-edge"><p>' + t.map(esc).join(' ') + ' ' + esc(why) + '</p>' +
          '<p class="story-act"><b>→ ' + esc(act) + '</b>' + (nx ? '<span class="muted story-next">Что изменит решение: ' + nx.map(esc).join('; ') + '.</span>' : '') + '</p></div>';
  // key tiles
  const tile = (k, v, sub, c) => '<div class="kt"><span>' + k + '</span><b class="k' + (c || 'n') + '">' + v + '</b>' + (sub ? '<em>' + sub + '</em>' : '') + '</div>';
  const cwc = (x.cwCpa && x.cwSubs >= (R.judge_cpa_from_purchases_cw || 5)) ? (x.cwCpa <= R.hold_cpa_cw ? 'g' : (x.cwCpa > R.cut_cpa_cw ? 'r' : 'y')) : 'n';
  const crc = (x.cpr && PA && PA.breakevenCpr) ? (x.cpr <= PA.breakevenCpr ? 'g' : (PA.killCpr && x.cpr > PA.killCpr ? 'r' : 'y')) : 'n';
  h += '<div class="ktiles">' +
    tile('Расход', money(x.spend), isNew ? 'новый креатив' : 'перезапуск') +
    tile('Покупки · CPA', x.purchases + ' · ' + (x.cpa ? money(x.cpa) : '—'), 'Ads Manager') +
    tile('Биллинг', (x.cwSubs === null || x.cwSubs === undefined) ? '—' : x.cwSubs + ' · ' + (x.cwCpa ? money(x.cwCpa) : '—'), 'подп. · CPA, цель ≤ $' + R.hold_cpa_cw, cwc) +
    tile('Регистрация', x.cpr ? money(x.cpr) : '—', PA && PA.breakevenCpr ? 'окупаемо ≤ ' + money(PA.breakevenCpr) : (x.regs || 0) + ' рег.', crc) +
    tile('Рега → покупка', x.r2p !== null && x.r2p !== undefined && x.regs ? pct(x.r2p) : '—', (x.regs || 0) + ' рег., медиана 4.4%') +
    '</div>';
  return h;
}
function adCard(ad, account){
  return '<details class="breakdown-card adset-card ad-card' + (ad.status === "ACTIVE" ? "" : " is-paused") + '" data-status="' + ad.status + '" data-ad="' + esc(ad.id) + '"><summary>' +
    '<span class="disclosure-arrow">▸</span>' + dot(ad.status) +
    '<span class="card-title" title="' + esc(ad.name) + '">' + esc(ad.label) + '</span>' + verdictChip(ad) +
    '<span class="spacer"></span>' + inlineStats(ad, account) + '</summary>' +
    '<div class="card-body">' + verdictStory(ad, account) + trendChart(ad.daily) + bdGrid(ad.bd, ad.spend, ad.cpa, true) + '</div></details>';
}


// ---------- building blocks
function kpiRow(m, extra){
  let h = '<div class="kpi-row">';
  h += '<div class="kpi hero"><p class="kpi-label">CPA</p><p class="kpi-value num">' + money(m.cpa) + '</p></div>';
  h += '<div class="kpi"><p class="kpi-label">\u0420\u0430\u0441\u0445\u043e\u0434</p><p class="kpi-value num">' + money(m.spend) + '</p></div>';
  h += '<div class="kpi"><p class="kpi-label">\u041f\u0440\u043e\u0434\u0430\u0436\u0438</p><p class="kpi-value num">' + num(m.purchases) + '</p></div>';
  h += '<div class="kpi"><p class="kpi-label">CTR</p><p class="kpi-value num">' + pct(m.ctr) + '</p></div>';
  h += '<div class="kpi"><p class="kpi-label">CPC</p><p class="kpi-value num">' + money(m.cpc) + '</p></div>';
  h += '<div class="kpi"><p class="kpi-label">CPM</p><p class="kpi-value num">' + money(m.cpm) + '</p></div>';
  h += '<div class="kpi"><p class="kpi-label">\u041a\u043b\u0438\u043a \u2192 \u043f\u043e\u043a\u0443\u043f\u043a\u0430</p><p class="kpi-value num">' + pct(m.cr) + '</p></div>';
  (extra || []).forEach(e => { h += '<div class="kpi"><p class="kpi-label">' + e[0] + '</p><p class="kpi-value num">' + e[1] + '</p></div>'; });
  return h + '</div>';
}

const BD_FAMILIES = [
  ["country",   "\ud83c\udf0e \u0421\u0442\u0440\u0430\u043d\u0430"],
  ["age",       "\ud83c\udf82 \u0412\u043e\u0437\u0440\u0430\u0441\u0442"],
  ["gender",    "\ud83d\udeb9 \u041f\u043e\u043b"],
  ["ageGender", "\ud83d\udc65 \u0412\u043e\u0437\u0440\u0430\u0441\u0442 \u00d7 \u043f\u043e\u043b"],
  ["device",    "\ud83d\udcf1 \u0423\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u043e"],
  ["placement", "\ud83d\udcf2 \u041f\u043b\u0435\u0439\u0441\u043c\u0435\u043d\u0442"],
];
function bdTable(title, rows, total, avgCpa){
  if (!rows || !rows.length) return '';
  let h = '<div class="bd-block"><div class="bd-title">' + title + '</div><table class="bd2"><thead><tr><th class="l">Сегмент</th><th>Доля</th><th>Прод.</th><th>CPA</th></tr></thead><tbody>';
  rows.forEach(r => {
    const sh = total ? r.s / total * 100 : 0;
    let cls = 'n';
    if (!r.other && r.p >= 2 && avgCpa && r.cpa) cls = r.cpa <= avgCpa * 0.85 ? 'g' : (r.cpa >= avgCpa * 1.2 ? 'r' : 'n');
    if (!r.other && r.p === 0 && r.s >= 10) cls = 'r';
    h += '<tr class="' + (r.other ? 'bd-other' : '') + '" data-s="' + r.s + '" title="' + esc(r.v) + ': ' + money(r.s) + ', ' + r.p + ' прод.">' +
      '<td class="seg" data-v="' + esc(r.v) + '">' + esc(r.v) + '</td>' +
      '<td class="bar" data-v="' + sh.toFixed(3) + '"><span style="width:' + (Math.min(100, sh) * 0.7).toFixed(0) + '%"></span><em>' + sh.toFixed(0) + '%</em></td>' +
      '<td class="pp">' + r.p + '</td>' +
      '<td class="cc ' + cls + '" data-v="' + (r.cpa || (r.s >= 10 ? 1e9 : '')) + '">' + (r.cpa ? money(r.cpa) : (r.s >= 10 ? '0 прод.' : '—')) + '</td></tr>';
  });
  return h + '</tbody></table></div>';
}
function bdGrid(bd, total, avgCpa, collapsed){
  if (!bd || !total) return '<p class="muted small">Нет расхода — разбивать нечего.</p>';
  let grid = '<div class="breakdown-grid">';
  BD_FAMILIES.forEach(([k, t]) => { grid += bdTable(t, bd[k], total, avgCpa); });
  grid += '</div><p class="bd-legend">Полоса — доля расхода. CPA <span class="cc g">зелёный</span> — дешевле среднего на 15%+, <span class="cc r">красный</span> — дороже на 20%+ или траты без продаж. Оцениваются сегменты от 2 продаж.</p>';
  if (!collapsed) return grid;
  // one-line takeaway: cheapest / most expensive meaningful segments
  const all = [];
  ['country', 'age', 'gender', 'device', 'placement'].forEach(k => (bd[k] || []).forEach(r => { if (!r.other && r.p >= 2 && r.cpa && !BD_UNKNOWN.test(r.v)) all.push(r); }));
  all.sort((a, b) => a.cpa - b.cpa);
  const best = all.slice(0, 3).map(r => esc(r.v) + ' ' + money(r.cpa)).join(', ');
  const worst = all.slice(-2).reverse().filter(r => avgCpa && r.cpa > avgCpa).map(r => esc(r.v) + ' ' + money(r.cpa)).join(', ');
  return '<details class="bd-wrap"><summary><b>Разбивки</b>' + (best ? ' <span class="bd-hl g">дешевле всего: ' + best + '</span>' : '') +
         (worst ? ' <span class="bd-hl r">дороже всего: ' + worst + '</span>' : '') + '</summary>' + grid + '</details>';
}
function kfmt(v){ return v >= 1000 ? '$' + (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'K' : '$' + Math.round(v); }
function inlineStats(m, account){
  const R = LIFECYCLE_DB ? LIFECYCLE_DB.rulesCw : null;
  const PA = (account && FUNNEL_DB && FUNNEL_DB.perAccount) ? FUNNEL_DB.perAccount[account] : null;
  let bc = 'n', bv = '—', bt = 'нет данных биллинга';
  if (R && m.cwSubs !== undefined && m.cwSubs !== null && m.cwCpa) {
    bc = m.cwSubs < R.judge_cpa_from_purchases_cw ? 'n' : (m.cwCpa <= R.hold_cpa_cw ? 'g' : (m.cwCpa > R.cut_cpa_cw ? 'r' : 'y'));
    bv = money(m.cwCpa); bt = 'CPA по биллингу CW, ' + m.cwSubs + ' подп.';
  }
  let rc = 'n', rv = '—';
  if (m.cpr) { rc = PA && PA.breakevenCpr ? (m.cpr <= PA.breakevenCpr ? 'g' : (PA.killCpr && m.cpr > PA.killCpr ? 'r' : 'y')) : 'n'; rv = money(m.cpr); }
  return '<span class="card-stats">' +
    '<span class="cs c1" title="расход">' + kfmt(m.spend) + '</span>' +
    '<span class="cs c2" title="покупки в Ads Manager">' + m.purchases + ' пок.</span>' +
    '<span class="cs c3" title="CPA в Ads Manager">CPA <b>' + (m.cpa ? money(m.cpa) : '—') + '</b></span>' +
    '<span class="cs c4" title="' + bt + '">биллинг <b class="k' + bc + '">' + bv + '</b></span>' +
    '<span class="cs c5" title="цена регистрации' + (PA && PA.breakevenCpr ? ', окупаемая ' + money(PA.breakevenCpr) : '') + '">рега <b class="k' + rc + '">' + rv + '</b></span>' +
    '</span>';
}
function funnelLine(m){ return ""; }
function section(title, note){
  return '<h2 class="section">' + title + '</h2>' + (note ? '<p class="section-note">' + note + '</p>' : '');
}

// ---------- tables
function accountsTable(accs){
  const tot = accs.reduce((t, a) => { ["spend","purchases","impressions","clicks","wasteSpend"].forEach(k => t[k] += a[k]); return t; },
                          {spend:0, purchases:0, impressions:0, clicks:0, wasteSpend:0});
  let h = '<div class="tbl-wrap"><table class="summary-table"><thead><tr>' +
    '<th class="l">\u0410\u043a\u043a\u0430\u0443\u043d\u0442</th><th class="l">\u0420\u043e\u043b\u044c</th>' +
    '<th>\u041a\u0430\u043c\u043f.</th><th>\u0410\u0434\u0441\u0435\u0442\u044b</th><th>\u041e\u0431\u044a\u044f\u0432\u043b.</th>' +
    '<th>\u0420\u0430\u0441\u0445\u043e\u0434</th><th>\u041f\u0440\u043e\u0434.</th><th>CPA</th><th>CTR</th><th>CPC</th><th>CR</th>' +
    '<th title="\u0420\u0430\u0441\u0445\u043e\u0434 \u043d\u0430 \u043e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u044f \u0431\u0435\u0437 \u0435\u0434\u0438\u043d\u043e\u0439 \u043f\u0440\u043e\u0434\u0430\u0436\u0438">\u0411\u0435\u0437 \u043f\u0440\u043e\u0434\u0430\u0436</th></tr></thead><tbody>';
  accs.forEach(a => {
    h += '<tr class="jump-row' + (a.activeAdsets ? "" : " is-paused") + '" data-status="' + (a.activeAdsets ? "ACTIVE" : "PAUSED") + '" data-acct-jump="' + esc(a.name) + '"><td class="l"><b>' + esc(a.name) + '</b><div class="sub">' + a.agency + '</div></td>' +
      '<td class="l small">' + esc(a.role) + '</td>' +
      '<td>' + a.activeCampaigns + '/' + a.campaigns + '</td><td>' + a.activeAdsets + '/' + a.adsets + '</td><td>' + a.activeAds + '/' + a.ads + '</td>' +
      '<td>' + money(a.spend) + '</td><td>' + a.purchases + '</td><td>' + cpaPill(a.cpa) + '</td>' +
      '<td>' + pct(a.ctr) + '</td><td>' + money(a.cpc) + '</td><td>' + pct(a.cr) + '</td>' +
      '<td>' + money(a.wasteSpend) + ' <span class="muted small">' + share(a.wasteSpend, a.spend) + '</span></td></tr>';
  });
  const cpa = tot.purchases ? tot.spend / tot.purchases : null;
  h += '<tr class="total-row"><td class="l">\u0418\u0442\u043e\u0433\u043e</td><td></td>' +
    '<td>' + accs.reduce((s,a)=>s+a.activeCampaigns,0) + '/' + accs.reduce((s,a)=>s+a.campaigns,0) + '</td>' +
    '<td>' + accs.reduce((s,a)=>s+a.activeAdsets,0) + '/' + accs.reduce((s,a)=>s+a.adsets,0) + '</td>' +
    '<td>' + accs.reduce((s,a)=>s+a.activeAds,0) + '/' + accs.reduce((s,a)=>s+a.ads,0) + '</td>' +
    '<td>' + money(tot.spend) + '</td><td>' + tot.purchases + '</td><td>' + cpaPill(cpa) + '</td>' +
    '<td>' + pct(tot.impressions ? tot.clicks/tot.impressions*100 : null) + '</td>' +
    '<td>' + money(tot.clicks ? tot.spend/tot.clicks : null) + '</td>' +
    '<td>' + pct(tot.clicks ? tot.purchases/tot.clicks*100 : null) + '</td>' +
    '<td>' + money(tot.wasteSpend) + ' <span class="muted small">' + share(tot.wasteSpend, tot.spend) + '</span></td></tr>';
  return h + '</tbody></table></div>';
}
function bindAccountJumps(){
  document.querySelectorAll('[data-acct-jump]').forEach(r => r.addEventListener('click', () => goAccountDetail(r.getAttribute('data-acct-jump'))));
}
function adsTable(ads){
  let h = '<table class="mini-breakdown-table"><colgroup><col style="width:40%"><col style="width:16%"><col style="width:10%"><col style="width:14%"><col style="width:10%"><col style="width:10%"></colgroup>' +
    '<thead><tr><th>\u041e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u0435</th><th>\u0420\u0430\u0441\u0445\u043e\u0434</th><th>\u041f\u0440\u043e\u0434.</th><th>CPA</th><th>CTR</th><th>CR</th></tr></thead><tbody>';
  ads.forEach(ad => {
    h += '<tr><td title="' + esc(ad.name) + '">' + dot(ad.status) + ' ' + esc(ad.label) + '</td><td>' + money(ad.spend) + '</td><td>' + ad.purchases +
      '</td><td>' + cpaPill(ad.cpa) + '</td><td>' + pct(ad.ctr) + '</td><td>' + pct(ad.cr) + '</td></tr>';
  });
  return h + '</tbody></table>';
}
function placementsTable(pl, showAccount){
  let h = '<table class="mini-breakdown-table"><thead><tr>' + (showAccount ? '<th>\u0410\u043a\u043a\u0430\u0443\u043d\u0442</th>' : '') +
    '<th>\u041a\u0430\u043c\u043f\u0430\u043d\u0438\u044f / \u0430\u0434\u0441\u0435\u0442</th><th>\u0420\u0430\u0441\u0445\u043e\u0434</th><th>\u041f\u0440\u043e\u0434.</th><th>CPA</th><th>CTR</th></tr></thead><tbody>';
  pl.forEach(p => {
    h += '<tr>' + (showAccount ? '<td>' + esc(p.account) + '</td>' : '') +
      '<td title="' + esc(p.adset) + '">' + dot(p.status) + ' ' + esc(p.campaign) + ' <span class="muted">\u203a ' + esc(p.adset) + '</span></td>' +
      '<td>' + money(p.spend) + '</td><td>' + p.purchases + '</td><td>' + cpaPill(p.cpa) + '</td><td>' + pct(p.ctr) + '</td></tr>';
  });
  return h + '</tbody></table>';
}
function creativeCard(cr, showAccount){
  return '<details class="breakdown-card adset-card' + (cr.status === "ACTIVE" ? "" : " is-paused") + '" data-status="' + cr.status + '"><summary>' +
    '<span class="disclosure-arrow">\u25b8</span>' + dot(cr.status) +
    '<span class="card-title" title="' + esc(cr.name) + '">' + esc(cr.label) + '</span>' +
    (cr.pack ? '<span class="pack-chip">PACK ' + cr.pack + '</span>' : '') +
    '<span class="spacer"></span>' + cpaPill(cr.cpa) + inlineStats(cr) + '</summary>' +
    '<div class="card-body">' +
    '<div class="bd-title">\u0413\u0434\u0435 \u043a\u0440\u0443\u0442\u0438\u0442\u0441\u044f</div>' + placementsTable(cr.placements, showAccount) +
    bdGrid(cr.bd, cr.spend, cr.cpa, true) + '</div></details>';
}

// ---------- navigation
let navStack = [];
let view = { type: "home" };
let sidebarOpen = {};

function setView(v){ view = v; renderAll(); }
function homeEntry(){ return { label: "\u041c\u043e\u0439 \u0422\u0440\u0430\u0444\u0438\u043a", restore: () => setView({ type: "home" }) }; }
function agencyEntry(ag){ return { label: "\u0410\u0433\u0435\u043d\u0442\u0441\u0442\u0432\u043e " + ag, restore: () => setView({ type: "agency", agency: ag }) }; }
function accountEntry(n){ return { label: n, restore: () => setView({ type: "account", name: n }) }; }
function manualsEntry(){ return { label: "\u041c\u0430\u043d\u0443\u0430\u043b\u044b", restore: () => setView({ type: "manuals" }) }; }
function setNav(entries){ navStack = entries; navStack[navStack.length - 1].restore(); }

function goHome(){ setNav([homeEntry()]); }
function goAgency(ag){ setNav([homeEntry(), agencyEntry(ag)]); }
function goAccountDetail(name){
  const a = ACCOUNTS_DB.find(x => x.name === name);
  if (!a) { goHome(); return; }
  setNav([homeEntry(), agencyEntry(a.agency), accountEntry(name)]);
}
function goManualsMenu(){ openManualsWindow(); }
function goManual(key){ openManualsWindow(key); }
// legacy entry points kept so older buttons still land somewhere sensible
function goAccountsMenu(){ goHome(); }
function goTrafficMenu(){ goHome(); }
function goWinners(){ openPerformersWindow(); }

function navGoUp(){
  if (navStack.length <= 1) { goHome(); return; }
  navStack.pop();
  navStack[navStack.length - 1].restore();
}
function renderNavBar(){
  const labels = navStack.map(n => n.label);
  document.getElementById("xp-address").textContent = "C:\\" + labels.join("\\") + (labels.length ? "\\" : "");
  document.getElementById("xp-breadcrumb").textContent = labels.join(" \u203a ");
}

function agencies(){ return [...new Set(ACCOUNTS_DB.map(a => a.agency))]; }

// ---------- sidebar tree: Мой Трафик → агентства → аккаунты ; Мануалы
function renderSidebar(){
  const el = document.getElementById("camp-list");
  if (!el) return;
  const open = k => sidebarOpen[k] !== false;
  let h = '<div class="tree-row level-project' + (view.type === "home" ? " active" : "") + '" data-sb-home="1">' +
    '<span class="tree-chevron" data-sb-toggle="root">' + (open("root") ? "\u25be" : "\u25b8") + '</span>' +
    '<span class="tree-label" style="font-weight:700;">' + folderIcon(16) + ' \u041c\u043e\u0439 \u0422\u0440\u0430\u0444\u0438\u043a</span></div>';
  if (open("root")) {
    agencies().forEach(ag => {
      h += '<div class="tree-row level-folder' + (view.type === "agency" && view.agency === ag ? " active" : "") + '" data-sb-agency="' + ag + '">' +
        '<span class="tree-chevron" data-sb-toggle="ag-' + ag + '">' + (open("ag-" + ag) ? "\u25be" : "\u25b8") + '</span>' +
        '<span class="tree-label" style="font-weight:600;">\ud83c\udfe2 \u0410\u0433\u0435\u043d\u0442\u0441\u0442\u0432\u043e ' + ag + '</span></div>';
      if (open("ag-" + ag)) {
        ACCOUNTS_DB.filter(a => a.agency === ag).forEach(a => {
          h += '<div class="tree-row level-campaign' + (view.type === "account" && view.name === a.name ? " active" : "") + '" data-sb-account="' + esc(a.name) + '">' +
            '<span class="tree-label">' + folderIcon(14) + ' ' + esc(a.name) + '</span>' +
            '<span class="tree-meta">' + (a.spend ? money(a.cpa) : "\u2014") + '</span></div>';
        });
      }
    });
  }
  el.innerHTML = h;
  el.querySelectorAll("[data-sb-toggle]").forEach(t => t.addEventListener("click", e => {
    e.stopPropagation(); const k = t.getAttribute("data-sb-toggle"); sidebarOpen[k] = !(sidebarOpen[k] !== false); renderSidebar();
  }));
  el.querySelectorAll("[data-sb-home]").forEach(t => t.addEventListener("click", goHome));
  el.querySelectorAll("[data-sb-agency]").forEach(t => t.addEventListener("click", () => goAgency(t.getAttribute("data-sb-agency"))));
  el.querySelectorAll("[data-sb-account]").forEach(t => t.addEventListener("click", () => goAccountDetail(t.getAttribute("data-sb-account"))));
}

// ---------- screens
function syncNote(){
  return 'Данные: Meta Ads API (Supermetrics), ' + SYNC_INFO.window_start + ' — ' + SYNC_INFO.window_end + ', выгружено ' + SYNC_INFO.fetched_at +
         '. Пороги решений — в мануале «04 — Правила решений»; вердикты на карточках считаются по ним.';
}
function totalsOf(accs){
  const t = accs.reduce((t, a) => { ["spend","purchases","impressions","clicks"].forEach(k => t[k] += a[k]); return t; }, {spend:0, purchases:0, impressions:0, clicks:0});
  t.cpa = t.purchases ? t.spend / t.purchases : null;
  t.ctr = t.impressions ? t.clicks / t.impressions * 100 : null;
  t.cpc = t.clicks ? t.spend / t.clicks : null;
  t.cpm = t.impressions ? t.spend / t.impressions * 1000 : null;
  t.cr  = t.clicks ? t.purchases / t.clicks * 100 : null;
  return t;
}

function renderHome(){
  document.getElementById("campaign-title").innerHTML = folderIcon(20) + " Мой Трафик";
  const t = totalsOf(ACCOUNTS_DB);
  let h = csec("home-sum", "📊 Сводка", compactTotals(t), kpiRow(t, [["Активных адсетов", ACCOUNTS_DB.reduce((s, a) => s + a.activeAdsets, 0)]]) + '<p class="section-note">' + syncNote() + '</p>', true);
  let tiles = '<div class="tile-row">';
  agencies().forEach(ag => {
    const accs = ACCOUNTS_DB.filter(a => a.agency === ag);
    tiles += folderTile({ nav: "ag:" + ag, icon: folderIcon(56), title: "Агентство " + ag, sub: accs.length + " акк. · " + money(accs.reduce((s, a) => s + a.spend, 0)) });
  });
  h += csec("home-ag", "🏢 Агентства", agencies().length + " · " + agencies().join(", "), tiles + '</div>', true);
  h += csec("home-accs", "🗂 Аккаунты", ACCOUNTS_DB.length + " акк. · " + actionSummary(ACCOUNTS_DB.map(a => a.name)),
            oaCheckbox("home-only-active") + accountCards(ACCOUNTS_DB), true);
  h += csec("home-table", "📋 Таблица по аккаунтам", "клик по заголовку — сортировка", accountsTable(ACCOUNTS_DB), false);
  document.getElementById("content").innerHTML = h;
  bindTileNav(k => goAgency(k.slice(3)));
  bindAccountJumps();
  bindOnlyActive(document.getElementById("content"), "home-only-active", ".acc-card, table.summary-table tr[data-acct-jump]");
}

function renderAgency(ag){
  const accs = ACCOUNTS_DB.filter(a => a.agency === ag);
  document.getElementById("campaign-title").innerHTML = "🏢 Агентство " + ag;
  const t = totalsOf(accs);
  let h = csec("ag-sum", "📊 Сводка", compactTotals(t) + ' · ' + esc(accs[0] ? accs[0].bm : ""), kpiRow(t), true);
  h += csec("ag-accs", "🗂 Аккаунты", accs.length + " акк. · " + actionSummary(accs.map(a => a.name)),
            oaCheckbox("ag-only-active") + accountCards(accs), true);
  h += csec("ag-table", "📋 Таблица по аккаунтам", "клик по заголовку — сортировка", accountsTable(accs), false);
  document.getElementById("content").innerHTML = h;
  bindAccountJumps();
  bindOnlyActive(document.getElementById("content"), "ag-only-active", ".acc-card, table.summary-table tr[data-acct-jump]");
}

function renderAccount(name){
  const a = ACCOUNTS_DB.find(x => x.name === name);
  document.getElementById("campaign-title").innerHTML = folderIcon(20) + " " + esc(name);
  if (!a) { document.getElementById("content").innerHTML = '<p class="muted">\u0410\u043a\u043a\u0430\u0443\u043d\u0442 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d.</p>'; return; }
  let h = '<p class="section-note"><b>' + esc(a.role) + '</b> \u00b7 \u0430\u0433\u0435\u043d\u0442\u0441\u0442\u0432\u043e ' + a.agency + ' \u00b7 ' + esc(a.bm) + ' \u00b7 ID ' + a.metaId + '</p>';
  if (!a.ads) {
    h += '<div class="empty-note"><p><b>\u041d\u0430 \u044d\u0442\u043e\u043c \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0435 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043a\u0430\u043c\u043f\u0430\u043d\u0438\u0439.</b></p>' +
         '<p class="muted">\u0410\u043a\u043a\u0430\u0443\u043d\u0442 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0451\u043d \u0438 \u0432\u0438\u0434\u0435\u043d \u0432 Meta Ads API \u2014 \u044d\u0442\u043e \u043d\u0435 \u043f\u0440\u043e\u0431\u0435\u043b \u0432 \u0434\u0430\u043d\u043d\u044b\u0445, \u0430 \u0441\u0435\u0442\u0430\u043f.</p></div>';
    document.getElementById("content").innerHTML = h;
    return;
  }
  const factsHtml = '<div class="facts">' +
    '<span><b>' + a.activeCampaigns + '/' + a.campaigns + '</b> кампаний активно</span>' +
    '<span><b>' + a.activeAdsets + '/' + a.adsets + '</b> адсетов</span>' +
    '<span><b>' + a.activeAds + '/' + a.ads + '</b> объявлений</span>' +
    '<span><b>' + num(a.impressions) + '</b> показов · <b>' + num(a.clicks) + '</b> кликов</span>' +
    '<span>Паки: ' + a.packs.map(p => '<span class="pack-chip">' + p + '</span>').join(" ") + '</span></div>';
  h += csec("acc-sum", "📊 Сводка", compactTotals(a) + ' · без продаж ' + money(a.wasteSpend),
            kpiRow(a, [["Без продаж", money(a.wasteSpend) + ' <span class="small muted">' + share(a.wasteSpend, a.spend) + '</span>']]) + factsHtml, true);
  h += csec("acc-bd", "🧩 Разбивки по аккаунту", bdHeadline(a.bd, a.cpa), bdGrid(a.bd, a.spend, a.cpa, false), false);
  const camps = DATA.filter(c => c.account === name);
  const tools = '<div class="bulk-tools">' +
    '<button data-bulk="camps-open">Развернуть кампании</button><button data-bulk="camps-close">Свернуть кампании</button>' +
    '<span class="bt-sep"></span><button data-bulk="adsets-open">Развернуть все адсеты</button><button data-bulk="adsets-close">Свернуть все адсеты</button>' +
    '<span class="bt-sep"></span><button data-bulk="adsets-action">Раскрыть только требующие действия</button>' +
    '<label class="bt-check"><input type="checkbox" data-bulk="only-active"' + (SEC["acc-only-active"] ? " checked" : "") + '> только активные</label></div>';
  let ch = tools;
  camps.forEach((c, ci) => {
    ch += '<details class="breakdown-card campaign-card' + (c.status === "ACTIVE" ? "" : " is-paused") + '" data-status="' + c.status + '" data-camp="' + esc(c.key) + '"' + (ci === 0 ? " open" : "") + '><summary>' +
      '<span class="disclosure-arrow">▸</span>' + dot(c.status) + '<span class="card-title" title="' + esc(c.key) + '"><b>' + esc(c.label) + '</b></span>' + verdictChip(c) +
      '<span class="muted small">' + c.adsets.filter(x => x.status === "ACTIVE").length + '/' + c.adsets.length + ' акт.</span>' +
      '<span class="spacer"></span>' + inlineStats(c, name) + '</summary><div class="card-body camp-body">';
    c.adsets.forEach(x => {
      ch += '<details class="breakdown-card adset-card' + (x.status === "ACTIVE" ? "" : " is-paused") + '" data-status="' + x.status + '" data-kind="' + x.verdictKind + '" data-adset="' + esc(x.name) + '"><summary>' +
        '<span class="disclosure-arrow">▸</span>' + dot(x.status) + '<span class="card-title" title="' + esc(x.name) + '">' + esc(x.name) + '</span>' + verdictChip(x) +
        '<span class="spacer"></span>' + inlineStats(x, name) + '</summary><div class="card-body">' +
        verdictStory(x, name) + trendChart(x.daily) + bdGrid(x.bd, x.spend, x.cpa, true) +
        '<div class="bd-title">Креативы в адсете (' + x.ads.length + ')</div>' +
        x.ads.map(ad => adCard(ad, name)).join("") +
        '</div></details>';
    });
    ch += '</div></details>';
  });
  h += csec("acc-camps", "📂 Кампании и адсеты (" + camps.length + ")", actionSummary([name]), ch, true);
  document.getElementById("content").innerHTML = h;
  bindAccountTools(document.getElementById("content"));
}

function renderAll(){
  renderSidebar();
  renderNavBar();
  const tb = document.getElementById("tabbar"); if (tb) tb.innerHTML = "";
  const bw = document.getElementById("back-to-winners"); if (bw) bw.innerHTML = "";
  if (view.type === "home") renderHome();
  else if (view.type === "agency") renderAgency(view.agency);
  else if (view.type === "account") renderAccount(view.name);
  else renderHome();
  const content = document.getElementById("content");
  makeSortable(content); bindSections(content);
}

// ---------- Performers window (desktop)
function renderPerformers(){
  const P = PERFORMERS;
  const t = P.reduce((t, c) => { t.s += c.spend; t.p += c.purchases; return t; }, { s: 0, p: 0 });
  let h = '<p class="section-note">\u041a\u0440\u0435\u0430\u0442\u0438\u0432\u044b, \u0441\u0434\u0435\u043b\u0430\u0432\u0448\u0438\u0435 <b>\u0431\u043e\u043b\u044c\u0448\u0435 ' + (SYNC_INFO.performerMin - 1) + ' \u043f\u043e\u043a\u0443\u043f\u043e\u043a</b> \u0441\u0443\u043c\u043c\u0430\u0440\u043d\u043e \u043f\u043e \u0432\u0441\u0435\u043c \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430\u043c. ' +
    '\u0421\u043f\u0438\u0441\u043e\u043a \u0441\u0442\u0440\u043e\u0438\u0442\u0441\u044f \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438 \u0438\u0437 \u0431\u0430\u0437\u044b \u2014 \u043d\u043e\u0432\u044b\u0439 \u043a\u0440\u0435\u0430\u0442\u0438\u0432 \u043f\u043e\u043f\u0430\u0434\u0451\u0442 \u0441\u044e\u0434\u0430 \u0441\u0430\u043c, \u043a\u0430\u043a \u0442\u043e\u043b\u044c\u043a\u043e \u043d\u0430\u0431\u0435\u0440\u0451\u0442 \u043f\u043e\u0440\u043e\u0433. ' +
    '\u0412\u0441\u0435\u0433\u043e ' + P.length + ' \u00b7 ' + money(t.s) + ' \u00b7 ' + t.p + ' \u043f\u0440\u043e\u0434. (' + share(t.p, ACCOUNTS_DB.reduce((s,a)=>s+a.purchases,0)) + ' \u0432\u0441\u0435\u0445 \u043f\u0440\u043e\u0434\u0430\u0436). \u0421\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u043a\u0430 \u043f\u043e CPA.</p>';
  h += '<div class="tbl-wrap"><table class="summary-table"><thead><tr><th class="l">\u041a\u0440\u0435\u0430\u0442\u0438\u0432</th><th>\u041f\u0430\u043a</th><th class="l">\u0413\u0434\u0435</th>' +
       '<th>\u0420\u0430\u0441\u0445\u043e\u0434</th><th>\u041f\u0440\u043e\u0434.</th><th>CPA</th><th>CTR</th><th>CR</th></tr></thead><tbody>';
  P.forEach((c, i) => {
    const accs = [...new Set(c.placements.map(p => p.account))];
    h += '<tr class="jump-row' + (c.status === "ACTIVE" ? "" : " is-paused") + '" data-status="' + c.status + '" data-perf-jump="' + i + '"><td class="l">' + dot(c.status) + ' <b>' + esc(c.label) + '</b></td><td>' + c.pack + '</td>' +
      '<td class="l small">' + accs.map(esc).join(", ") + '</td><td>' + money(c.spend) + '</td><td>' + c.purchases + '</td><td>' + cpaPill(c.cpa) + '</td>' +
      '<td>' + pct(c.ctr) + '</td><td>' + pct(c.cr) + '</td></tr>';
  });
  h += '</tbody></table></div>';
  h += oaCheckbox("perf-only-active");
  h += section("\u0420\u0430\u0437\u0431\u0438\u0432\u043a\u0438 \u043f\u043e \u043a\u0430\u0436\u0434\u043e\u043c\u0443");
  P.forEach((c, i) => { h += '<div id="perf-card-' + i + '" data-status="' + c.status + '" class="' + (c.status === "ACTIVE" ? "" : "is-paused") + '">' + creativeCard(c, true) + '</div>'; });
  const box = document.getElementById("xp-perf-body");
  box.innerHTML = h;
  makeSortable(box);
  box.querySelectorAll("[data-perf-jump]").forEach(r => r.addEventListener("click", () => {
    const card = document.getElementById("perf-card-" + r.getAttribute("data-perf-jump"));
    const d = card.querySelector("details"); d.open = true;
    if (card.scrollIntoView) card.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  bindOnlyActive(box, "perf-only-active", "table.summary-table tr[data-perf-jump], [id^='perf-card-']");
}
function openPerformersWindow(){
  renderPerformers();
  document.getElementById("xp-perf-window").classList.add("open");
  document.getElementById("xp-taskbar-perf").style.display = "none";
  const ic = document.getElementById("xp-desktop-perf-icon"); if (ic) ic.classList.add("selected");
}
function closePerformersWindow(){
  const w = document.getElementById("xp-perf-window");
  w.classList.remove("open"); w.classList.remove("maximized");
  document.getElementById("xp-taskbar-perf").style.display = "none";
  const ic = document.getElementById("xp-desktop-perf-icon"); if (ic) ic.classList.remove("selected");
}
function minimizePerformersWindow(){
  document.getElementById("xp-perf-window").classList.remove("open");
  document.getElementById("xp-taskbar-perf").style.display = "flex";
}

// ---------- keep the account scheme's pack lists in sync with the database
function syncTreePacks(){
  const inv = {};
  ACCOUNTS_DB.forEach(a => a.packs.forEach(p => { (inv[p] = inv[p] || []).push(a.name); }));
  const short = n => n.startsWith("Account-") ? n.slice(8) : (n.endsWith("-1") ? "GIQ" : "GIQ2");
  (function walk(n){
    if (n.kind === "account" && n.link) {
      const a = ACCOUNTS_DB.find(x => x.name === n.link);
      if (a && a.packs.length) {
        n.children = [{ kind: "packbox", label: "", title: "\u041f\u0430\u043a\u0438 \u043a\u0440\u0435\u0430\u0442\u0438\u0432\u043e\u0432: " + a.packs.length,
          packs: a.packs.map(p => { const others = inv[p].filter(x => x !== a.name); return { id: p, shared: others.length > 0, also: others.map(short).join(" ") }; }) }];
        if (n.collapsed === undefined) n.collapsed = true;
      } else { n.children = []; }
    }
    (n.children || []).forEach(walk);
  })(ACCOUNTS_TREE);
}

// ---------- Гео window (Campaignswell): sortable, LatAm toggle, verdicts
let geoSort = { key: "verdictLabel", dir: 1 };
let geoShowLatam = false;
let geoHideSmall = false;
let geoOpen = {};
const GEO_COLS = [
  ["country", "\u0413\u0435\u043e", "l"], ["verdictLabel", "\u0412\u0435\u0440\u0434\u0438\u043a\u0442", "l"],
  ["spend", "\u0420\u0430\u0441\u0445\u043e\u0434"], ["subscribers", "\u041f\u043e\u0434\u043f."], ["cpa", "CPA"],
  ["revenue", "Revenue"], ["arpu", "ARPU"], ["profit", "\u041f\u0440\u0438\u0431\u044b\u043b\u044c"],
  ["roi", "ROI"], ["roas7", "ROAS 7\u0434"], ["proi3m", "pROI 3\u043c"],
  ["aliveRate", "Alive %"], ["refundRate", "Refund %"],
];
const VERDICT_ORDER = { scale: 0, hold: 1, watch: 2, cut: 3, data: 4 };
function signPct(v){ return (v === null || v === undefined) ? "\u2014" : (v > 0 ? "+" : "") + (v * 100).toFixed(0) + "%"; }
function roiCell(v){ const c = v === null ? "" : (v >= 0.5 ? "cpa-good" : (v >= 0 ? "cpa-warn" : "cpa-bad")); return '<span class="cpa-pill ' + c + '">' + signPct(v) + '</span>'; }
function geoTotals(rows){
  const s = k => rows.reduce((a, g) => a + g[k], 0);
  const spend = s("spend"), subs = s("subscribers"), alive = s("alive"), rev = s("revenue"),
        rev7 = rows.reduce((a, g) => a + g.roas7 * g.spend, 0), p3 = s("pRevenue3m");
  return { country: "\u0418\u0442\u043e\u0433\u043e (" + rows.length + ")", spend, subscribers: subs, revenue: rev, profit: rev - spend,
    cpa: subs ? spend / subs : null, arpu: subs ? rev / subs : null, roi: spend ? (rev - spend) / spend : null,
    roas7: spend ? rev7 / spend : null, proi3m: spend ? (p3 - spend) / spend : null, aliveRate: subs ? alive / subs * 100 : null };
}
function geoRows(){
  let r = GEO_DB.rows.filter(g => geoShowLatam || !g.latam);
  if (geoHideSmall) r = r.filter(g => g.verdict !== "data");
  const k = geoSort.key, d = geoSort.dir;
  return r.slice().sort((a, b) => {
    if (k === "verdictLabel") return d * (VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict]) || (b.roi - a.roi);
    if (k === "country") return d * a.country.localeCompare(b.country);
    const av = a[k], bv = b[k];
    if (av === null) return 1; if (bv === null) return -1;
    return d * (av - bv);
  });
}

function geoCreativesTable(){
  const cr = GEO_DB.creatives;
  const tot = cr.reduce((t, c) => { t.spend += c.spend; t.revenue += c.revenue; return t; }, { spend: 0, revenue: 0 });
  let h = '<h2 class="section" style="margin-top:22px;">\ud83c\udfaf \u041a\u0440\u0435\u0430\u0442\u0438\u0432\u044b \u0441 CPA \u2264 $' + GEO_DB.creativeCpaMax.toFixed(0) + ' (Campaignswell, \u0432\u0441\u0435 \u0433\u0435\u043e)</h2>';
  h += '<p class="section-note">\u0422\u043e\u043b\u044c\u043a\u043e IQ_PACK \u2014 \u043a\u0440\u0435\u0430\u0442\u0438\u0432\u044b Cosma \u0438 Nrrtv \u0438\u0437 \u044d\u0442\u043e\u0439 \u0442\u0430\u0431\u043b\u0438\u0446\u044b \u0438\u0441\u043a\u043b\u044e\u0447\u0435\u043d\u044b \u043d\u0430\u043c\u0435\u0440\u0435\u043d\u043d\u043e \u2014 \u044d\u0442\u043e \u0434\u0440\u0443\u0433\u0438\u0435 \u043f\u0440\u043e\u0434\u0443\u043a\u0442\u044b \u0432 \u0442\u043e\u0439 \u0436\u0435 \u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u0438 Campaignswell, \u0441\u0435\u0439\u0447\u0430\u0441 \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u043c \u0442\u043e\u043b\u044c\u043a\u043e \u0441 IQ-\u0442\u0435\u0441\u0442\u0430\u043c\u0438. \u0421\u0447\u0438\u0442\u0430\u043d\u043e \u043f\u043e \u0432\u0441\u0435\u043c \u0433\u0435\u043e \u0441\u0440\u0430\u0437\u0443, \u043d\u0435 \u0442\u043e\u043b\u044c\u043a\u043e \u0442\u0435\u043c, \u0433\u0434\u0435 ROI &gt; 100%.</p>';
  h += '<div class="tbl-wrap"><table class="summary-table"><thead><tr>' +
    '<th class="l">\u041a\u0440\u0435\u0430\u0442\u0438\u0432</th><th>\u0420\u0430\u0441\u0445\u043e\u0434</th><th>\u041f\u043e\u0434\u043f.</th><th>CPA</th>' +
    '<th>Revenue</th><th>ARPU</th><th>\u041f\u0440\u0438\u0431\u044b\u043b\u044c</th><th>ROI</th></tr></thead><tbody>';
  cr.forEach(c => {
    h += '<tr><td class="l" title="' + esc(c.adName) + '"><b>' + esc(c.adName) + '</b></td>' +
      '<td>' + money(c.spend) + '</td><td>' + num(c.subscribers) + '</td>' +
      '<td><span class="cpa-pill ' + (c.cpa <= 10 ? "cpa-good" : "cpa-warn") + '">' + money(c.cpa) + '</span></td>' +
      '<td>' + money(c.revenue) + '</td><td>' + money(c.arpu) + '</td>' +
      '<td class="' + (c.profit >= 0 ? "pos" : "neg") + '">' + money(c.profit) + '</td><td>' + roiCell(c.roi) + '</td></tr>';
  });
  h += '<tr class="total-row"><td class="l">\u0418\u0442\u043e\u0433\u043e (' + cr.length + ')</td><td>' + money(tot.spend) + '</td><td></td><td></td>' +
    '<td>' + money(tot.revenue) + '</td><td></td><td class="' + (tot.revenue - tot.spend >= 0 ? "pos" : "neg") + '">' + money(tot.revenue - tot.spend) + '</td>' +
    '<td>' + roiCell(tot.spend ? (tot.revenue - tot.spend) / tot.spend : null) + '</td></tr>';
  h += '</tbody></table></div>';
  return h;
}

function geoCreativeCards(g){
  const cr = g.topCreatives || [];
  if (!cr.length) return '<p class="muted small">\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445 \u043f\u043e \u043a\u0440\u0435\u0430\u0442\u0438\u0432\u0430\u043c \u0434\u043b\u044f \u044d\u0442\u043e\u0433\u043e \u0433\u0435\u043e.</p>';
  let h = '<div class="geo-cards-note">\u0422\u043e\u043f-' + cr.length + ' IQ-\u043a\u0440\u0435\u0430\u0442\u0438\u0432\u043e\u0432 \u043f\u043e \u043f\u043e\u0434\u043f\u0438\u0441\u0447\u0438\u043a\u0430\u043c \u0438\u0437 ' + g.creativesTotal + ' \u0432 ' + esc(g.country) + ' \u00b7 \u0432\u0441\u0435 \u0437\u0430\u043f\u0443\u0441\u043a\u0438 \u0438 \u0434\u0443\u0431\u043b\u0438 \u0441\u0443\u043c\u043c\u0438\u0440\u043e\u0432\u0430\u043d\u044b \u00b7 \u0431\u0438\u043b\u043b\u0438\u043d\u0433 CW</div><div class="geo-cards">';
  cr.forEach((c, i) => {
    h += '<div class="geo-card"><div class="geo-card-head"><span class="geo-rank">#' + (i + 1) + '</span><span class="geo-card-title" title="' + esc(c.name) + '">' + esc(c.label) + '</span>' +
      (c.pack ? '<span class="pack-chip">' + c.pack + '</span>' : '') + '</div>' +
      '<div class="geo-card-kpis"><span><b>' + num(c.subscribers) + '</b> \u043f\u043e\u0434\u043f. \u00b7 ' + c.share + '% \u0433\u0435\u043e</span>' +
      '<span>CPA <span class="cpa-pill ' + cpaClass(c.cpa) + '">' + money(c.cpa) + '</span></span>' +
      '<span>ROI ' + roiCell(c.roi) + '</span></div>' +
      '<div class="geo-card-foot">' + money(c.spend) + ' \u0440\u0430\u0441\u0445\u043e\u0434 \u00b7 ' + money(c.revenue) + ' \u0432\u044b\u0440\u0443\u0447\u043a\u0430 \u00b7 ARPU ' + money(c.arpu) + ' \u00b7 ' + c.launches + ' \u0437\u0430\u043f\u0443\u0441\u043a' + (c.launches === 1 ? '' : (c.launches < 5 ? '\u0430' : '\u043e\u0432')) + '</div></div>';
  });
  return h + '</div>';
}
function lifecycleSection(){
  const L = (typeof LIFECYCLE_DB !== "undefined") ? LIFECYCLE_DB : null;
  if (!L) return '<p class="muted small">\u0410\u043d\u0430\u043b\u0438\u0437 \u0436\u0438\u0437\u043d\u0435\u043d\u043d\u043e\u0433\u043e \u0446\u0438\u043a\u043b\u0430 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d \u0432 \u044d\u0442\u043e\u043c \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0438.</p>';
  const R = L.rulesCw, M = RULES_META;
  let h = '<h2 class="section" style="margin-top:26px;">\ud83e\udded \u041f\u0440\u0430\u0432\u0438\u043b\u0430 \u0440\u0435\u0448\u0435\u043d\u0438\u0439 \u2014 \u043d\u0430 \u0447\u0451\u043c \u043e\u043d\u0438 \u043e\u0441\u043d\u043e\u0432\u0430\u043d\u044b</h2>';
  h += '<p class="section-note">\u041f\u043e\u043b\u043d\u0430\u044f \u0438\u0441\u0442\u043e\u0440\u0438\u044f IQ-\u043a\u0440\u0435\u0430\u0442\u0438\u0432\u043e\u0432 \u0432 Campaignswell (' + L.window.start + ' \u2014 ' + L.window.end + '): ' + L.ads + ' \u043a\u0440\u0435\u0430\u0442\u0438\u0432\u043e\u0432 \u0441 \u043f\u0435\u0440\u0432\u043e\u0433\u043e \u0434\u043d\u044f (\u0435\u0449\u0451 ' + L.excluded + ' \u0438\u0441\u043a\u043b\u044e\u0447\u0435\u043d\u043e \u2014 \u0443\u0436\u0435 \u043a\u0440\u0443\u0442\u0438\u043b\u0438\u0441\u044c \u043d\u0430 \u0441\u0442\u0430\u0440\u0442\u0435 \u043e\u043a\u043d\u0430). ' +
       '\u041f\u0440\u0438\u0431\u044b\u043b\u044c\u043d\u044b\u0439 \u0432\u0438\u043d\u0435\u0440 = &gt;5 \u043f\u043e\u0434\u043f\u0438\u0441\u0447\u0438\u043a\u043e\u0432 \u0438 CPA \u2264 $' + R.hold_cpa_cw + ' \u043f\u043e \u0431\u0438\u043b\u043b\u0438\u043d\u0433\u0443: <b>' + L.profitable + '</b> (\u0432 \u0441\u0440\u0435\u0434\u043d\u0435\u043c ' + money(L.avgWinner.spend) + ', ' + L.avgWinner.subs + ' \u043f\u043e\u0434\u043f., CPA ' + money(L.avgWinner.cpa) + '). \u041f\u0440\u043e\u0432\u0430\u043b\u044c\u043d\u044b\u0439 \u0442\u0435\u0441\u0442 = \u2265$30 \u0438 \u22641 \u043f\u043e\u0434\u043f. \u0438\u043b\u0438 CPA &gt; $' + R.early_fail_cpa_cw + ': <b>' + L.failed + '</b>.</p>';
  const fp = L.firstPurchase;
  h += '<div class="facts"><span>\u041f\u0435\u0440\u0432\u0430\u044f \u043f\u0440\u043e\u0434\u0430\u0436\u0430 \u0443 \u0432\u0438\u043d\u0435\u0440\u0430: \u043c\u0435\u0434\u0438\u0430\u043d\u0430 <b>' + money(fp["1"].med) + '</b>, 90% \u2014 \u0434\u043e <b>' + money(fp["1"].p90) + '</b></span>' +
       '<span>\u0412\u0442\u043e\u0440\u0430\u044f: \u043c\u0435\u0434\u0438\u0430\u043d\u0430 ' + money(fp["2"].med) + ', 90% \u2014 \u0434\u043e ' + money(fp["2"].p90) + '</span>' +
       '<span>\u041f\u043e \u0432\u0440\u0435\u043c\u0435\u043d\u0438: \u043c\u0435\u0434\u0438\u0430\u043d\u0430 ' + L.days1.med + ' \u0434\u043d., 90% \u2014 \u0437\u0430 ' + L.days1.p90 + ' \u0434\u043d. \u2192 \u0440\u0435\u0448\u0430\u0435\u0442 \u0440\u0430\u0441\u0445\u043e\u0434, \u0430 \u043d\u0435 \u0434\u043d\u0438</span>' +
       '<span>\u0411\u044e\u0434\u0436\u0435\u0442 \u0432\u0438\u043d\u0435\u0440\u043e\u0432: ' + money(L.ramp.d13) + '/\u0434\u0435\u043d\u044c \u0432 \u0434\u043d\u0438 1\u20133 \u2192 ' + money(L.ramp.d410) + '/\u0434\u0435\u043d\u044c \u0432 \u0434\u043d\u0438 4\u201310</span></div>';
  h += '<div class="bd-title">\u041f\u0440\u0430\u0432\u0438\u043b\u043e \u043e\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0438: \u00ab0 \u043f\u0440\u043e\u0434\u0430\u0436 \u043a $X \u0438\u043b\u0438 \u22641 \u043a $Y\u00bb</div><div class="tbl-wrap"><table class="summary-table"><thead><tr><th class="l">\u041f\u0440\u0430\u0432\u0438\u043b\u043e</th><th>\u041f\u043e\u0442\u0435\u0440\u044f\u043d\u043e \u043f\u0440\u0438\u0431\u044b\u043b\u044c\u043d\u044b\u0445 \u0432\u0438\u043d\u0435\u0440\u043e\u0432</th><th>\u041f\u043e\u0439\u043c\u0430\u043d\u043e \u043f\u0440\u043e\u0432\u0430\u043b\u043e\u0432</th><th>\u0421\u044d\u043a\u043e\u043d\u043e\u043c\u043b\u0435\u043d\u043e</th></tr></thead><tbody>';
  L.rules.forEach(r => {
    const on = r.x === L.chosen.x && r.y === L.chosen.y;
    h += '<tr' + (on ? ' class="total-row"' : '') + '><td class="l">$' + r.x + ' / $' + r.y + (on ? ' \u2190 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u044e\u0449\u0435\u0435' : '') + '</td><td>' + r.lost + ' (' + r.lostPct + '%)</td><td>' + r.caught + ' \u0438\u0437 ' + L.failed + '</td><td>' + money(r.saved) + '</td></tr>';
  });
  h += '</tbody></table></div>';
  const K = L.byKind, M2 = RULES_META;
  h += '<div class="bd-title">\u041d\u043e\u0432\u044b\u0439 \u043a\u0440\u0435\u0430\u0442\u0438\u0432 \u0438 \u043f\u0435\u0440\u0435\u0437\u0430\u043f\u0443\u0441\u043a \u0432\u0435\u0434\u0443\u0442 \u0441\u0435\u0431\u044f \u043f\u043e-\u0440\u0430\u0437\u043d\u043e\u043c\u0443 (\u0430\u043d\u0430\u043b\u0438\u0437 \u043f\u043e \u043a\u0430\u0436\u0434\u043e\u043c\u0443 \u0437\u0430\u043f\u0443\u0441\u043a\u0443, \u0434\u0443\u0431\u043b\u0438 \u0441\u0447\u0438\u0442\u0430\u044e\u0442\u0441\u044f \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e)</div><div class="tbl-wrap"><table class="summary-table"><thead><tr><th class="l"></th><th>\u0417\u0430\u043f\u0443\u0441\u043a\u043e\u0432</th><th>\u041f\u0440\u0438\u0431\u044b\u043b\u044c\u043d\u044b\u0445</th><th>1-\u044f \u043f\u0440\u043e\u0434\u0430\u0436\u0430: \u043c\u0435\u0434. / \u043c\u0430\u043a\u0441.</th><th>2-\u044f: \u043c\u0435\u0434. / \u043c\u0430\u043a\u0441.</th><th>\u041f\u0440\u0430\u0432\u0438\u043b\u043e</th></tr></thead><tbody>';
  [["new", "\u041d\u043e\u0432\u044b\u0439 \u043a\u0440\u0435\u0430\u0442\u0438\u0432 (1-\u0439 \u0437\u0430\u043f\u0443\u0441\u043a)", M2.stop0New, M2.stop1New], ["relaunch", "\u041f\u0435\u0440\u0435\u0437\u0430\u043f\u0443\u0441\u043a / \u0434\u0443\u0431\u043b\u044c", M2.stop0, M2.stop1]].forEach(([k, lbl, x, y]) => {
    const v = K[k]; const rr = v.rules.find(r => r.x === x && r.y === y) || v.rules[0];
    h += '<tr><td class="l">' + lbl + '</td><td>' + v.launches + '</td><td>' + v.profitable + '</td><td>' + (v.first ? money(v.first.med) + ' / ' + money(v.first.max) : '\u2014') + '</td><td>' + (v.second ? money(v.second.med) + ' / ' + money(v.second.max) : '\u2014') + '</td><td><b>$' + x + ' / $' + y + '</b> \u2014 \u043f\u043e\u0442\u0435\u0440\u044f ' + rr.lost + ' \u0438\u0437 ' + v.profitable + '</td></tr>';
  });
  h += '</tbody></table></div>';
  h += '<div class="bd-title">\u0411\u044e\u0434\u0436\u0435\u0442 \u2192 \u0432\u0440\u0435\u043c\u044f \u0434\u043e \u0440\u0435\u0448\u0435\u043d\u0438\u044f (\u0441\u0440\u0435\u0434\u043d\u0438\u0439 \u0440\u0430\u0441\u0445\u043e\u0434 \u0437\u0430 \u043f\u0435\u0440\u0432\u044b\u0435 3 \u0434\u043d\u044f \u0437\u0430\u043f\u0443\u0441\u043a\u0430)</div><div class="tbl-wrap"><table class="summary-table"><thead><tr><th class="l">\u0411\u044e\u0434\u0436\u0435\u0442/\u0434\u0435\u043d\u044c</th><th>\u0417\u0430\u043f\u0443\u0441\u043a\u043e\u0432</th><th>$ \u0434\u043e 1-\u0439 \u043f\u0440\u043e\u0434\u0430\u0436\u0438</th><th>\u0414\u043d\u0435\u0439 \u0434\u043e 1-\u0439 \u043f\u0440\u043e\u0434\u0430\u0436\u0438</th><th>\u0414\u043d\u0435\u0439 \u0434\u043e $50</th><th>\u0412\u0438\u043d\u0435\u0440\u044b: \u043d\u043e\u0432\u044b\u0435</th><th>\u0412\u0438\u043d\u0435\u0440\u044b: \u043f\u0435\u0440\u0435\u0437\u0430\u043f\u0443\u0441\u043a\u0438</th></tr></thead><tbody>';
  L.budget.forEach(b => {
    h += '<tr><td class="l">$' + b.lo + (b.hi === null ? '+' : '\u2013' + b.hi) + '</td><td>' + b.n + '</td><td>' + money(b.usd1) + '</td><td>' + (b.days1 === null ? '\u2014' : b.days1) + '</td><td>' + (b.daysTo50 === null ? '\u2014' : b.daysTo50) + '</td><td>' + b.winNew + '%</td><td>' + b.winRe + '%</td></tr>';
  });
  h += '</tbody></table></div>';
  h += '<div class="facts"><span>\u041a\u043e\u0440\u0440\u0435\u043b\u044f\u0446\u0438\u044f \u0431\u044e\u0434\u0436\u0435\u0442 \u2194 $ \u0434\u043e 1-\u0439 \u043f\u0440\u043e\u0434\u0430\u0436\u0438: <b>' + L.corr.budgetUsd + '</b> (\u043f\u043e\u0447\u0442\u0438 \u043d\u0435\u0442 \u2014 \u0441\u0443\u043c\u043c\u0430 \u043d\u0435 \u0437\u0430\u0432\u0438\u0441\u0438\u0442 \u043e\u0442 \u0431\u044e\u0434\u0436\u0435\u0442\u0430)</span>' +
       '<span>\u0431\u044e\u0434\u0436\u0435\u0442 \u2194 \u0434\u043d\u0438 \u0434\u043e 1-\u0439 \u043f\u0440\u043e\u0434\u0430\u0436\u0438: <b>' + L.corr.budgetDays + '</b> (\u0441\u0438\u043b\u044c\u043d\u0430\u044f \u2014 \u0431\u044e\u0434\u0436\u0435\u0442 \u043f\u043e\u043a\u0443\u043f\u0430\u0435\u0442 \u0432\u0440\u0435\u043c\u044f)</span>' +
       '<span>\u0414\u043d\u0435\u0439 \u0434\u043e \u0440\u0435\u0448\u0435\u043d\u0438\u044f \u2248 \u043f\u043e\u0440\u043e\u0433 $ / \u0431\u044e\u0434\u0436\u0435\u0442 \u0432 \u0434\u0435\u043d\u044c</span></div>';
  h += '<p class="section-note"><b>Meta \u043d\u0435 \u043e\u0442\u043a\u0440\u0443\u0447\u0438\u0432\u0430\u0435\u0442:</b> ' + L.starve.n + ' \u0438\u0437 ' + L.starve.of + ' \u043d\u043e\u0432\u044b\u0445 \u0437\u0430\u043f\u0443\u0441\u043a\u043e\u0432 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u0438 \u043c\u0435\u043d\u044c\u0448\u0435 $' + L.rulesCw.starve_daily + '/\u0434\u0435\u043d\u044c \u0437\u0430 \u043f\u0435\u0440\u0432\u044b\u0435 ' + L.rulesCw.starve_days + ' \u0434\u043d\u044f (' + money(L.starve.spend) + ' \u0440\u0430\u0441\u0445\u043e\u0434\u0430) \u2014 \u0432\u0438\u043d\u0435\u0440\u043e\u043c \u0441\u0442\u0430\u043b\u043e ' + L.starve.winners + '. \u041e\u0431\u044b\u0447\u043d\u043e \u044d\u0442\u043e \u0432\u0442\u043e\u0440\u043e\u0435-\u0442\u0440\u0435\u0442\u044c\u0435 \u043e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u0435 \u0432 \u0430\u0434\u0441\u0435\u0442\u0435, \u0431\u044e\u0434\u0436\u0435\u0442 \u0437\u0430\u0431\u0438\u0440\u0430\u0435\u0442 \u0441\u043e\u0441\u0435\u0434. \u0416\u0434\u0430\u0442\u044c $30 \u0442\u0430\u043a\u043e\u043c\u0443 \u043e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u044e \u2014 \u043d\u0435\u0434\u0435\u043b\u0438; \u0447\u0435\u0441\u0442\u043d\u044b\u0439 \u0442\u0435\u0441\u0442 \u2014 \u0432 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e\u043c \u0430\u0434\u0441\u0435\u0442\u0435.</p>';
  h += '<div class="bd-title">\u041a\u043e\u0433\u0434\u0430 \u043c\u0430\u0441\u0448\u0442\u0430\u0431\u0438\u0440\u043e\u0432\u0430\u0442\u044c: \u0434\u043e\u043b\u044f \u0441\u0442\u0430\u0432\u0448\u0438\u0445 \u043f\u0440\u0438\u0431\u044b\u043b\u044c\u043d\u044b\u043c\u0438</div><div class="tbl-wrap"><table class="summary-table"><thead><tr><th class="l">\u0423\u0441\u043b\u043e\u0432\u0438\u0435</th><th>\u041a\u0440\u0435\u0430\u0442\u0438\u0432\u043e\u0432</th><th>\u0421\u0442\u0430\u043b\u0438 \u043f\u0440\u0438\u0431\u044b\u043b\u044c\u043d\u044b\u043c\u0438</th></tr></thead><tbody>';
  L.scale.forEach(r => {
    h += '<tr' + (r.t === null ? ' style="color:var(--ink3)"' : '') + '><td class="l">' + (r.t === null ? '\u0432\u0441\u0435, \u043a\u0442\u043e \u0434\u043e\u0448\u0451\u043b \u0434\u043e ' + r.k + ' \u043f\u043e\u0434\u043f. (\u0431\u0430\u0437\u0430)' : r.k + ' \u043f\u043e\u0434\u043f., CPA \u2264 $' + r.t) + '</td><td>' + r.n + '</td><td><b>' + r.pct + '%</b></td></tr>';
  });
  h += '</tbody></table></div>';
  h += '<div class="bd-title">\u041d\u0430\u0441\u043a\u043e\u043b\u044c\u043a\u043e CPA \u043d\u0430 \u0441\u0442\u0430\u0440\u0442\u0435 \u043e\u0442\u043b\u0438\u0447\u0430\u0435\u0442\u0441\u044f \u043e\u0442 \u0438\u0442\u043e\u0433\u043e\u0432\u043e\u0433\u043e</div><div class="facts">' +
       L.drift.map(d => '<span>\u043f\u043e\u0441\u043b\u0435 ' + d.k + ' \u043f\u043e\u0434\u043f.: <b>\u00b1' + d.med + '%</b></span>').join('') + '</div>';
  h += '<p class="section-note"><b>\u041a\u0430\u043a \u043f\u0440\u0438\u043c\u0435\u043d\u044f\u044e\u0442\u0441\u044f \u043d\u0430 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0430\u0445.</b> \u041e\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430 \u2014 \u043f\u043e \u043f\u043e\u043a\u0443\u043f\u043a\u0430\u043c Meta: \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u0430\u044f \u0441\u0442\u043e\u0440\u043e\u043d\u0430, Meta \u0432\u0438\u0434\u0438\u0442 \u043f\u043e\u043a\u0443\u043f\u043a\u0438 \u0440\u0430\u043d\u044c\u0448\u0435. CPA-\u0432\u0435\u0440\u0434\u0438\u043a\u0442\u044b (\u043c\u0430\u0441\u0448\u0442\u0430\u0431 / \u0434\u0435\u0440\u0436\u0430\u0442\u044c / \u0432\u044b\u043a\u043b\u044e\u0447\u0438\u0442\u044c) \u2014 \u043f\u043e \u0431\u0438\u043b\u043b\u0438\u043d\u0433\u0443 CW \u044d\u0442\u043e\u0433\u043e \u0436\u0435 \u043e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u044f, \u0432 \u0442\u0435\u0445 \u0436\u0435 \u0435\u0434\u0438\u043d\u0438\u0446\u0430\u0445, \u0432 \u043a\u043e\u0442\u043e\u0440\u044b\u0445 \u0432\u044b\u0432\u0435\u0434\u0435\u043d\u044b \u043f\u043e\u0440\u043e\u0433\u0438. \u041d\u0430 \u0442\u0432\u043e\u0438\u0445 \u043e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u044f\u0445 Meta \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u0432 <b>' + M.ratio + '\u00d7</b> \u0431\u043e\u043b\u044c\u0448\u0435 \u043f\u043e\u043a\u0443\u043f\u043e\u043a, \u0447\u0435\u043c \u0431\u0438\u043b\u043b\u0438\u043d\u0433 (' + M.matched_meta + ' \u043f\u0440\u043e\u0442\u0438\u0432 ' + M.matched_cw + '), \u043f\u043e\u044d\u0442\u043e\u043c\u0443 CPA \u0432 Ads Manager \u0432\u044b\u0433\u043b\u044f\u0434\u0438\u0442 \u043b\u0443\u0447\u0448\u0435 \u0440\u0435\u0430\u043b\u044c\u043d\u043e\u0433\u043e. \u0415\u0441\u043b\u0438 \u0441\u043c\u043e\u0442\u0440\u0438\u0448\u044c \u0442\u043e\u043b\u044c\u043a\u043e Ads Manager: \u043c\u0430\u0441\u0448\u0442\u0430\u0431 \u043f\u0440\u0438 CPA \u2264 <b>' + money(M.scaleCpa) + '</b> \u043d\u0430 ' + M.judgeN + '+ \u043f\u043e\u043a\u0443\u043f\u043a\u0430\u0445, \u0446\u0435\u043b\u044c \u2264 ' + money(M.holdCpa) + '.</p>';
  return h;
}
function renderGeo(){
  const G = GEO_DB, rows = geoRows(), t = geoTotals(rows);
  let h = '<div class="geo-bar">' +
    '<label><input type="checkbox" id="geo-latam"' + (geoShowLatam ? " checked" : "") + '> \u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u041b\u0430\u0442\u0430\u043c</label>' +
    '<label><input type="checkbox" id="geo-small"' + (geoHideSmall ? " checked" : "") + '> \u0421\u043a\u0440\u044b\u0442\u044c \u00ab\u043c\u0430\u043b\u043e \u0434\u0430\u043d\u043d\u044b\u0445\u00bb (&lt;' + G.sync.minSubs + ' \u043f\u043e\u0434\u043f.)</label>' +
    '<span class="muted small">\u041a\u043b\u0438\u043a \u043f\u043e \u0437\u0430\u0433\u043e\u043b\u043e\u0432\u043a\u0443 \u2014 \u0441\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u043a\u0430</span></div>';
  h += '<div class="tbl-wrap"><table class="summary-table geo-table"><thead><tr>';
  GEO_COLS.forEach(([k, lab, al]) => {
    const arrow = geoSort.key === k ? (geoSort.dir === 1 ? " \u25b2" : " \u25bc") : "";
    h += '<th class="' + (al || "") + ' sortable" data-geo-sort="' + k + '">' + lab + arrow + '</th>';
  });
  h += '</tr></thead><tbody>';
  rows.forEach(g => {
    const open = !!geoOpen[g.country];
    h += '<tr class="geo-row' + (g.verdict === "data" ? " geo-small" : "") + (open ? " geo-open" : "") + '" data-geo-country="' + esc(g.country) + '">' +
      '<td class="l"><span class="geo-caret">' + (open ? "\u25be" : "\u25b8") + '</span> <b>' + esc(g.country) + '</b>' + (g.latam ? ' <span class="muted small">\u041b\u0430\u0442\u0430\u043c</span>' : '') + '</td>' +
      '<td class="l"><span class="verdict v-' + g.verdict + '">' + g.verdictLabel + '</span></td>' +
      '<td>' + money(g.spend) + '</td><td>' + num(g.subscribers) + '</td><td>' + money(g.cpa) + '</td>' +
      '<td>' + money(g.revenue) + '</td><td>' + money(g.arpu) + '</td>' +
      '<td class="' + (g.profit >= 0 ? "pos" : "neg") + '">' + money(g.profit) + '</td>' +
      '<td>' + roiCell(g.roi) + '</td><td>' + (g.roas7 === null ? "\u2014" : g.roas7.toFixed(2)) + '</td>' +
      '<td>' + signPct(g.proi3m) + '</td><td>' + (g.aliveRate === null ? "\u2014" : g.aliveRate.toFixed(1) + "%") + '</td>' +
      '<td>' + g.refundRate.toFixed(1) + '%</td></tr>';
    if (open) h += '<tr class="geo-detail"><td colspan="' + GEO_COLS.length + '">' + geoCreativeCards(g) + '</td></tr>';
  });
  h += '<tr class="total-row"><td class="l">' + t.country + '</td><td></td><td>' + money(t.spend) + '</td><td>' + num(t.subscribers) + '</td>' +
    '<td>' + money(t.cpa) + '</td><td>' + money(t.revenue) + '</td><td>' + money(t.arpu) + '</td>' +
    '<td class="' + (t.profit >= 0 ? "pos" : "neg") + '">' + money(t.profit) + '</td><td>' + roiCell(t.roi) + '</td>' +
    '<td>' + (t.roas7 === null ? "\u2014" : t.roas7.toFixed(2)) + '</td><td>' + signPct(t.proi3m) + '</td>' +
    '<td>' + (t.aliveRate === null ? "\u2014" : t.aliveRate.toFixed(1) + "%") + '</td><td></td></tr>';
  h += '</tbody></table></div>';
  h += '<div class="geo-legend">' +
    '<p><b>\u0412\u0435\u0440\u0434\u0438\u043a\u0442</b> (\u043f\u0440\u0430\u0432\u0438\u043b\u043e, \u0430 \u043d\u0435 \u043c\u043d\u0435\u043d\u0438\u0435): ' +
    '<span class="verdict v-scale">\u041c\u0430\u0441\u0448\u0442\u0430\u0431</span> ROI &gt; 0 \u0438 ROAS 7\u0434 \u2265 1 \u2014 \u043e\u043a\u0443\u043f\u0430\u0435\u0442\u0441\u044f \u0437\u0430 \u043d\u0435\u0434\u0435\u043b\u044e; ' +
    '<span class="verdict v-hold">\u0414\u0435\u0440\u0436\u0430\u0442\u044c</span> ROI &gt; 0, \u043d\u043e \u043e\u043a\u0443\u043f\u0430\u0435\u0442\u0441\u044f \u043f\u043e\u0437\u0436\u0435 7 \u0434\u043d\u0435\u0439; ' +
    '<span class="verdict v-watch">\u041f\u043e\u0434 \u0432\u043e\u043f\u0440\u043e\u0441\u043e\u043c</span> \u0441\u0435\u0439\u0447\u0430\u0441 \u0432 \u043c\u0438\u043d\u0443\u0441\u0435, \u043d\u043e \u043f\u0440\u043e\u0433\u043d\u043e\u0437 \u043d\u0430 3 \u043c\u0435\u0441. \u043f\u043b\u044e\u0441\u043e\u0432\u043e\u0439; ' +
    '<span class="verdict v-cut">\u0420\u0435\u0437\u0430\u0442\u044c</span> \u0432 \u043c\u0438\u043d\u0443\u0441\u0435 \u0438 \u043f\u0440\u043e\u0433\u043d\u043e\u0437 \u0442\u043e\u0436\u0435; ' +
    '<span class="verdict v-data">\u041c\u0430\u043b\u043e \u0434\u0430\u043d\u043d\u044b\u0445</span> \u043c\u0435\u043d\u044c\u0448\u0435 ' + G.sync.minSubs + ' \u043f\u043e\u0434\u043f\u0438\u0441\u0447\u0438\u043a\u043e\u0432.</p>' +
    '<p><b>ARPU</b> = Revenue / \u043f\u043e\u0434\u043f\u0438\u0441\u0447\u0438\u043a\u0438 (\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u043f\u0440\u0438\u043d\u043e\u0441\u0438\u0442 \u043e\u0434\u0438\u043d \u043f\u043e\u0434\u043f\u0438\u0441\u0447\u0438\u043a; \u0441\u0440\u0430\u0432\u043d\u0438\u0432\u0430\u0439 \u0441 CPA). ' +
    '<b>ROI</b> = (Revenue \u2212 \u0420\u0430\u0441\u0445\u043e\u0434) / \u0420\u0430\u0441\u0445\u043e\u0434. <b>ROAS 7\u0434</b> = \u0432\u044b\u0440\u0443\u0447\u043a\u0430 \u0437\u0430 \u043f\u0435\u0440\u0432\u044b\u0435 7 \u0434\u043d\u0435\u0439 / \u0440\u0430\u0441\u0445\u043e\u0434. ' +
    '<b>pROI 3\u043c</b> \u2014 \u043f\u0440\u043e\u0433\u043d\u043e\u0437 Campaignswell \u043d\u0430 3 \u043c\u0435\u0441\u044f\u0446\u0430 (\u043f\u043e\u043c\u043e\u0433\u0430\u0435\u0442 \u043d\u0435 \u0437\u0430\u0440\u0435\u0437\u0430\u0442\u044c \u043c\u043e\u043b\u043e\u0434\u044b\u0435 \u043a\u043e\u0433\u043e\u0440\u0442\u044b). ' +
    '<b>Alive %</b> \u2014 \u0434\u043e\u043b\u044f \u043f\u043e\u0434\u043f\u0438\u0441\u0447\u0438\u043a\u043e\u0432, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u0441\u0435\u0439\u0447\u0430\u0441 \u043d\u0435 \u043e\u0442\u043c\u0435\u043d\u0438\u043b\u0438 \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0443. <b>Refund %</b> \u2014 \u0432\u043e\u0437\u0432\u0440\u0430\u0442\u044b + \u0432\u043e\u0439\u0434\u044b + \u0447\u0430\u0440\u0434\u0436\u0431\u044d\u043a\u0438 / \u0432\u0441\u0435 \u043f\u043b\u0430\u0442\u0435\u0436\u0438.</p>' +
    '<p class="muted">\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a: ' + G.sync.source + ', \u043a\u043e\u0433\u043e\u0440\u0442\u044b ' + G.sync.window_start + ' \u2014 ' + G.sync.window_end + ', \u0432\u044b\u0433\u0440\u0443\u0436\u0435\u043d\u043e ' + G.sync.fetched_at +
    '. \u042d\u0442\u043e \u0432\u0435\u0441\u044c \u0442\u0440\u0430\u0444\u0438\u043a \u043f\u0440\u043e\u0434\u0443\u043a\u0442\u0430, \u0432\u043a\u043b\u044e\u0447\u0430\u044f \u043d\u0435 \u0442\u0432\u043e\u0438 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u044b. Revenue \u0438 ROI \u0441\u0447\u0438\u0442\u0430\u044e\u0442\u0441\u044f \u043e\u0442 \u0431\u0438\u043b\u043b\u0438\u043d\u0433\u0430 \u0438 \u043d\u0430\u0434\u0451\u0436\u043d\u044b; \u0441\u0447\u0451\u0442\u0447\u0438\u043a \u043f\u043e\u0434\u043f\u0438\u0441\u0447\u0438\u043a\u043e\u0432 \u0442\u0443\u0442 \u043d\u0438\u0436\u0435, \u0447\u0435\u043c \u043f\u043e\u043a\u0443\u043f\u043a\u0438 \u0432 Meta, \u043f\u043e\u044d\u0442\u043e\u043c\u0443 CPA \u0437\u0434\u0435\u0441\u044c \u0437\u0430\u0432\u044b\u0448\u0435\u043d \u2014 \u0441\u0440\u0430\u0432\u043d\u0438\u0432\u0430\u0439 \u0441\u0442\u0440\u0430\u043d\u044b \u043c\u0435\u0436\u0434\u0443 \u0441\u043e\u0431\u043e\u0439, \u0430 \u043d\u0435 \u0441 CPA \u0438\u0437 \u00ab\u041c\u043e\u0439 \u0422\u0440\u0430\u0444\u0438\u043a\u00bb.</p></div>';
  h += geoCreativesTable();

  const box = document.getElementById("xp-geo-body");
  box.innerHTML = h;
  makeSortable(box);
  box.querySelectorAll("[data-geo-sort]").forEach(th => th.addEventListener("click", () => {
    const k = th.getAttribute("data-geo-sort");
    if (geoSort.key === k) geoSort.dir *= -1; else geoSort = { key: k, dir: (k === "country" || k === "verdictLabel" || k === "cpa" || k === "refundRate") ? 1 : -1 };
    renderGeo();
  }));
  box.querySelectorAll("[data-geo-country]").forEach(tr => tr.addEventListener("click", () => {
    const c = tr.getAttribute("data-geo-country"); geoOpen[c] = !geoOpen[c]; renderGeo();
  }));
  document.getElementById("geo-latam").addEventListener("change", e => { geoShowLatam = e.target.checked; renderGeo(); });
  document.getElementById("geo-small").addEventListener("change", e => { geoHideSmall = e.target.checked; renderGeo(); });
}
function openGeoWindow(){
  renderGeo();
  document.getElementById("xp-geo-window").classList.add("open");
  document.getElementById("xp-taskbar-geo").style.display = "none";
  const ic = document.getElementById("xp-desktop-geo-icon"); if (ic) ic.classList.add("selected");
}
function closeGeoWindow(){
  const w = document.getElementById("xp-geo-window"); w.classList.remove("open"); w.classList.remove("maximized");
  document.getElementById("xp-taskbar-geo").style.display = "none";
  const ic = document.getElementById("xp-desktop-geo-icon"); if (ic) ic.classList.remove("selected");
}
function minimizeGeoWindow(){
  document.getElementById("xp-geo-window").classList.remove("open");
  document.getElementById("xp-taskbar-geo").style.display = "flex";
}


// ---------- Мануалы
function manualViewHtml(key){
  const m = MANUALS[key];
  return '<div class="manual-doc">' + mdToHtml(m.content) + '</div>';
}
function renderManual(key){ openManualsWindow(key); }
function renderManualsMenu(){ openManualsWindow(); }
function renderManualsWindow(key){
  const body = document.getElementById("xp-man-body");
  const title = document.getElementById("xp-man-title");
  if (!key) {
    title.textContent = "\ud83d\udcda \u041c\u0430\u043d\u0443\u0430\u043b\u044b";
    let h = '<p class="section-note">\u041c\u0435\u0442\u043e\u0434\u043e\u043b\u043e\u0433\u0438\u044f, \u043f\u0440\u0430\u0432\u0438\u043b\u0430 \u0440\u0435\u0448\u0435\u043d\u0438\u0439 \u0438 \u0436\u0443\u0440\u043d\u0430\u043b. \u041f\u043e\u0440\u043e\u0433\u0438 \u0432 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0430\u0445 \u2014 \u0441\u043d\u0438\u043c\u043e\u043a \u043d\u0430 \u0434\u0430\u0442\u0443; \u0436\u0438\u0432\u044b\u0435 \u2014 \u0432 CW Performance Report.</p><div class="tile-row">';
    Object.keys(MANUALS).forEach(k => {
      h += folderTile({ nav: k, icon: "\ud83d\udcdd", title: MANUALS[k].title, sub: Math.round(MANUALS[k].content.length / 100) / 10 + " \u041a\u0411" });
    });
    body.innerHTML = h + '</div>';
    body.querySelectorAll("[data-tile-nav]").forEach(el => {
      el.addEventListener("mouseenter", () => { el.style.background = "#e5f3ff"; });
      el.addEventListener("mouseleave", () => { el.style.background = "transparent"; });
      el.addEventListener("click", () => renderManualsWindow(el.getAttribute("data-tile-nav")));
    });
    return;
  }
  title.textContent = "\ud83d\udcdd " + MANUALS[key].title;
  body.innerHTML = '<div style="margin-bottom:8px;"><button class="man-back" id="xp-man-back">\u2190 \u041a \u0441\u043f\u0438\u0441\u043a\u0443</button></div>' + manualViewHtml(key);
  document.getElementById("xp-man-back").addEventListener("click", () => renderManualsWindow());
}
function openManualsWindow(key){
  renderManualsWindow(key);
  document.getElementById("xp-man-window").classList.add("open");
  document.getElementById("xp-taskbar-man").style.display = "none";
  const ic = document.getElementById("xp-desktop-man-icon"); if (ic) ic.classList.add("selected");
}
function closeManualsWindow(){
  const w = document.getElementById("xp-man-window"); w.classList.remove("open"); w.classList.remove("maximized");
  document.getElementById("xp-taskbar-man").style.display = "none";
  const ic = document.getElementById("xp-desktop-man-icon"); if (ic) ic.classList.remove("selected");
}
function minimizeManualsWindow(){
  document.getElementById("xp-man-window").classList.remove("open");
  document.getElementById("xp-taskbar-man").style.display = "flex";
}


// ---------- jump from search (or anywhere) straight into a card
function findByAttr(root, sel, attr, val){ return [...root.querySelectorAll(sel)].find(e => e.getAttribute(attr) === val) || null; }
function focusCard(t){
  goAccountDetail(t.account);
  const content = document.getElementById("content");
  const sec = findByAttr(content, "details.csec", "data-sec", "acc-camps"); if (sec) sec.open = true;
  let target = null;
  const camp = t.camp ? findByAttr(content, "details.campaign-card", "data-camp", t.camp) : null;
  if (camp) { camp.open = true; target = camp; }
  const adset = (camp && t.adset !== undefined && t.adset !== null) ? findByAttr(camp, "details.adset-card:not(.ad-card)", "data-adset", t.adset) : null;
  if (adset) { adset.open = true; target = adset; }
  const ad = (adset && t.ad) ? findByAttr(adset, "details.ad-card", "data-ad", t.ad) : null;
  if (ad) { ad.open = true; target = ad; }
  if (target) {
    if (target.scrollIntoView) target.scrollIntoView({ block: "start" });
    target.classList.add("flash"); setTimeout(() => target.classList.remove("flash"), 1800);
  }
  return target;
}

// ---------- search v2: verdicts on every level, click drops into the card
const VERDICT_RANK = { rule_break: 0, front_bad: 1, cut: 2, starved: 3, watch: 4, scale: 5, hold: 6, accruing: 7,
  killed_late: 8, killed_manual: 9, killed_early: 10, killed_rule: 11, killed_cpa: 12 };
function searchItems(view){
  const rows = [];
  DATA.forEach(c => {
    if (view === "campaigns") rows.push(Object.assign({ level: "camp", name: c.label, full: c.key, target: { account: c.account, camp: c.key } }, pick(c), { account: c.account }));
    (c.adsets || []).forEach(a => {
      if (view === "adsets") rows.push(Object.assign({ level: "adset", name: a.name, full: a.name + " · " + c.label, target: { account: c.account, camp: c.key, adset: a.name } }, pick(a), { account: c.account }));
      if (view === "creatives") (a.ads || []).forEach(ad => rows.push(Object.assign({ level: "ad", name: ad.label, full: ad.name + " · " + a.name, target: { account: c.account, camp: c.key, adset: a.name, ad: ad.id } }, pick(ad), { account: c.account })));
    });
  });
  return rows;
  function pick(x){ return { status: x.status, spend: x.spend, purchases: x.purchases, cpa: x.cpa, cwCpa: x.cwCpa, cwSubs: x.cwSubs, verdict: x.verdict, verdictKind: x.verdictKind, verdictDetail: x.verdictDetail }; }
}
const SEARCH_COLS2 = [
  { key: "status", label: "Статус" }, { key: "verdict", label: "Вердикт" }, { key: "name", label: "Название" }, { key: "account", label: "Аккаунт" },
  { key: "spend", label: "Расход", num: true }, { key: "purchases", label: "Покупки", num: true }, { key: "cpa", label: "CPA", num: true }, { key: "cwCpa", label: "Биллинг", num: true }
];
let searchSort2 = { key: "verdict", dir: 1 };
let searchOnlyActive = false;
function renderSearchThead2(){
  const tr = document.getElementById("xp-search-thead");
  tr.innerHTML = SEARCH_COLS2.map(c => '<th data-sort-key="' + c.key + '"' + (c.num ? ' style="text-align:right;"' : '') + '>' + c.label +
    (searchSort2.key === c.key ? '<span class="sort-arrow">' + (searchSort2.dir === 1 ? '▲' : '▼') + '</span>' : '') + '</th>').join("");
  tr.querySelectorAll("[data-sort-key]").forEach(th => th.addEventListener("click", () => {
    const k = th.getAttribute("data-sort-key");
    searchSort2 = searchSort2.key === k ? { key: k, dir: -searchSort2.dir } : { key: k, dir: (k === "status" || k === "verdict" || k === "name" || k === "account") ? 1 : -1 };
    renderSearchThead2(); renderSearchResults2(document.getElementById("xp-search-input").value);
  }));
}
function renderSearchResults2(query){
  const view = typeof searchView !== "undefined" ? searchView : "adsets";
  const box = document.getElementById("xp-search-results");
  const q = (query || "").trim().toLowerCase();
  let rows = searchItems(view);
  if (searchOnlyActive) rows = rows.filter(r => r.status === "ACTIVE");
  if (q) rows = rows.filter(r => (r.full + " " + r.account + " " + (r.verdict || "")).toLowerCase().includes(q));
  const k = searchSort2.key, dir = searchSort2.dir;
  const val = r => k === "status" ? (r.status === "ACTIVE" ? 0 : 1) : (k === "verdict" ? (VERDICT_RANK[r.verdictKind] ?? 99) : r[k]);
  rows.sort((a, b) => { const av = val(a), bv = val(b);
    if (av === null || av === undefined) return 1; if (bv === null || bv === undefined) return -1;
    return typeof av === "string" ? dir * av.localeCompare(bv) : dir * (av - bv); });
  const sp = rows.reduce((s, r) => s + (r.spend || 0), 0), pu = rows.reduce((s, r) => s + (r.purchases || 0), 0);
  document.getElementById("xp-search-statusbar").innerHTML = '<span>' + rows.length + ' записей · активных: ' + rows.filter(r => r.status === "ACTIVE").length +
    ' · требуют действия: ' + rows.filter(r => r.status === "ACTIVE" && ["rule_break", "front_bad", "cut", "starved"].includes(r.verdictKind)).length + '</span>' +
    '<span class="ss-summary">Расход: ' + money(sp) + ' · Покупки: ' + pu + ' · CPA: ' + (pu ? money(sp / pu) : '—') + '</span>';
  if (!rows.length) { box.innerHTML = '<tr><td colspan="8" class="xp-search-empty">Ничего не найдено</td></tr>'; return; }
  box.innerHTML = rows.map((r, i) => '<tr class="xp-search-row' + (r.status === "ACTIVE" ? "" : " is-paused") + '" data-status="' + r.status + '" data-search-idx="' + i + '" title="' + esc(r.full) + '">' +
    '<td><span class="sr-status ' + (r.status === "ACTIVE" ? "active" : "paused") + '"></span></td>' +
    '<td>' + verdictChip(r) + '</td>' +
    '<td><span class="sr-name">' + esc(r.name) + '</span></td><td>' + esc(r.account) + '</td>' +
    '<td class="num">' + money(r.spend) + '</td><td class="num">' + r.purchases + '</td>' +
    '<td class="num">' + (r.cpa ? money(r.cpa) : '—') + '</td><td class="num">' + (r.cwCpa ? money(r.cwCpa) : '—') + '</td></tr>').join("");
  box.querySelectorAll("[data-search-idx]").forEach(tr => tr.addEventListener("click", () => {
    const r = rows[+tr.getAttribute("data-search-idx")];
    if (typeof closeSearchPanel === "function") closeSearchPanel();
    if (typeof desktopIcon !== "undefined" && desktopIcon) desktopIcon.classList.add("selected");
    if (typeof openWindow === "function") openWindow();
    focusCard(r.target);
  }));
}


// ---------- generic column sorting for every table (geo main table keeps its own sorter)
function cellValue(td){
  if (!td) return null;
  const v = td.getAttribute("data-v");
  const t = v !== null ? v : td.textContent.trim();
  if (t === "" || t === "—" || t === "-") return null;
  const n = t.replace(/[$,%+\s]/g, "").replace(/^([\d.]+)\/[\d.]+$/, "$1");
  if (/^-?\d+(\.\d+)?K$/i.test(n)) return parseFloat(n) * 1000;
  if (/^-?\d+(\.\d+)?$/.test(n)) return parseFloat(n);
  return t.toLowerCase();
}
function makeSortable(root){
  (root || document).querySelectorAll("table.bd2, table.summary-table:not(.geo-table), table.mini-breakdown-table").forEach(tbl => {
    if (tbl.getAttribute("data-sortable")) return;
    tbl.setAttribute("data-sortable", "1");
    const ths = tbl.querySelectorAll("thead th");
    ths.forEach((th, ci) => {
      th.classList.add("sortable-th");
      th.addEventListener("click", ev => {
        ev.stopPropagation();
        const dir = th.getAttribute("data-dir") === "desc" ? "asc" : "desc";
        ths.forEach(x => { x.removeAttribute("data-dir"); x.classList.remove("sorted-asc", "sorted-desc"); });
        th.setAttribute("data-dir", dir); th.classList.add(dir === "asc" ? "sorted-asc" : "sorted-desc");
        const body = tbl.tBodies[0] || tbl; const all = [...body.rows].filter(r => !r.querySelector("th"));
        const pinned = all.filter(r => r.classList.contains("total-row") || r.classList.contains("bd-other"));
        const rows = all.filter(r => !pinned.includes(r));
        rows.sort((a, b) => {
          const av = cellValue(a.cells[ci]), bv = cellValue(b.cells[ci]);
          if (av === null && bv === null) return 0; if (av === null) return 1; if (bv === null) return -1;
          const r = (typeof av === "number" && typeof bv === "number") ? av - bv : String(av).localeCompare(String(bv));
          return dir === "asc" ? r : -r;
        });
        rows.concat(pinned).forEach(r => body.appendChild(r));
      });
    });
  });
}


// ---------- collapsible sections, compact account cards, bulk tools
const SEC = {};
function csec(id, title, line, inner, defOpen){
  const open = SEC[id] === undefined ? defOpen : SEC[id];
  return '<details class="csec" data-sec="' + id + '"' + (open ? ' open' : '') + '><summary><span class="csec-t">' + title + '</span><span class="csec-l">' + line + '</span></summary><div class="csec-b">' + inner + '</div></details>';
}
function oaCheckbox(id, extraClass){
  return '<label class="bt-check oa-check' + (extraClass ? " " + extraClass : "") + '"><input type="checkbox" data-only-active="' + id + '"' + (SEC[id] ? " checked" : "") + '> только активные</label>';
}
function bindOnlyActive(root, id, selector){
  const cb = root.querySelector('[data-only-active="' + id + '"]');
  if (!cb) return;
  const apply = on => {
    root.querySelectorAll(selector).forEach(el => { el.style.display = (on && el.getAttribute("data-status") === "PAUSED") ? "none" : ""; });
    SEC[id] = on;
  };
  cb.addEventListener("change", () => apply(cb.checked));
  if (SEC[id]) apply(true);
}
function bindSections(root){
  (root || document).querySelectorAll("details.csec").forEach(d => { if (d.getAttribute("data-bound")) return; d.setAttribute("data-bound", "1"); d.addEventListener("toggle", () => { SEC[d.getAttribute("data-sec")] = d.open; }); });
}
function compactTotals(t){ return kfmt(t.spend) + ' · ' + t.purchases + ' пок. · CPA ' + (t.purchases ? money(t.spend / t.purchases) : '—'); }
const ACTION_KINDS = ["rule_break", "front_bad", "cut", "starved"];
function actionSummary(accNames){
  const ads = DATA.filter(c => accNames.includes(c.account)).flatMap(c => c.adsets).filter(x => x.status === "ACTIVE");
  const n = k => ads.filter(x => k.includes(x.verdictKind)).length;
  const red = n(ACTION_KINDS), yel = n(["watch"]), grn = n(["scale", "hold"]), blu = n(["accruing"]);
  return '<span class="vc vc-r" title="требуют действия">' + red + '</span><span class="vc vc-y" title="под вопросом">' + yel + '</span>' +
         '<span class="vc vc-g" title="держать / масштаб">' + grn + '</span><span class="vc vc-b" title="копятся">' + blu + '</span> активных адсетов';
}
function accountCards(accs){
  return '<div class="acc-cards">' + accs.map(a => '<div class="acc-card jump-row' + (a.activeAdsets ? "" : " is-paused") + '" data-status="' + (a.activeAdsets ? "ACTIVE" : "PAUSED") + '" data-acct-jump="' + esc(a.name) + '">' +
    dot(a.activeAdsets ? "ACTIVE" : "PAUSED") + '<b class="acc-n">' + esc(a.name) + '</b><span class="muted small acc-r">' + esc(a.role) + '</span>' +
    '<span class="spacer"></span><span class="acc-v">' + actionSummary([a.name]) + '</span>' +
    '<span class="card-stats"><span class="cs c1">' + kfmt(a.spend) + '</span><span class="cs c2">' + a.purchases + ' пок.</span><span class="cs c3">CPA <b>' + (a.cpa ? money(a.cpa) : '—') + '</b></span></span></div>').join("") + '</div>';
}
const BD_UNKNOWN = /^(не указан|unknown|неизвестно|—)$|\|unknown$|· unknown$/i;
function bdHeadline(bd, avg){
  const all = [];
  ["country", "age", "gender", "device", "placement"].forEach(k => (bd && bd[k] || []).forEach(r => { if (!r.other && r.p >= 2 && r.cpa && !BD_UNKNOWN.test(r.v)) all.push(r); }));
  all.sort((x, y) => x.cpa - y.cpa);
  return all.length ? 'дешевле всего: ' + all.slice(0, 3).map(r => esc(r.v) + ' ' + money(r.cpa)).join(', ') : 'нет сегментов с 2+ продажами';
}
function bindAccountTools(root){
  const sec = root.querySelector('details.csec[data-sec="acc-camps"]');
  if (!sec) return;
  const camps = () => [...sec.querySelectorAll("details.campaign-card")];
  const adsets = () => [...sec.querySelectorAll("details.adset-card:not(.ad-card)")];
  const creatives = () => [...sec.querySelectorAll("details.ad-card")];
  const applyOnlyActive = on => {
    camps().forEach(x => { x.style.display = (on && x.getAttribute("data-status") === "PAUSED") ? "none" : ""; });
    adsets().forEach(x => { x.style.display = (on && x.getAttribute("data-status") === "PAUSED") ? "none" : ""; });
    creatives().forEach(x => { x.style.display = (on && x.getAttribute("data-status") === "PAUSED") ? "none" : ""; });
    SEC["acc-only-active"] = on;
  };
  sec.querySelectorAll("[data-bulk]").forEach(b => b.addEventListener(b.tagName === "INPUT" ? "change" : "click", ev => {
    ev.preventDefault && b.tagName !== "INPUT" && ev.preventDefault();
    const k = b.getAttribute("data-bulk");
    if (k === "camps-open") camps().forEach(c => c.open = true);
    if (k === "camps-close") camps().forEach(c => c.open = false);
    if (k === "adsets-open") { camps().forEach(c => c.open = true); adsets().forEach(x => x.open = true); }
    if (k === "adsets-close") adsets().forEach(x => x.open = false);
    if (k === "adsets-action") { adsets().forEach(x => { const act = ACTION_KINDS.includes(x.getAttribute("data-kind")) && !x.classList.contains("is-paused"); x.open = act; if (act) x.closest("details.campaign-card").open = true; }); }
    if (k === "only-active") applyOnlyActive(b.checked);
  }));
  if (SEC["acc-only-active"]) applyOnlyActive(true);
}


// ---- kept from previous version
function folderTile(opts){
  return '<div class="xp-folder-tile" data-tile-nav="' + opts.nav + '" style="width:150px; text-align:center; cursor:pointer; padding:14px 10px; border-radius:6px;">' +
    '<div style="font-size:56px; line-height:1;">' + opts.icon + '</div>' +
    '<div style="font-weight:700; font-size:13px; margin-top:8px;">' + opts.title + '</div>' +
    (opts.sub ? '<div style="font-size:11px; color:var(--ink3); margin-top:2px;">' + opts.sub + '</div>' : '') +
    '</div>';
}

function bindTileNav(handler){
  document.querySelectorAll("[data-tile-nav]").forEach(el => {
    el.addEventListener("mouseenter", () => { el.style.background = "#e5f3ff"; });
    el.addEventListener("mouseleave", () => { el.style.background = "transparent"; });
    el.addEventListener("click", () => handler(el.getAttribute("data-tile-nav")));
  });
}
