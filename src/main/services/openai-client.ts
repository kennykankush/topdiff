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

// ── Client ───────────────────────────────────────────────────────────────────

export class OpenAIClient implements AIClient {
  readonly provider = 'openai' as const
  private client: OpenAI
  private model: string

  constructor(apiKey: string, model = 'gpt-4.1') {
    this.client = new OpenAI({ apiKey })
    this.model = model
  }

  async analyseMatchup(params: AnalysisPromptParams): Promise<AnalysisResult> {
    const userPrompt = buildAnalysisUserPrompt(params)

    console.log('\n─── [OpenAI] analyseMatchup REQUEST ───────────────────────')
    console.log('MODEL:', this.model)
    console.log('SYSTEM:\n', ANALYSIS_SYSTEM_PROMPT)
    console.log('\nUSER:\n', userPrompt)
    console.log('────────────────────────────────────────────────────────────\n')

    const t0 = Date.now()
    let response: Awaited<ReturnType<typeof this.client.responses.create>>
    try {
      response = await this.client.responses.create({
        model: this.model,
        tools: [{ type: 'web_search_preview' }],
        instructions: ANALYSIS_SYSTEM_PROMPT,
        input: userPrompt
      })
    } catch (err) {
      const latencyMs = Date.now() - t0
      appendAnalyticsRecord({
        timestamp: new Date().toISOString(),
        sessionId: SESSION_ID,
        phase: 'Match Analysis',
        provider: 'openai',
        model: this.model,
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

    const text = response.output_text
    console.log('\n─── [OpenAI] analyseMatchup RESPONSE ──────────────────────')
    recordUsage(this.model, response.usage?.input_tokens ?? 0, response.usage?.output_tokens ?? 0, 'Match Analysis')
    appendAnalyticsRecord({
      timestamp: new Date().toISOString(),
      phase: 'Match Analysis',
      provider: 'openai',
      model: this.model,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      costUsd: computeCost(this.model, response.usage?.input_tokens ?? 0, response.usage?.output_tokens ?? 0),
      latencyMs,
      success: true,
      error: null,
      meta: { myChampion: params.myChampion, myRole: params.myRole, enemyLaner: params.enemyLaner }
    })
    console.log(text)
    console.log('────────────────────────────────────────────────────────────\n')

    if (!text) throw new Error('No text response from OpenAI')

    let json: unknown
    try {
      const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/```$/m, '').trim()
      json = JSON.parse(cleaned)
    } catch {
      throw new Error(`OpenAI returned non-JSON: ${text.slice(0, 200)}`)
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
    console.log('\n─── [OpenAI] detectEnemyPicks REQUEST ─────────────────────')
    console.log('PROMPT:\n', VISION_PROMPT)
    console.log('IMAGE: <base64 PNG,', screenshotBase64.length, 'chars>')
    console.log('────────────────────────────────────────────────────────────\n')

    const recordTimestamp = new Date().toISOString()
    const t0 = Date.now()
    let response: Awaited<ReturnType<typeof this.client.chat.completions.create>>
    try {
      response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${screenshotBase64}`, detail: 'low' }
              },
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
        provider: 'openai',
        model: this.model,
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
    console.log('\n─── [OpenAI] detectEnemyPicks RESPONSE ────────────────────')
    recordUsage(this.model, response.usage?.prompt_tokens ?? 0, response.usage?.completion_tokens ?? 0, 'Auto-Detect')
    console.log(text)
    console.log('────────────────────────────────────────────────────────────\n')

    const blank = { picks: [], myChampion: null, myRole: null, scene: 'unknown', note: 'No response from OpenAI', pendingRoles: [], recordTimestamp }
    if (!text) {
      appendAnalyticsRecord({
        timestamp: recordTimestamp,
        sessionId: SESSION_ID,
        phase: 'Auto-Detect',
        provider: 'openai',
        model: this.model,
        promptVersion: VISION_PROMPT_VERSION,
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        costUsd: computeCost(this.model, response.usage?.prompt_tokens ?? 0, response.usage?.completion_tokens ?? 0),
        latencyMs,
        success: false,
        error: 'No text in response',
        meta: {}
      })
      return blank
    }

    try {
      const raw = text.replace(/^```(?:json)?\n?/m, '').replace(/```$/m, '').trim()
      const start = raw.indexOf('{')
      const end = raw.lastIndexOf('}')
      if (start === -1 || end === -1) {
        appendAnalyticsRecord({
          timestamp: new Date().toISOString(),
          phase: 'Auto-Detect',
          provider: 'openai',
          model: this.model,
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
          costUsd: computeCost(this.model, response.usage?.prompt_tokens ?? 0, response.usage?.completion_tokens ?? 0),
          latencyMs,
          success: false,
          error: 'No JSON found in response',
          meta: {}
        })
        return blank
      }
      const parsed = JSON.parse(raw.slice(start, end + 1)) as {
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
        provider: 'openai',
        model: this.model,
        promptVersion: VISION_PROMPT_VERSION,
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        costUsd: computeCost(this.model, response.usage?.prompt_tokens ?? 0, response.usage?.completion_tokens ?? 0),
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
        provider: 'openai',
        model: this.model,
        promptVersion: VISION_PROMPT_VERSION,
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        costUsd: computeCost(this.model, response.usage?.prompt_tokens ?? 0, response.usage?.completion_tokens ?? 0),
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

function dedupeRoles(
  picks: { champion: string; role: string }[]
): { picks: { champion: string; role: string }[]; deduped: boolean } {
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
  return { picks: result, deduped: needsRole.length > 0 }
}
