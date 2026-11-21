// ALICE: versão para computador (Electron).
// Carrega o jogo por um protocolo interno (app://), sem precisar de servidor.
// O progresso fica salvo na pasta de dados do usuário do Windows (localStorage do app).
const { app, BrowserWindow, protocol, net, Menu, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

// uma instância só (evita dois jogos abertos disputando o mesmo save)
if (!app.requestSingleInstanceLock()) app.quit();

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 960, minHeight: 540,
    backgroundColor: '#000000', title: 'ALICE', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, spellcheck: false, backgroundThrottling: false },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => { win.setFullScreen(true); win.show(); });
  // F11 alterna tela cheia; Ctrl+W, Ctrl+R e F5 não fecham nem recarregam o jogo sem querer
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if ((input.control && ['w', 'r'].includes(input.key.toLowerCase())) || input.key === 'F5') e.preventDefault();
  });
  // links externos abrem no navegador
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.loadURL('app://alice/index.html');
}

app.whenReady().then(() => {
  const root = __dirname;
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    const file = path.normalize(path.join(root, decodeURIComponent(pathname)));
    if (!file.startsWith(root)) return new Response('', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
});
app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
app.on('window-all-closed', () => app.quit());
