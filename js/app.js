// Sync stamp comes from data/sync-info.js — the markup carries no data.
document.getElementById('xp-clock').textContent = SYNC_INFO.fetched_at;
document.getElementById('sync-stamp').textContent = 'Обновлено: ' + SYNC_INFO.fetched_at + ' · Meta Ads API';

syncTreePacks();
document.getElementById('xp-desktop-perf-icon').addEventListener('click', openPerformersWindow);
document.getElementById('xp-perf-close').addEventListener('click', closePerformersWindow);
document.getElementById('xp-perf-minimize').addEventListener('click', minimizePerformersWindow);
document.getElementById('xp-perf-maximize').addEventListener('click', () => document.getElementById('xp-perf-window').classList.toggle('maximized'));
document.getElementById('xp-taskbar-perf').addEventListener('click', () => {
  const w = document.getElementById('xp-perf-window');
  if (w.classList.contains('open')) minimizePerformersWindow(); else { w.classList.add('open'); document.getElementById('xp-taskbar-perf').style.display = 'none'; }
});
document.getElementById('xp-desktop-geo-icon').addEventListener('click', openGeoWindow);
document.getElementById('xp-geo-close').addEventListener('click', closeGeoWindow);
document.getElementById('xp-geo-minimize').addEventListener('click', minimizeGeoWindow);
document.getElementById('xp-geo-maximize').addEventListener('click', () => document.getElementById('xp-geo-window').classList.toggle('maximized'));
document.getElementById('xp-taskbar-geo').addEventListener('click', () => {
  const w = document.getElementById('xp-geo-window');
  if (w.classList.contains('open')) minimizeGeoWindow(); else { w.classList.add('open'); document.getElementById('xp-taskbar-geo').style.display = 'none'; }
});
document.getElementById('xp-desktop-man-icon').addEventListener('click', () => openManualsWindow());
document.getElementById('xp-man-close').addEventListener('click', closeManualsWindow);
document.getElementById('xp-man-minimize').addEventListener('click', minimizeManualsWindow);
document.getElementById('xp-man-maximize').addEventListener('click', () => document.getElementById('xp-man-window').classList.toggle('maximized'));
document.getElementById('xp-taskbar-man').addEventListener('click', () => {
  const w = document.getElementById('xp-man-window');
  if (w.classList.contains('open')) minimizeManualsWindow(); else { w.classList.add('open'); document.getElementById('xp-taskbar-man').style.display = 'none'; }
});
/*@@SEARCH_V2@@*/
renderSearchResults = renderSearchResults2;
renderSearchThead = renderSearchThead2;
document.getElementById('xp-search-only-active').addEventListener('change', function(){
  searchOnlyActive = this.checked;
  renderSearchResults(document.getElementById('xp-search-input').value);
});
