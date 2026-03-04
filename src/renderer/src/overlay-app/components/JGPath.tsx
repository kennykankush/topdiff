import type { JGPathData } from '../../../../shared/types'

type Props = { jgPath: JGPathData }

export default function JGPath({ jgPath }: Props) {
  const isRed = jgPath.start_buff === 'Red'
  const buffColor = isRed ? '#f87171' : '#60a5fa'
  const buffBg = isRed ? 'rgba(248,113,113,0.10)' : 'rgba(96,165,250,0.10)'
  const buffBorder = isRed ? 'rgba(248,113,113,0.25)' : 'rgba(96,165,250,0.25)'

  return (
    <div className="flex flex-col gap-1.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-white/30 text-[10px] uppercase tracking-wider">JG Path · {jgPath.champion}</p>
        <span
          className="px-2 py-0.5 rounded text-[10px] font-bold"
          style={{ color: buffColor, background: buffBg, border: `1px solid ${buffBorder}` }}
        >
          {jgPath.start_buff} Start
        </span>
      </div>

      {/* Path summary */}
      <p className="text-white/60 text-[11px] leading-snug">{jgPath.path_summary}</p>

      {/* Gank timing + ward tip */}
      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-1.5">
          <span className="text-[10px] flex-shrink-0 mt-0.5" style={{ color: '#fb923c' }}>⚠</span>
          <span className="text-white/55 text-[11px] leading-snug">{jgPath.gank_timing}</span>
        </div>
        <div className="flex items-start gap-1.5">
          <span className="text-[10px] flex-shrink-0 mt-0.5" style={{ color: '#4ade80' }}>◈</span>
          <span className="text-white/55 text-[11px] leading-snug">{jgPath.ward_tip}</span>
        </div>
      </div>
    </div>
  )
}
