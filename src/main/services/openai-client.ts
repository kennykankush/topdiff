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

    const response = await this.client.responses.create({
      model: this.model,
      tools: [{ type: 'web_search_preview' }],
      instructions: ANALYSIS_SYSTEM_PROMPT,
      input: userPrompt
    })

    const text = response.output_text
    console.log('\n─── [OpenAI] analyseMatchup RESPONSE ──────────────────────')
    recordUsage(this.model, response.usage?.input_tokens ?? 0, response.usage?.output_tokens ?? 0)
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

  async detectEnemyPicks(screenshotBase64: string): Promise<string[]> {
    console.log('\n─── [OpenAI] detectEnemyPicks REQUEST ─────────────────────')
    console.log('PROMPT:\n', VISION_PROMPT)
    console.log('IMAGE: <base64 PNG,', screenshotBase64.length, 'chars>')
    console.log('────────────────────────────────────────────────────────────\n')

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${screenshotBase64}`,
                detail: 'low'
              }
            },
            { type: 'text', text: VISION_PROMPT }
          ]
        }
      ]
    })

    const text = response.choices[0]?.message?.content
    console.log('\n─── [OpenAI] detectEnemyPicks RESPONSE ────────────────────')
    recordUsage(this.model, response.usage?.prompt_tokens ?? 0, response.usage?.completion_tokens ?? 0)
    console.log(text)
    console.log('────────────────────────────────────────────────────────────\n')

    if (!text) return []

    try {
      const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/```$/m, '').trim()
      const parsed = JSON.parse(cleaned) as { enemy_picks: string[] }
      return parsed.enemy_picks ?? []
    } catch {
      return []
    }
  }
}
