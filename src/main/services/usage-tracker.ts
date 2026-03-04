export interface UsageSnapshot {
  inputTokens: number
  outputTokens: number
  costUsd: number
  calls: number
}

// Pricing per 1M tokens
const PRICING: Record<string, { input: number; output: number }> = {
  // Claude
  'claude-sonnet-4-6':           { input: 3.00,  output: 15.00 },
  'claude-opus-4-6':             { input: 15.00, output: 75.00 },
  'claude-haiku-4-5-20251001':   { input: 0.80,  output: 4.00  },
  // OpenAI
  'gpt-4.1':                     { input: 2.00,  output: 8.00  },
  'gpt-4o':                      { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':                 { input: 0.15,  output: 0.60  },
}

const session: UsageSnapshot = { inputTokens: 0, outputTokens: 0, costUsd: 0, calls: 0 }

export function computeCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model]
  if (!p) return 0 // OpenRouter free models / unknown
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
}

export function recordUsage(model: string, inputTokens: number, outputTokens: number): void {
  const cost = computeCost(model, inputTokens, outputTokens)
  session.inputTokens += inputTokens
  session.outputTokens += outputTokens
  session.costUsd += cost
  session.calls++
  console.log(`[Usage] ${model} | in=${inputTokens} out=${outputTokens} | $${cost.toFixed(4)} | session total: $${session.costUsd.toFixed(4)}`)
}

export function getSessionUsage(): UsageSnapshot {
  return { ...session }
}

export function resetSession(): void {
  session.inputTokens = 0
  session.outputTokens = 0
  session.costUsd = 0
  session.calls = 0
}
