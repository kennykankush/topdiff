import type { AIClient } from './ai-client'

let _client: AIClient | null = null

export function getClient(): AIClient {
  if (!_client) throw new Error('No AI provider configured. Open Settings to add an API key.')
  return _client
}

export function setClient(client: AIClient): void {
  _client = client
}

export function hasClient(): boolean {
  return _client !== null
}
