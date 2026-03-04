import Anthropic from '@anthropic-ai/sdk'
import type { AnalysisResult } from '../../shared/types'
import {
  ANALYSIS_SYSTEM_PROMPT,
  VISION_PROMPT,
  buildAnalysisUserPrompt,
  type AnalysisPromptParams
} from '../prompts'
import type { AIClient } from './ai-client'
import { AnalysisResultSchema } from './schemas'
import { recordUsage, computeCost } from './usage-tracker'
import { appendAnalyticsRecord } from './analytics-store'

// Re-export the shared type so other main-process code can import from here
export type { AnalysisResult }

const ALL_ROLES = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']

function dedupeRoles(picks: { champion: string; role: string }[]): { champion: string; role: string }[] {
  const used = new Set<string>()
  const result: { champion: string; role: string }[] = []
  const needsRole: { champion: string; role: string }[] = []

  for (const pick of picks) {
    const role = pick.role
    if (!used.has(role)) {
      used.add(role)
      result.push(pick)
    } else {
      needsRole.push(pick)
    }
  }

  for (const pick of needsRole) {
    const remaining = ALL_ROLES.find(r => !used.has(r))
    if (remaining) {
      used.add(remaining)
      result.push({ champion: pick.champion, role: remaining })
    } else {
      result.push(pick)
    }
  }

  return result
}

// ── Client ───────────────────────────────────────────────────────────────────

export class ClaudeClient implements AIClient {
  readonly provider = 'claude' as const
  private client: Anthropic
  private model: string

  constructor(apiKey: string, model = 'claude-sonnet-4-6') {
    this.client = new Anthropic({ apiKey })
    this.model = model
  }

  async analyseMatchup(params: AnalysisPromptParams): Promise<AnalysisResult> {
    const userPrompt = buildAnalysisUserPrompt(params)

    console.log('\n─── [Claude] analyseMatchup REQUEST ───────────────────────')
    console.log('MODEL:', this.model)
    console.log('SYSTEM:\n', ANALYSIS_SYSTEM_PROMPT)
    console.log('\nUSER:\n', userPrompt)
    console.log('────────────────────────────────────────────────────────────\n')

    const t0 = Date.now()
    let response: Awaited<ReturnType<typeof this.client.messages.create>>
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: ANALYSIS_SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: userPrompt }]
      })
    } catch (err) {
      const latencyMs = Date.now() - t0
      appendAnalyticsRecord({
        timestamp: new Date().toISOString(),
        phase: 'Match Analysis',
        provider: 'claude',
        model: this.model,
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

    console.log('\n─── [Claude] analyseMatchup RESPONSE ──────────────────────')
    recordUsage(this.model, response.usage.input_tokens, response.usage.output_tokens, 'Match Analysis')
    appendAnalyticsRecord({
      timestamp: new Date().toISOString(),
      phase: 'Match Analysis',
      provider: 'claude',
      model: this.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      costUsd: computeCost(this.model, response.usage.input_tokens, response.usage.output_tokens),
      latencyMs,
      success: true,
      error: null,
      meta: { myChampion: params.myChampion, myRole: params.myRole, enemyLaner: params.enemyLaner }
    })
    console.log('stop_reason:', response.stop_reason)
    console.log('content blocks:', response.content.length)
    response.content.forEach((block, i) => {
      if (block.type === 'text') {
        console.log(`\n[block ${i}] TEXT (full):\n${block.text}`)
      } else {
        console.log(`[block ${i}] type=${block.type}`)
      }
    })
    console.log('────────────────────────────────────────────────────────────\n')

    // Use the last text block — it comes after any web_search tool blocks
    const textBlocks = response.content.filter((b) => b.type === 'text')
    const textBlock = textBlocks[textBlocks.length - 1]

    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    let json: unknown
    try {
      // Extract from first { to last } — handles markdown fences and any preamble
      const raw = textBlock.text
      const start = raw.indexOf('{')
      const end = raw.lastIndexOf('}')
      if (start === -1 || end === -1) throw new Error('No JSON object found')
      json = JSON.parse(raw.slice(start, end + 1))
    } catch (e) {
      throw new Error(`Claude returned non-JSON.\nFull response:\n${textBlock.text}`)
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
    console.log('\n─── [Claude] detectEnemyPicks REQUEST ─────────────────────')
    console.log('PROMPT:\n', VISION_PROMPT)
    console.log('IMAGE: <base64 PNG,', screenshotBase64.length, 'chars>')
    console.log('────────────────────────────────────────────────────────────\n')

    const recordTimestamp = new Date().toISOString()
    const t0 = Date.now()
    let response: Awaited<ReturnType<typeof this.client.messages.create>>
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/png', data: screenshotBase64 }
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
        phase: 'Auto-Detect',
        provider: 'claude',
        model: this.model,
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

    const textBlock = response.content.find((b) => b.type === 'text')
    console.log('\n─── [Claude] detectEnemyPicks RESPONSE ────────────────────')
    recordUsage(this.model, response.usage.input_tokens, response.usage.output_tokens, 'Auto-Detect')
    console.log(textBlock?.type === 'text' ? textBlock.text : '(no text block)')
    console.log('────────────────────────────────────────────────────────────\n')

    const blank = { picks: [], myChampion: null, myRole: null, scene: 'unknown', note: 'No response from Claude', pendingRoles: [], recordTimestamp }
    if (!textBlock || textBlock.type !== 'text') {
      appendAnalyticsRecord({
        timestamp: recordTimestamp,
        phase: 'Auto-Detect',
        provider: 'claude',
        model: this.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        costUsd: computeCost(this.model, response.usage.input_tokens, response.usage.output_tokens),
        latencyMs,
        success: false,
        error: 'No text block in response',
        meta: {}
      })
      return blank
    }

    try {
      const raw = textBlock.text
      const start = raw.indexOf('{')
      const end = raw.lastIndexOf('}')
      if (start === -1 || end === -1) {
        appendAnalyticsRecord({
          timestamp: recordTimestamp,
          phase: 'Auto-Detect',
          provider: 'claude',
          model: this.model,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          costUsd: computeCost(this.model, response.usage.input_tokens, response.usage.output_tokens),
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
      }
      const picks = dedupeRoles(parsed.enemy_picks ?? [])
      appendAnalyticsRecord({
        timestamp: recordTimestamp,
        phase: 'Auto-Detect',
        provider: 'claude',
        model: this.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        costUsd: computeCost(this.model, response.usage.input_tokens, response.usage.output_tokens),
        latencyMs,
        success: true,
        error: null,
        meta: {
          scene: parsed.scene,
          detectedCount: picks.length,
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
        phase: 'Auto-Detect',
        provider: 'claude',
        model: this.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        costUsd: computeCost(this.model, response.usage.input_tokens, response.usage.output_tokens),
        latencyMs,
        success: false,
        error: 'JSON parse failed',
        meta: {}
      })
      return blank
    }
  }
}
