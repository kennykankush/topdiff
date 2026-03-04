import { ipcMain } from 'electron'
import { IPC } from './channels'
import { getClient, setClient } from '../services/client-state'
import { loadConfig, saveConfig } from '../services/config-store'
import { getSessionUsage, resetSession } from '../services/usage-tracker'
import { ClaudeClient } from '../services/claude-client'
import { OpenAIClient } from '../services/openai-client'
import { OpenRouterClient } from '../services/openrouter-client'
import { captureScreenAsBase64 } from '../services/screen-capture'
import { getOverlayWindow, showOverlay } from '../windows/overlay-window'
import { getMainWindow } from '../windows/main-window'
import { getChampionSpells, getLatestVersion } from '../services/data-dragon'

export function registerIpcHandlers(): void {

  // Step 1: Screenshot → detect enemy picks
  ipcMain.handle(IPC.DETECT_PICKS, async () => {
    const mainWin = getMainWindow()
    try {
      console.log('[TopDiff] Hiding main window for screenshot...')
      mainWin?.hide()
      await new Promise(r => setTimeout(r, 150))

      console.log('[TopDiff] Capturing screen...')
      const screenshotB64 = await captureScreenAsBase64()
      console.log('[TopDiff] Screenshot captured, detecting picks...')
      const detection = await getClient().detectEnemyPicks(screenshotB64)
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

  // Step 2: Analyse
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

      const [patch, enemySpells] = await Promise.all([
        getLatestVersion().catch(() => null),
        getChampionSpells(enemyLaner)
      ])
      console.log('[TopDiff] Patch:', patch)
      if (enemySpells) console.log('[TopDiff] Using Data Dragon spell data for', enemyLaner)

      const result = await getClient().analyseMatchup({
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

  // Provider config
  ipcMain.handle(IPC.GET_PROVIDER_CONFIG, () => {
    const config = loadConfig()
    return {
      activeProvider: config.provider,
      keys: {
        openai: !!config.openaiKey,
        claude: !!config.claudeKey,
        openrouter: !!config.openrouterKey,
      },
      models: {
        openai: config.openaiModel,
        claude: config.claudeModel,
        openrouterText: config.openrouterModel,
        openrouterVision: config.openrouterVisionModel,
      }
    }
  })

  ipcMain.handle(IPC.SET_PROVIDER_CONFIG, async (_, payload: {
    provider: 'claude' | 'openai' | 'openrouter'
    apiKey?: string
    model?: string
    visionModel?: string
  }) => {
    try {
      const config = loadConfig()

      if (payload.apiKey) {
        if (payload.provider === 'openai') config.openaiKey = payload.apiKey
        else if (payload.provider === 'claude') config.claudeKey = payload.apiKey
        else if (payload.provider === 'openrouter') config.openrouterKey = payload.apiKey
      }
      if (payload.provider === 'openai' && payload.model !== undefined) {
        config.openaiModel = payload.model || undefined
      }
      if (payload.provider === 'claude' && payload.model !== undefined) {
        config.claudeModel = payload.model || undefined
      }
      if (payload.provider === 'openrouter') {
        if (payload.model !== undefined) config.openrouterModel = payload.model || undefined
        if (payload.visionModel !== undefined) config.openrouterVisionModel = payload.visionModel || undefined
      }
      config.provider = payload.provider

      const key = payload.provider === 'openai' ? config.openaiKey
                : payload.provider === 'claude' ? config.claudeKey
                : config.openrouterKey

      if (!key) return { ok: false, error: 'No API key for this provider' }

      if (payload.provider === 'openai') {
        setClient(new OpenAIClient(key, config.openaiModel))
      } else if (payload.provider === 'claude') {
        setClient(new ClaudeClient(key, config.claudeModel))
      } else {
        if (config.openrouterModel) process.env.OPENROUTER_MODEL = config.openrouterModel
        if (config.openrouterVisionModel) process.env.OPENROUTER_VISION_MODEL = config.openrouterVisionModel
        setClient(new OpenRouterClient(key))
      }

      saveConfig(config)
      resetSession() // reset cost tracking when switching provider
      console.log('[TopDiff] Provider switched to:', payload.provider, '| model:', payload.model ?? '(default)')
      return { ok: true, provider: payload.provider }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC.GET_USAGE, () => getSessionUsage())
}
