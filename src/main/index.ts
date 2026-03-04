import { app } from 'electron'
import * as dotenv from 'dotenv'
import { join } from 'path'
import { createMainWindow } from './windows/main-window'
import { createOverlayWindow } from './windows/overlay-window'
import { registerIpcHandlers } from './ipc/handlers'
import { setClient } from './services/client-state'
import { loadConfig, type ProviderConfig } from './services/config-store'
import { startGameWatcher } from './services/game-watcher'
import { ClaudeClient } from './services/claude-client'
import { OpenAIClient } from './services/openai-client'
import { OpenRouterClient } from './services/openrouter-client'

// In production: ~/Library/Application Support/TopDiff/.env
// In dev: project root .env
const prodEnv = join(app.getPath('userData'), '.env')
const devEnv = join(app.getAppPath(), '.env')
dotenv.config({ path: prodEnv })
if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY && !process.env.OPENROUTER_API_KEY) {
  dotenv.config({ path: devEnv })
}

export function initClientFromConfig(config: ProviderConfig): void {
  const { provider, openaiKey, claudeKey, openrouterKey, openrouterModel, openrouterVisionModel } = config

  if (provider === 'openai' && openaiKey) {
    setClient(new OpenAIClient(openaiKey, config.openaiModel))
    console.log('[TopDiff] Using OpenAI model:', config.openaiModel ?? 'gpt-4.1')
  } else if (provider === 'claude' && claudeKey) {
    setClient(new ClaudeClient(claudeKey, config.claudeModel))
    console.log('[TopDiff] Using Claude model:', config.claudeModel ?? 'claude-sonnet-4-6')
  } else if (provider === 'openrouter' && openrouterKey) {
    if (openrouterModel) process.env.OPENROUTER_MODEL = openrouterModel
    if (openrouterVisionModel) process.env.OPENROUTER_VISION_MODEL = openrouterVisionModel
    setClient(new OpenRouterClient(openrouterKey))
    console.log('[TopDiff] Using OpenRouter')
    console.log('  text model   :', openrouterModel ?? 'deepseek/deepseek-chat-v3-0324:free')
    console.log('  vision model :', openrouterVisionModel ?? 'qwen/qwen2.5-vl-72b-instruct:free')
  } else {
    console.warn('[TopDiff] No API key for provider:', provider, '— configure via Settings')
  }
}

const config = loadConfig()
initClientFromConfig(config)

app.whenReady().then(() => {
  createMainWindow()
  createOverlayWindow()
  registerIpcHandlers()
  startGameWatcher()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
