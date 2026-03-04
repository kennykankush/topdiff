import OpenAI from 'openai'
import type { AnalysisResult } from '../../shared/types'
import {
  ANALYSIS_SYSTEM_PROMPT,
  VISION_PROMPT,
  VISION_PROMPT_VERSION,
  ANALYSIS_PROMPT_VERSION,
  buildAnalysisUserPrompt,
  type AnalysisPromptParams
} from '../prompts'
import type { AIClient } from './ai-client'
import { AnalysisResultSchema } from './schemas'
import { recordUsage, computeCost } from './usage-tracker'
import { appendAnalyticsRecord, SESSION_ID } from './analytics-store'

// Default free models — override via env vars
const DEFAULT_TEXT_MODEL = 'deepseek/deepseek-chat-v3-0324:free'
const DEFAULT_VISION_MODEL = 'qwen/qwen2.5-vl-72b-instruct:free'

// ── Client ───────────────────────────────────────────────────────────────────

export class OpenRouterClient implements AIClient {
  readonly provider = 'openrouter' as const
  private client: OpenAI
  private textModel: string
  private visionModel: string

  constructor(apiKey: string) {
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
    })
    this.textModel = process.env.OPENROUTER_MODEL ?? DEFAULT_TEXT_MODEL
    this.visionModel = process.env.OPENROUTER_VISION_MODEL ?? DEFAULT_VISION_MODEL
  }

  async analyseMatchup(params: AnalysisPromptParams): Promise<AnalysisResult> {
    const userPrompt = buildAnalysisUserPrompt(params)

    console.log('\n─── [OpenRouter] analyseMatchup REQUEST ────────────────────')
    console.log('MODEL:', this.textModel)
    console.log('SYSTEM:\n', ANALYSIS_SYSTEM_PROMPT)
    console.log('\nUSER:\n', userPrompt)
    console.log('────────────────────────────────────────────────────────────\n')

    const t0 = Date.now()
    let response: Awaited<ReturnType<typeof this.client.chat.completions.create>>
    try {
      response = await this.client.chat.completions.create({
        model: this.textModel,
        messages: [
          { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ]
      })
    } catch (err) {
      const latencyMs = Date.now() - t0
      appendAnalyticsRecord({
        timestamp: new Date().toISOString(),
        sessionId: SESSION_ID,
        phase: 'Match Analysis',
        provider: 'openrouter',
        model: this.textModel,
        promptVersion: ANALYSIS_PROMPT_VERSION,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        latencyMs,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        meta: { myChampion: params.myChampion, myRole: params.myRole, enemyLaner: params.enemyLaner }
      })
      throw err
    }
    const latencyMs = Date.now() - t0

    const text = response.choices[0]?.message?.content
    console.log('\n─── [OpenRouter] analyseMatchup RESPONSE ───────────────────')
    recordUsage(this.textModel, response.usage?.prompt_tokens ?? 0, response.usage?.output_tokens ?? 0, 'Match Analysis')
    appendAnalyticsRecord({
      timestamp: new Date().toISOString(),
      phase: 'Match Analysis',
      provider: 'openrouter',
      model: this.textModel,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      costUsd: computeCost(this.textModel, response.usage?.prompt_tokens ?? 0, response.usage?.output_tokens ?? 0),
      latencyMs,
      success: true,
      error: null,
      meta: { myChampion: params.myChampion, myRole: params.myRole, enemyLaner: params.enemyLaner }
    })
    console.log(text)
    console.log('────────────────────────────────────────────────────────────\n')

    if (!text) throw new Error('No text response from OpenRouter')

    let json: unknown
    try {
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start === -1 || end === -1) throw new Error('No JSON object found')
      json = JSON.parse(text.slice(start, end + 1))
    } catch {
      throw new Error(`OpenRouter returned non-JSON: ${text.slice(0, 200)}`)
    }

    return AnalysisResultSchema.parse(json)
  }

  async detectEnemyPicks(screenshotBase64: string): Promise<{
    picks: { champion: string; role: string }[]
    myChampion: string | null
    myRole: string | null
    scene: string
    note: string
    pendingRoles: string[]
    recordTimestamp: string
  }> {
    console.log('\n─── [OpenRouter] detectEnemyPicks REQUEST ──────────────────')
    console.log('MODEL:', this.visionModel)
    console.log('PROMPT:\n', VISION_PROMPT)
    console.log('IMAGE: <base64 PNG,', screenshotBase64.length, 'chars>')
    console.log('────────────────────────────────────────────────────────────\n')

    const recordTimestamp = new Date().toISOString()
    const t0 = Date.now()
    let response: Awaited<ReturnType<typeof this.client.chat.completions.create>>
    try {
      response = await this.client.chat.completions.create({
        model: this.visionModel,
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshotBase64}` } },
              { type: 'text', text: VISION_PROMPT }
            ]
          }
        ]
      })
    } catch (err) {
      const latencyMs = Date.now() - t0
      appendAnalyticsRecord({
        timestamp: recordTimestamp,
        sessionId: SESSION_ID,
        phase: 'Auto-Detect',
        provider: 'openrouter',
        model: this.visionModel,
        promptVersion: VISION_PROMPT_VERSION,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        latencyMs,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        meta: {}
      })
      throw err
    }
    const latencyMs = Date.now() - t0

    const text = response.choices[0]?.message?.content
    console.log('\n─── [OpenRouter] detectEnemyPicks RESPONSE ─────────────────')
    recordUsage(this.visionModel, response.usage?.prompt_tokens ?? 0, response.usage?.completion_tokens ?? 0, 'Auto-Detect')
    console.log(text)
    console.log('────────────────────────────────────────────────────────────\n')

    const blank = { picks: [], myChampion: null, myRole: null, scene: 'unknown', note: 'No response from OpenRouter', pendingRoles: [], recordTimestamp }
    if (!text) {
      appendAnalyticsRecord({
        timestamp: recordTimestamp,
        sessionId: SESSION_ID,
        phase: 'Auto-Detect',
        provider: 'openrouter',
        model: this.visionModel,
        promptVersion: VISION_PROMPT_VERSION,
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        costUsd: computeCost(this.visionModel, response.usage?.prompt_tokens ?? 0, response.usage?.completion_tokens ?? 0),
        latencyMs,
        success: false,
        error: 'No text in response',
        meta: {}
      })
      return blank
    }

    try {
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start === -1 || end === -1) {
        appendAnalyticsRecord({
          timestamp: new Date().toISOString(),
          phase: 'Auto-Detect',
          provider: 'openrouter',
          model: this.visionModel,
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
          costUsd: computeCost(this.visionModel, response.usage?.prompt_tokens ?? 0, response.usage?.completion_tokens ?? 0),
          latencyMs,
          success: false,
          error: 'No JSON found in response',
          meta: {}
        })
        return blank
      }
      const parsed = JSON.parse(text.slice(start, end + 1)) as {
        scene: string
        my_champion: string | null
        my_role: string | null
        enemy_picks: { champion: string; role: string }[]
        pending_roles: string[]
        note: string
        confidence: string
      }
      const { picks, deduped } = dedupeRoles(parsed.enemy_picks ?? [])
      appendAnalyticsRecord({
        timestamp: recordTimestamp,
        sessionId: SESSION_ID,
        phase: 'Auto-Detect',
        provider: 'openrouter',
        model: this.visionModel,
        promptVersion: VISION_PROMPT_VERSION,
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        costUsd: computeCost(this.visionModel, response.usage?.prompt_tokens ?? 0, response.usage?.completion_tokens ?? 0),
        latencyMs,
        success: true,
        error: null,
        meta: {
          scene: parsed.scene,
          detectedCount: picks.length,
          roleDedupeApplied: deduped,
          myChampion: parsed.my_champion ?? null,
          myRole: parsed.my_role ?? null,
        }
      })
      return {
        picks,
        myChampion: parsed.my_champion ?? null,
        myRole: parsed.my_role ?? null,
        scene: parsed.scene ?? 'unknown',
        note: parsed.note ?? '',
        pendingRoles: parsed.pending_roles ?? [],
        recordTimestamp,
      }
    } catch {
      appendAnalyticsRecord({
        timestamp: recordTimestamp,
        sessionId: SESSION_ID,
        phase: 'Auto-Detect',
        provider: 'openrouter',
        model: this.visionModel,
        promptVersion: VISION_PROMPT_VERSION,
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        costUsd: computeCost(this.visionModel, response.usage?.prompt_tokens ?? 0, response.usage?.completion_tokens ?? 0),
        latencyMs,
        success: false,
        error: 'JSON parse failed',
        meta: {}
      })
      return blank
    }
  }
}

const ALL_ROLES = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']

function dedupeRoles(picks: { champion: string; role: string }[]): { champion: string; role: string }[] {
  const used = new Set<string>()
  const result: { champion: string; role: string }[] = []
  const needsRole: { champion: string; role: string }[] = []
  for (const pick of picks) {
    if (!used.has(pick.role)) { used.add(pick.role); result.push(pick) }
    else needsRole.push(pick)
  }
  for (const pick of needsRole) {
    const remaining = ALL_ROLES.find(r => !used.has(r))
    if (remaining) { used.add(remaining); result.push({ champion: pick.champion, role: remaining }) }
    else result.push(pick)
  }
  return result
}
