import { app, BrowserWindow, Menu, ipcMain, shell } from 'electron'
import type { BrowserWindow as BrowserWindowType } from 'electron'
import * as path from 'path'
import { checkAndConsolidateMemories } from './memory-manager.ts'
import { fileURLToPath } from 'url'
import * as os from 'os'
import * as fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const getWindowChromeOptions = () => {
  if (process.platform === 'darwin') {
    return {
      titleBarStyle: 'hiddenInset' as const,
      trafficLightPosition: { x: 14, y: 14 },
    }
  }

  return {
    titleBarStyle: 'hidden' as const,
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#94a3b8',
      height: 40,
    },
  }
}

const createContextMenu = () => {
  return Menu.buildFromTemplate([
    {
      label: '复制',
      accelerator: 'CmdOrCtrl+C',
      click: (menuItem, browserWindow) => {
        const win = browserWindow as BrowserWindowType | null
        if (win && win.webContents) {
          win.webContents.copy()
        }
      }
    },
    {
      label: '粘贴',
      accelerator: 'CmdOrCtrl+V',
      click: (menuItem, browserWindow) => {
        const win = browserWindow as BrowserWindowType | null
        if (win && win.webContents) {
          win.webContents.paste()
        }
      }
    },
    {
      label: '剪切',
      accelerator: 'CmdOrCtrl+X',
      click: (menuItem, browserWindow) => {
        const win = browserWindow as BrowserWindowType | null
        if (win && win.webContents) {
          win.webContents.cut()
        }
      }
    },
    { type: 'separator' },
    {
      label: '全选',
      accelerator: 'CmdOrCtrl+A',
      click: (menuItem, browserWindow) => {
        const win = browserWindow as BrowserWindowType | null
        if (win && win.webContents) {
          win.webContents.selectAll()
        }
      }
    },
    { type: 'separator' },
    {
      label: '撤销',
      accelerator: 'CmdOrCtrl+Z',
      click: (menuItem, browserWindow) => {
        const win = browserWindow as BrowserWindowType | null
        if (win && win.webContents) {
          win.webContents.undo()
        }
      }
    },
    {
      label: '重做',
      accelerator: 'CmdOrCtrl+Shift+Z',
      click: (menuItem, browserWindow) => {
        const win = browserWindow as BrowserWindowType | null
        if (win && win.webContents) {
          win.webContents.redo()
        }
      }
    }
  ])
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    ...getWindowChromeOptions(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  // 创建上下文菜单
  const contextMenu = createContextMenu()

  // 监听右键点击事件
  mainWindow.webContents.on('context-menu', () => {
    contextMenu.popup()
  })

  // 拦截链接点击，使用系统默认浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost') || url.startsWith('file://')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 760,
          height: 920,
          backgroundColor: '#00000000',
          autoHideMenuBar: true,
          ...getWindowChromeOptions(),
          webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
          }
        }
      }
    }

    // 使用系统默认浏览器打开外部链接
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // 阻止在 Electron 窗口中导航到外部链接
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // 允许本地开发服务器和本地文件
    if (url.startsWith('http://localhost') || url.startsWith('file://')) {
      return
    }
    // 阻止外部链接在 Electron 窗口中打开
    event.preventDefault()
    shell.openExternal(url)
  })

  // 开发环境加载本地服务器，生产环境加载构建后的文件
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:2342')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

const resolveAppUrl = (pathname: string) => {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`

  if (process.env.NODE_ENV === 'development') {
    return `http://localhost:2342${normalizedPath}`
  }

  return `file://${path.join(__dirname, '../dist/index.html')}#${normalizedPath}`
}

const createChildWindow = (targetUrl: string, options?: Partial<Electron.BrowserWindowConstructorOptions>) => {
  const childWindow = new BrowserWindow({
    width: 900,
    height: 700,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    ...getWindowChromeOptions(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    ...options,
  })

  childWindow.loadURL(targetUrl)
  return childWindow
}

ipcMain.handle('window:get-always-on-top', (event) => {
  return BrowserWindow.fromWebContents(event.sender)?.isAlwaysOnTop() ?? false
})

ipcMain.handle('window:toggle-always-on-top', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return false

  const next = !win.isAlwaysOnTop()
  win.setAlwaysOnTop(next)
  return next
})

ipcMain.handle('window:open-notes-board', () => {
  createChildWindow(resolveAppUrl('/notes'), {
    width: 980,
    height: 760,
  })
  return true
})

ipcMain.handle('window:open-note', (event, noteId: string) => {
  if (!noteId) return false

  createChildWindow(resolveAppUrl(`/notes/${noteId}`), {
    width: 420,
    height: 520,
    minWidth: 360,
    minHeight: 420,
  })
  return true
})

app.whenReady().then(() => {
  createWindow()

  // 启动时立即检查一次
  checkAndConsolidateMemories().catch(console.error)

  // 每分钟检查一次是否需要整理记忆
  setInterval(() => {
    checkAndConsolidateMemories().catch(console.error)
  }, 60 * 1000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
