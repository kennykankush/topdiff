import { ipcMain } from 'electron'
import { IPC } from './channels'
import type { AIClient } from '../services/ai-client'
import { captureScreenAsBase64 } from '../services/screen-capture'
import { getOverlayWindow, showOverlay } from '../windows/overlay-window'
import { getMainWindow } from '../windows/main-window'
import { getChampionSpells, getLatestVersion } from '../services/data-dragon'

export function registerIpcHandlers(aiClient: AIClient): void {

  // Step 1: Screenshot → detect enemy picks (returns picks for user to verify)
  ipcMain.handle(IPC.DETECT_PICKS, async () => {
    const mainWin = getMainWindow()
    try {
      console.log('[TopDiff] Hiding main window for screenshot...')
      mainWin?.hide()
      await new Promise(r => setTimeout(r, 150)) // let window fully hide

      console.log('[TopDiff] Capturing screen...')
      const screenshotB64 = await captureScreenAsBase64()
      console.log('[TopDiff] Screenshot captured, detecting picks...')
      const detection = await aiClient.detectEnemyPicks(screenshotB64)
      console.log('[TopDiff] Scene:', detection.scene, '| Note:', detection.note)
      console.log('[TopDiff] My champion:', detection.myChampion ?? 'not detected')
      console.log('[TopDiff] Enemy picks:', detection.picks.map(p => `${p.champion} (${p.role})`).join(', ') || 'none')
      return { ok: true, ...detection }
    } catch (err) {
      console.error('[TopDiff] Screenshot/detect failed:', err)
      return { ok: false, error: err instanceof Error ? err.message : String(err), picks: [] }
    } finally {
      mainWin?.show()
      mainWin?.focus()
    }
  })

  // Step 2: Analyse — accepts enemy team directly (no screenshot here)
  ipcMain.handle(IPC.ANALYSE, async (_, payload: {
    myChampion: string
    myRole: string
    side: 'Blue' | 'Red'
    enemyTeam: string[]
  }) => {
    const overlayWin = getOverlayWindow()
    overlayWin?.webContents.send(IPC.ANALYSIS_LOADING)
    showOverlay()

    try {
      const roleLaneIndex: Record<string, number> = {
        top: 0, jungle: 1, mid: 2, bot: 3, adc: 3, support: 4
      }
      const laneIdx = roleLaneIndex[payload.myRole.toLowerCase()] ?? 2
      const enemyLaner = payload.enemyTeam[laneIdx] ?? payload.enemyTeam[0]

      console.log('[TopDiff] Analysing:', payload.myChampion, 'vs', enemyLaner, '| full team:', payload.enemyTeam)

      // Pre-fetch patch version + enemy laner spell data from Data Dragon
      const [patch, enemySpells] = await Promise.all([
        getLatestVersion().catch(() => null),
        getChampionSpells(enemyLaner)
      ])
      console.log('[TopDiff] Patch:', patch)
      if (enemySpells) console.log('[TopDiff] Using Data Dragon spell data for', enemyLaner)

      const result = await aiClient.analyseMatchup({
        myChampion: payload.myChampion,
        myRole: payload.myRole,
        side: payload.side,
        enemyLaner,
        enemyTeam: payload.enemyTeam,
        enemySpells,
        patch
      })

      overlayWin?.webContents.send(IPC.ANALYSIS_RESULT, result)
      return { ok: true }
    } catch (err) {
      console.error('[TopDiff] Analysis failed:', err)
      const message = err instanceof Error ? err.message : String(err)
      overlayWin?.webContents.send(IPC.ANALYSIS_ERROR, message)
      return { ok: false, error: message }
    }
  })

  ipcMain.on(IPC.SHOW_OVERLAY, () => {
    showOverlay()
  })

  ipcMain.on(IPC.CLOSE_OVERLAY, () => {
    getOverlayWindow()?.hide()
  })

  ipcMain.on(IPC.RESIZE_OVERLAY, (_, height: number) => {
    const win = getOverlayWindow()
    if (!win) return
    const clamped = Math.max(60, Math.min(Math.ceil(height), 900))
    const [w] = win.getContentSize()
    win.setContentSize(w, clamped)
  })
}
