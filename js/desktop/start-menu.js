// Кнопка "Пуск" — открывает/закрывает всплывающее меню (как в Windows)
const startMenu = document.getElementById('xp-startmenu');
function toggleStartMenu(){ startMenu.classList.toggle('open'); }
function closeStartMenu(){ startMenu.classList.remove('open'); }

document.getElementById('xp-start-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleStartMenu();
});
document.getElementById('xp-taskbar-window').addEventListener('click', () => {
  const win = document.getElementById('xp-window');
  if (!win.classList.contains('visible')) { openWindow(); }
  else { closeWindow(); }
});

// закрытие меню по клику вне его
document.addEventListener('click', (e) => {
  if (startMenu.classList.contains('open') && !startMenu.contains(e.target)) {
    closeStartMenu();
  }
});

// пункты меню "Пуск"
document.querySelectorAll('[data-sm-action]').forEach(item => {
  item.addEventListener('click', () => {
    const action = item.getAttribute('data-sm-action');
    if (action === 'open-window') {
      desktopIcon.classList.add('selected');
      openWindow();
    } else if (action === 'winners') {
      goWinners();
    } else if (action === 'manuals') {
      goManualsMenu();
    } else if (action === 'accounts') {
      desktopIcon.classList.add('selected');
      openWindow();
      goAccountsMenu();
    } else if (action === 'home') {
      desktopIcon.classList.add('selected');
      openWindow();
      goHome();
    } else if (action === 'tree') {
      desktopIcon.classList.add('selected');
      openWindow();
      document.getElementById('sidebar-el').classList.toggle('collapsed');
    } else if (action === 'logoff') {
      closeWindow();
    } else if (action === 'search') {
      openSearchPanel();
    }
    closeStartMenu();
  });
});
