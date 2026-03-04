import OpenAI from 'openai'
import type { AnalysisResult } from '../../shared/types'
import {
  ANALYSIS_SYSTEM_PROMPT,
  VISION_PROMPT,
  buildAnalysisUserPrompt,
  type AnalysisPromptParams
} from '../prompts'
import type { AIClient } from './ai-client'
import { AnalysisResultSchema } from './schemas'
import { recordUsage } from './usage-tracker'

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

    const response = await this.client.chat.completions.create({
      model: this.textModel,
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ]
    })

    const text = response.choices[0]?.message?.content
    console.log('\n─── [OpenRouter] analyseMatchup RESPONSE ───────────────────')
    recordUsage(this.textModel, response.usage?.prompt_tokens ?? 0, response.usage?.completion_tokens ?? 0)
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
    scene: string
    note: string
    pendingRoles: string[]
  }> {
    console.log('\n─── [OpenRouter] detectEnemyPicks REQUEST ──────────────────')
    console.log('MODEL:', this.visionModel)
    console.log('PROMPT:\n', VISION_PROMPT)
    console.log('IMAGE: <base64 PNG,', screenshotBase64.length, 'chars>')
    console.log('────────────────────────────────────────────────────────────\n')

    const response = await this.client.chat.completions.create({
      model: this.visionModel,
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${screenshotBase64}` }
            },
            { type: 'text', text: VISION_PROMPT }
          ]
        }
      ]
    })

    const text = response.choices[0]?.message?.content
    console.log('\n─── [OpenRouter] detectEnemyPicks RESPONSE ─────────────────')
    recordUsage(this.visionModel, response.usage?.prompt_tokens ?? 0, response.usage?.completion_tokens ?? 0)
    console.log(text)
    console.log('────────────────────────────────────────────────────────────\n')

    const blank = { picks: [], myChampion: null, scene: 'unknown', note: 'No response from OpenRouter', pendingRoles: [] }
    if (!text) return blank

    try {
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start === -1 || end === -1) return blank
      const parsed = JSON.parse(text.slice(start, end + 1)) as {
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
