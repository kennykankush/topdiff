import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../main/ipc/channels'
import type { AnalysisResult } from '../shared/types'

// Main window API
contextBridge.exposeInMainWorld('api', {
  detectPicks: () =>
    ipcRenderer.invoke(IPC.DETECT_PICKS),
  analyse: (payload: { myChampion: string; myRole: string; side: 'Blue' | 'Red'; enemyTeam: string[] }) =>
    ipcRenderer.invoke(IPC.ANALYSE, payload),
  showOverlay: () =>
    ipcRenderer.send(IPC.SHOW_OVERLAY),
  getProviderConfig: () =>
    ipcRenderer.invoke(IPC.GET_PROVIDER_CONFIG),
  setProviderConfig: (payload: { provider: string; apiKey?: string; model?: string; visionModel?: string }) =>
    ipcRenderer.invoke(IPC.SET_PROVIDER_CONFIG, payload),
  getUsage: () =>
    ipcRenderer.invoke(IPC.GET_USAGE),
})

// Overlay window API
contextBridge.exposeInMainWorld('overlayApi', {
  onLoading: (cb: () => void) =>
    ipcRenderer.on(IPC.ANALYSIS_LOADING, cb),
  onResult: (cb: (result: AnalysisResult) => void) =>
    ipcRenderer.on(IPC.ANALYSIS_RESULT, (_, result) => cb(result)),
  onError: (cb: (msg: string) => void) =>
    ipcRenderer.on(IPC.ANALYSIS_ERROR, (_, msg) => cb(msg)),
  close: () => ipcRenderer.send(IPC.CLOSE_OVERLAY),
  resize: (height: number) => ipcRenderer.send(IPC.RESIZE_OVERLAY, height)
})
