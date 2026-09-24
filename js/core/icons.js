// Icons live in assets/img; build.py swaps these paths for data URIs in the bundle.
const ICONS = { folder: 'assets/img/folder.png', computer: 'assets/img/computer.png' };
function folderIcon(size){ return '<img src="' + ICONS.folder + '" style="width:' + size + 'px; height:' + size + 'px; display:block; margin:0 auto;" alt="">'; }
document.querySelectorAll('img[data-ico]').forEach(img => { img.src = ICONS[img.dataset.ico]; });
