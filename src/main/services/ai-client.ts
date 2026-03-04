import type { AnalysisResult } from '../../shared/types'
import type { AnalysisPromptParams } from '../prompts'

export interface AIClient {
  analyseMatchup(params: AnalysisPromptParams): Promise<AnalysisResult>
  detectEnemyPicks(screenshotBase64: string): Promise<{
    picks: { champion: string; role: string }[]
    myChampion: string | null
    myRole: string | null
    scene: string
    note: string
    pendingRoles: string[]
    recordTimestamp: string
  }>
  readonly provider: 'claude' | 'openai' | 'openrouter'
}
