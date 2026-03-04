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

// Re-export the shared type so other main-process code can import from here
export type { AnalysisResult }

// Pricing per 1M tokens (as of 2025)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'claude-opus-4-6':   { input: 15.00, output: 75.00 },
}

function logUsage(model: string, usage: { input_tokens: number; output_tokens: number }) {
  const p = PRICING[model] ?? { input: 3.00, output: 15.00 }
  const cost = (usage.input_tokens / 1_000_000) * p.input + (usage.output_tokens / 1_000_000) * p.output
  console.log(`[Usage] in=${usage.input_tokens} out=${usage.output_tokens} | est. $${cost.toFixed(4)} (${model})`)
}

// ── Client ───────────────────────────────────────────────────────────────────

export class ClaudeClient implements AIClient {
  readonly provider = 'claude' as const
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async analyseMatchup(params: AnalysisPromptParams): Promise<AnalysisResult> {
    const userPrompt = buildAnalysisUserPrompt(params)

    console.log('\n─── [Claude] analyseMatchup REQUEST ───────────────────────')
    console.log('SYSTEM:\n', ANALYSIS_SYSTEM_PROMPT)
    console.log('\nUSER:\n', userPrompt)
    console.log('────────────────────────────────────────────────────────────\n')

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: ANALYSIS_SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: userPrompt }]
    })

    console.log('\n─── [Claude] analyseMatchup RESPONSE ──────────────────────')
    logUsage('claude-sonnet-4-6', response.usage)
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
    scene: string
    note: string
    pendingRoles: string[]
  }> {
    console.log('\n─── [Claude] detectEnemyPicks REQUEST ─────────────────────')
    console.log('PROMPT:\n', VISION_PROMPT)
    console.log('IMAGE: <base64 PNG,', screenshotBase64.length, 'chars>')
    console.log('────────────────────────────────────────────────────────────\n')

    const response = await this.client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 256,
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

    const textBlock = response.content.find((b) => b.type === 'text')
    console.log('\n─── [Claude] detectEnemyPicks RESPONSE ────────────────────')
    logUsage('claude-opus-4-6', response.usage)
    console.log(textBlock?.type === 'text' ? textBlock.text : '(no text block)')
    console.log('────────────────────────────────────────────────────────────\n')

    const blank = { picks: [], myChampion: null, scene: 'unknown', note: 'No response from Claude', pendingRoles: [] }
    if (!textBlock || textBlock.type !== 'text') return blank

    try {
      const raw = textBlock.text
      const start = raw.indexOf('{')
      const end = raw.lastIndexOf('}')
      if (start === -1 || end === -1) return blank
      const parsed = JSON.parse(raw.slice(start, end + 1)) as {
        scene: string
        my_champion: string | null
        enemy_picks: { champion: string; role: string }[]
        pending_roles: string[]
        note: string
      }
      return {
        picks: parsed.enemy_picks ?? [],
        myChampion: parsed.my_champion ?? null,
        scene: parsed.scene ?? 'unknown',
        note: parsed.note ?? '',
        pendingRoles: parsed.pending_roles ?? [],
      }
    } catch {
      return blank
    }
  }
}
