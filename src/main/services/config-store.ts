import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { app } from 'electron'

export type Provider = 'claude' | 'openai' | 'openrouter'

export interface ProviderConfig {
  provider: Provider
  openaiKey?: string
  claudeKey?: string
  openrouterKey?: string
  openaiModel?: string
  claudeModel?: string
  openrouterModel?: string
  openrouterVisionModel?: string
}

function configPath(): string {
  return join(app.getPath('userData'), 'topdiff-config.json')
}

export function loadConfig(): ProviderConfig {
  const path = configPath()
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, 'utf-8')) as ProviderConfig
    } catch {
      // fall through to env fallback
    }
  }

  // Fall back to env vars
  if (process.env.OPENAI_API_KEY) {
    return { provider: 'openai', openaiKey: process.env.OPENAI_API_KEY }
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: 'claude', claudeKey: process.env.ANTHROPIC_API_KEY }
  }
  if (process.env.OPENROUTER_API_KEY) {
    return {
      provider: 'openrouter',
      openrouterKey: process.env.OPENROUTER_API_KEY,
      openrouterModel: process.env.OPENROUTER_MODEL,
      openrouterVisionModel: process.env.OPENROUTER_VISION_MODEL,
    }
  }

  return { provider: 'claude' }
}

export function saveConfig(config: ProviderConfig): void {
  const path = configPath()
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, JSON.stringify(config, null, 2), 'utf-8')
}
