import { appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

const DATA_DIR = join(process.cwd(), 'data')
const DATA_FILE = join(DATA_DIR, 'analytics.ndjson')

// Generated once per app launch — groups all calls from the same session
export const SESSION_ID = randomUUID()

export type AnalyticsPhase = 'Auto-Detect' | 'Match Analysis'

export interface AnalyticsRecord {
  timestamp: string
  sessionId: string
  phase: AnalyticsPhase
  provider: string
  model: string
  promptVersion: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  latencyMs: number
  success: boolean
  error: string | null
  meta: Record<string, unknown>
}

export interface AccuracyFeedback {
  type: 'accuracy_feedback'
  timestamp: string
  refTimestamp: string
  correctCount: number
  totalDetected: number
  accuracyPct: number
}

export function appendAnalyticsRecord(record: AnalyticsRecord): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true })
    appendFileSync(DATA_FILE, JSON.stringify(record) + '\n', 'utf8')
  } catch (e) {
    console.warn('[Analytics] Failed to write record:', e)
  }
}

export function appendAccuracyFeedback(feedback: AccuracyFeedback): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true })
    appendFileSync(DATA_FILE, JSON.stringify(feedback) + '\n', 'utf8')
  } catch (e) {
    console.warn('[Analytics] Failed to write accuracy feedback:', e)
  }
}
