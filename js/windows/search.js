// ===== Поиск: окно по центру, вкладки Адсеты/Креативы, сортировка =====
let searchView = 'adsets';
let searchSort = { key: 'status', dir: 1 };

function withCpa(rows){
  rows.forEach(r => { r.cpa = r.purchases ? r.spend / r.purchases : null; });
  return rows;
}
function allCampaignsForSearch(){
  return withCpa(DATA.map(c => ({
    name: c.label, account: c.account || "\u2014", status: c.status, spend: c.spend, purchases: c.purchases
  })));
}
function allAdsetsForSearch(){
  const rows = [];
  DATA.forEach(c => {
    (c.adsets || []).forEach(a => {
      rows.push({ name: a.name, account: c.account || "\u2014", campaign: c.label, status: a.status, spend: a.spend, purchases: a.purchases });
    });
  });
  return withCpa(rows);
}
function allCreativesForSearch(){
  const rows = [];
  DATA.forEach(c => {
    (c.adsets || []).forEach(a => {
      (a.ads || []).forEach(ad => {
        rows.push({ name: ad.name, account: c.account || "\u2014", campaign: c.label, adset: a.name, status: ad.status, spend: ad.spend, purchases: ad.purchases });
      });
    });
  });
  return withCpa(rows);
}
const SEARCH_COLUMNS = [
  { key: 'status', label: '\u0421\u0442\u0430\u0442\u0443\u0441', numeric:false },
  { key: 'name', label: '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435', numeric:false },
  { key: 'account', label: '\u0410\u043a\u043a\u0430\u0443\u043d\u0442', numeric:false },
  { key: 'spend', label: '\u0420\u0430\u0441\u0445\u043e\u0434', numeric:true },
  { key: 'purchases', label: '\u041f\u0440\u043e\u0434\u0430\u0436\u0438', numeric:true },
  { key: 'cpa', label: 'CPA', numeric:true }
];
function renderSearchThead(){
  const tr = document.getElementById('xp-search-thead');
  tr.innerHTML = SEARCH_COLUMNS.map(col => {
    const arrow = searchSort.key === col.key ? '<span class="sort-arrow">' + (searchSort.dir === 1 ? '\u25b2' : '\u25bc') + '</span>' : '';
    return '<th data-sort-key="' + col.key + '"' + (col.numeric ? ' style="text-align:right;"' : '') + '>' + col.label + arrow + '</th>';
  }).join('');
  tr.querySelectorAll('[data-sort-key]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-sort-key');
      if (searchSort.key === key) { searchSort.dir *= -1; } else { searchSort = { key: key, dir: key === 'status' ? 1 : -1 }; }
      renderSearchResults(document.getElementById('xp-search-input').value);
    });
  });
}
function renderSearchResults(query){
  const box = document.getElementById('xp-search-results');
  const q = (query || '').trim().toLowerCase();
  const all = searchView === 'adsets' ? allAdsetsForSearch() : (searchView === 'creatives' ? allCreativesForSearch() : allCampaignsForSearch());
  let matches = q ? all.filter(c => c.name.toLowerCase().includes(q) || c.account.toLowerCase().includes(q)) : all.slice();

  const key = searchSort.key, dir = searchSort.dir;
  matches.sort((a, b) => {
    let av, bv;
    if (key === 'status') { av = a.status === 'ACTIVE' ? 0 : 1; bv = b.status === 'ACTIVE' ? 0 : 1; }
    else if (key === 'cpa') {
      if (a.cpa === null && b.cpa === null) return 0;
      if (a.cpa === null) return 1;
      if (b.cpa === null) return -1;
      av = a.cpa; bv = b.cpa;
    }
    else { av = a[key]; bv = b[key]; }
    if (typeof av === 'string') { return dir * av.localeCompare(bv); }
    return dir * ((av||0) - (bv||0));
  });

  const viewLabel = searchView === 'adsets' ? '\u0430\u0434\u0441\u0435\u0442\u044b' : (searchView === 'creatives' ? '\u043a\u0440\u0435\u0430\u0442\u0438\u0432\u044b' : '\u043a\u0430\u043c\u043f\u0430\u043d\u0438\u0438');
  const sumSpend = matches.reduce((s,r) => s + (r.spend||0), 0);
  const sumPurchases = matches.reduce((s,r) => s + (r.purchases||0), 0);
  const activeCount = matches.filter(r => r.status === 'ACTIVE').length;
  const blendedCpa = sumPurchases ? money(sumSpend / sumPurchases) : '\u2014';
  document.getElementById('xp-search-statusbar').innerHTML =
    '<span>' + matches.length + ' \u0437\u0430\u043f\u0438\u0441\u0435\u0439 \u2014 ' + viewLabel + ' \u00b7 \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0445: ' + activeCount + '</span>' +
    '<span class="ss-summary">\u0420\u0430\u0441\u0445\u043e\u0434: ' + money(sumSpend) + ' \u00b7 \u041f\u0440\u043e\u0434\u0430\u0436\u0438: ' + sumPurchases + ' \u00b7 CPA: ' + blendedCpa + '</span>';

  if (!matches.length) {
    box.innerHTML = '<tr><td colspan="6" class="xp-search-empty">\u041d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e</td></tr>';
    return;
  }
  box.innerHTML = matches.map((c, idx) =>
    '<tr class="xp-search-row" data-search-idx="' + idx + '">' +
      '<td><span class="sr-status ' + (c.status==="ACTIVE"?"active":"paused") + '"></span></td>' +
      '<td><span class="sr-name" title="' + c.name.replace(/"/g,'&quot;') + '">' + c.name + '</span></td>' +
      '<td>' + c.account + '</td>' +
      '<td class="num">' + money(c.spend) + '</td>' +
      '<td class="num">' + c.purchases + '</td>' +
      '<td class="num">' + (c.cpa === null ? '\u2014' : money(c.cpa)) + '</td>' +
    '</tr>'
  ).join('');
  box.querySelectorAll('[data-search-idx]').forEach(row => {
    row.addEventListener('click', () => {
      const idx = parseInt(row.getAttribute('data-search-idx'), 10);
      const item = matches[idx];
      const acct = item.account.split(',')[0].trim();
      closeSearchPanel();
      if (acct && acct !== "\u2014") {
        desktopIcon.classList.add('selected');
        openWindow();
        goAccountDetail(acct);
      }
    });
  });
}
function setSearchView(view){
  searchView = view;
  searchSort = { key: 'status', dir: 1 };
  document.getElementById('xp-search-tab-adsets').classList.toggle('active', view === 'adsets');
  document.getElementById('xp-search-tab-creatives').classList.toggle('active', view === 'creatives');
  document.getElementById('xp-search-tab-campaigns').classList.toggle('active', view === 'campaigns');
  renderSearchThead();
  renderSearchResults(document.getElementById('xp-search-input').value);
}
document.getElementById('xp-search-tab-adsets').addEventListener('click', () => setSearchView('adsets'));
document.getElementById('xp-search-tab-creatives').addEventListener('click', () => setSearchView('creatives'));
document.getElementById('xp-search-tab-campaigns').addEventListener('click', () => setSearchView('campaigns'));

function openSearchPanel(){
  document.getElementById('xp-search-panel').classList.add('open');
  document.getElementById('xp-desktop-search-icon').classList.add('selected');
  document.getElementById('xp-taskbar-search').style.display = 'none';
  setSearchView('campaigns');
  document.getElementById('xp-search-input').value = '';
  document.getElementById('xp-search-input').focus();
}
function closeSearchPanel(){
  document.getElementById('xp-search-panel').classList.remove('open');
  document.getElementById('xp-search-panel').classList.remove('maximized');
  document.getElementById('xp-desktop-search-icon').classList.remove('selected');
  document.getElementById('xp-taskbar-search').style.display = 'none';
}
function minimizeSearchPanel(){
  document.getElementById('xp-search-panel').classList.remove('open');
  document.getElementById('xp-taskbar-search').style.display = 'flex';
}
function restoreSearchPanel(){
  document.getElementById('xp-search-panel').classList.add('open');
  document.getElementById('xp-taskbar-search').style.display = 'none';
}
function toggleMaximizeSearchPanel(){
  document.getElementById('xp-search-panel').classList.toggle('maximized');
}
document.getElementById('xp-search-input').addEventListener('input', (e) => {
  renderSearchResults(e.target.value);
});
document.getElementById('xp-search-close').addEventListener('click', closeSearchPanel);
document.getElementById('xp-search-minimize').addEventListener('click', minimizeSearchPanel);
document.getElementById('xp-search-maximize').addEventListener('click', toggleMaximizeSearchPanel);
document.getElementById('xp-taskbar-search').addEventListener('click', () => {
  const panel = document.getElementById('xp-search-panel');
  if (panel.classList.contains('open')) { minimizeSearchPanel(); } else { restoreSearchPanel(); }
});
document.getElementById('xp-desktop-search-icon').addEventListener('click', () => {
  document.getElementById('xp-desktop-search-icon').classList.add('selected');
  openSearchPanel();
});

goHome();
