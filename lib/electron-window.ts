type ElectronRequire = {
  ipcRenderer?: {
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
    on?: (channel: string, listener: (...args: unknown[]) => void) => void
    removeListener?: (channel: string, listener: (...args: unknown[]) => void) => void
  }
}

function getIpcRenderer() {
  if (typeof window === 'undefined') return null

  const maybeRequire = (window as typeof window & { require?: (name: string) => ElectronRequire }).require
  if (!maybeRequire) return null

  try {
    return maybeRequire('electron').ipcRenderer ?? null
  } catch {
    return null
  }
}

export function isElectronRuntime() {
  return !!getIpcRenderer()
}

export async function getAlwaysOnTop() {
  const ipcRenderer = getIpcRenderer()
  if (!ipcRenderer) return false

  return Boolean(await ipcRenderer.invoke('window:get-always-on-top'))
}

export async function toggleAlwaysOnTop() {
  const ipcRenderer = getIpcRenderer()
  if (!ipcRenderer) return false

  return Boolean(await ipcRenderer.invoke('window:toggle-always-on-top'))
}

export async function openNotesBoardWindow() {
  const ipcRenderer = getIpcRenderer()
  if (!ipcRenderer) return false

  return Boolean(await ipcRenderer.invoke('window:open-notes-board'))
}

export async function openNoteWindow(noteId: string) {
  const ipcRenderer = getIpcRenderer()
  if (!ipcRenderer) return false

  return Boolean(await ipcRenderer.invoke('window:open-note', noteId))
}

export function subscribeMemoryConsolidated(listener: () => void) {
  const ipcRenderer = getIpcRenderer()
  if (!ipcRenderer?.on || !ipcRenderer.removeListener) return () => {}

  const handler = () => listener()
  ipcRenderer.on('memory:consolidated', handler)

  return () => {
    ipcRenderer.removeListener?.('memory:consolidated', handler)
  }
}
