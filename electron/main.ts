import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import type { BrowserWindow as BrowserWindowType } from 'electron'
import * as path from 'path'
import { checkAndConsolidateMemories } from './memory-manager.ts'
import { fileURLToPath } from 'url'
import * as os from 'os'
import * as fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

  // 开发环境加载本地服务器，生产环境加载构建后的文件
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

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