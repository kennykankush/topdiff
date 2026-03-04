import { app } from 'electron'
import * as dotenv from 'dotenv'
import { join } from 'path'
import { createMainWindow } from './windows/main-window'
import { createOverlayWindow } from './windows/overlay-window'
import { registerIpcHandlers } from './ipc/handlers'
import { ClaudeClient } from './services/claude-client'
import { OpenAIClient } from './services/openai-client'
import type { AIClient } from './services/ai-client'

// In production: ~/Library/Application Support/TopDiff/.env
// In dev: project root .env
const prodEnv = join(app.getPath('userData'), '.env')
const devEnv = join(app.getAppPath(), '.env')
dotenv.config({ path: prodEnv })
if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
  dotenv.config({ path: devEnv })
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

let aiClient: AIClient

if (OPENAI_API_KEY) {
  aiClient = new OpenAIClient(OPENAI_API_KEY)
  console.log('[TopDiff] Using OpenAI (gpt-4o)')
} else if (ANTHROPIC_API_KEY) {
  aiClient = new ClaudeClient(ANTHROPIC_API_KEY)
  console.log('[TopDiff] Using Claude (claude-sonnet-4-6)')
} else {
  console.error(
    '\n[TopDiff] No API key found.\n' +
    'Add one of these to your .env file:\n' +
    '  OPENAI_API_KEY=sk-...\n' +
    '  ANTHROPIC_API_KEY=sk-ant-...\n'
  )
  app.quit()
  process.exit(1)
}

app.whenReady().then(() => {
  createMainWindow()
  createOverlayWindow()
  registerIpcHandlers(aiClient)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
