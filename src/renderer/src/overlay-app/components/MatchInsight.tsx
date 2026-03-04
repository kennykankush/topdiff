import type { MatchInsightData } from '../../../../shared/types'

type Props = { insight: MatchInsightData }

export default function MatchInsight({ insight }: Props) {
  const diffColor = insight.difficulty <= 3 ? '#4ade80' : insight.difficulty <= 6 ? '#fb923c' : '#f87171'
  const diffLabel = insight.difficulty <= 3 ? 'Favourable' : insight.difficulty <= 6 ? 'Even' : 'Difficult'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <p className="text-white/30 text-[10px] uppercase tracking-wider">Matchup Stats</p>
        <div className="flex items-center gap-2">
          <span className="text-white/55 text-[11px]">{insight.win_rate.toFixed(1)}% WR</span>
          <span className="text-[11px] font-medium" style={{ color: diffColor }}>{diffLabel}</span>
        </div>
      </div>

      {/* Difficulty dots */}
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="flex-1 h-1.5 rounded-sm"
            style={{ background: i < insight.difficulty ? diffColor : 'rgba(255,255,255,0.08)' }}
          />
        ))}
      </div>

      {/* Tips */}
      <div className="flex flex-col gap-1 mt-0.5">
        {insight.tips.map((tip, i) => (
          <div key={i} className="flex gap-1.5 items-start">
            <span className="text-lol-gold/40 text-[10px] mt-0.5 flex-shrink-0">▸</span>
            <span className="text-white/55 text-[11px] leading-relaxed">{tip}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
