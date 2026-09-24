
document.getElementById('xp-nav-traffic').addEventListener('click', () => {
  navGoUp();
});
document.getElementById('xp-min-btn').addEventListener('click', () => {
  document.getElementById('sidebar-el').classList.toggle('collapsed');
});

function openWindow(){
  document.getElementById('xp-window').classList.add('visible');
  document.getElementById('xp-desktop').style.display = 'none';
  document.getElementById('xp-taskbar-window').style.display = 'flex';
}
function closeWindow(){
  document.getElementById('xp-window').classList.remove('visible');
  document.getElementById('xp-desktop').style.display = 'flex';
  document.getElementById('xp-desktop-icon').classList.remove('selected');
  document.getElementById('xp-taskbar-window').style.display = 'none';
}
const desktopIcon = document.getElementById('xp-desktop-icon');
desktopIcon.addEventListener('click', () => {
  desktopIcon.classList.add('selected');
  openWindow();
});
document.getElementById('xp-close-btn').addEventListener('click', () => {
  closeWindow();
});
