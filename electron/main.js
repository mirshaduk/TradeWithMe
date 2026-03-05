const { app, BrowserWindow, ipcMain, shell, Notification } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

// ─── IPC: Desktop Notifications ─────────────────────────────────────────────
// React renderer calls: window.electronAPI?.notify(title, body)
ipcMain.on('notify', (_, { title, body }) => {
    if (Notification.isSupported()) {
        new Notification({ title, body, silent: false }).show();
    }
});


let mainWindow = null;
let backendProcess = null;
let frontendProcess = null;

const FRONTEND_PORT = 3000;
const BACKEND_PORT = 8000;

// ─── Utility: Wait for a port to be ready ───────────────────────────────────
function waitForPort(port, timeout = 60000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
            http.get(`http://localhost:${port}`, (res) => {
                resolve();
            }).on('error', () => {
                if (Date.now() - start > timeout) {
                    reject(new Error(`Port ${port} not ready after ${timeout}ms`));
                } else {
                    setTimeout(check, 1000);
                }
            });
        };
        check();
    });
}

// ─── Start the Python FastAPI Backend ───────────────────────────────────────
function startBackend() {
    const backendDir = path.join(__dirname, '..', 'backend');

    // Try python3, then python (cross-platform)
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    console.log(`Starting Python backend in: ${backendDir}`);

    backendProcess = spawn(pythonCmd, ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', String(BACKEND_PORT)], {
        cwd: backendDir,
        stdio: 'pipe',
        shell: true,
        env: {
            ...process.env,
            // Ensure the venv is in PATH on Windows
            PATH: `${path.join(backendDir, 'venv', 'Scripts')};${path.join(backendDir, 'venv', 'bin')};${process.env.PATH}`,
        }
    });

    backendProcess.stdout.on('data', (data) => {
        console.log(`[BACKEND] ${data}`);
    });

    backendProcess.stderr.on('data', (data) => {
        console.log(`[BACKEND ERR] ${data}`);
    });

    backendProcess.on('exit', (code) => {
        console.log(`Backend exited with code ${code}`);
    });
}

// ─── Start Next.js Frontend Dev Server ──────────────────────────────────────
function startFrontend() {
    const frontendDir = path.join(__dirname, '..', 'frontend');
    console.log(`Starting Next.js frontend in: ${frontendDir}`);

    frontendProcess = spawn('npm', ['run', 'dev'], {
        cwd: frontendDir,
        stdio: 'pipe',
        shell: true,
        env: {
            ...process.env,
            NEXT_PUBLIC_API_URL: `http://localhost:${BACKEND_PORT}`,
        }
    });

    frontendProcess.stdout.on('data', (data) => {
        console.log(`[FRONTEND] ${data}`);
    });

    frontendProcess.stderr.on('data', (data) => {
        console.log(`[FRONTEND ERR] ${data}`);
    });
}

// ─── Create the Main App Window ─────────────────────────────────────────────
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 950,
        minWidth: 1200,
        minHeight: 700,
        title: 'TradeWithMe AI — Crypto Terminal',
        backgroundColor: '#0d111c',
        show: false, // Show after content loads
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        titleBarStyle: 'hiddenInset', // Mac: native blurred titlebar
    });

    // Show a loading screen first
    mainWindow.loadURL(`data:text/html,
        <style>
            body { 
                margin:0; background:#0d111c; display:flex; 
                align-items:center; justify-content:center; 
                height:100vh; flex-direction:column; color:#a0a4b8; 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            .spinner {
                width:40px; height:40px; border:3px solid #1f242f;
                border-top:3px solid #6c63ff; border-radius:50%;
                animation:spin 1s linear infinite; margin-bottom:20px;
            }
            @keyframes spin { to { transform:rotate(360deg); } }
            h2 { font-size:1.5rem; margin:0 0 8px; color:#e2e8f0; }
            p { font-size:0.75rem; letter-spacing:0.2em; text-transform:uppercase; opacity:0.5; }
        </style>
        <div class="spinner"></div>
        <h2>TradeWithMe AI</h2>
        <p>Starting your trading terminal...</p>
    `);

    mainWindow.once('ready-to-show', () => mainWindow.show());

    // Open DevTools for debugging (remove for release)
    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ─── App Lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(async () => {
    createWindow();

    // Start both servers
    startBackend();
    startFrontend();

    // Wait for both servers to be ready, then load the app
    try {
        console.log('Waiting for backend...');
        await waitForPort(BACKEND_PORT);
        console.log('Backend ready!');

        console.log('Waiting for frontend...');
        await waitForPort(FRONTEND_PORT);
        console.log('Frontend ready!');

        if (mainWindow) {
            mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`);
        }
    } catch (err) {
        console.error('Startup failed:', err);
        if (mainWindow) {
            mainWindow.loadURL(`data:text/html,
                <style>body{background:#0d111c;color:#ff3d00;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;}</style>
                <h2>Startup Failed</h2>
                <p>${err.message}</p>
            `);
        }
    }
});

app.on('window-all-closed', () => {
    // Kill child processes on close
    if (backendProcess) backendProcess.kill();
    if (frontendProcess) frontendProcess.kill();
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Kill processes when quitting
app.on('before-quit', () => {
    if (backendProcess) {
        backendProcess.kill();
        backendProcess = null;
    }
    if (frontendProcess) {
        frontendProcess.kill();
        frontendProcess = null;
    }
});
