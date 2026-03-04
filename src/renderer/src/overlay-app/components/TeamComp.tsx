import type { TeamCompData } from '../../../../shared/types'

type Props = { teamComp: TeamCompData }

const TYPE_COLOR: Record<TeamCompData['damage_type'], string> = {
  'AD Heavy':     '#f87171',
  'AP Heavy':     '#a78bfa',
  'Mixed':        '#fb923c',
  'Tank Heavy':   '#60a5fa',
  'Poke Heavy':   '#34d399',
  'Engage Heavy': '#f59e0b',
}

export default function TeamComp({ teamComp }: Props) {
  const color = TYPE_COLOR[teamComp.damage_type] ?? '#fff'
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-white/30 text-[10px] uppercase tracking-wider">Team Comp</p>

      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold" style={{ color }}>{teamComp.damage_type}</span>
        <span className="text-[10px] text-white/35">{teamComp.ad_percent}% AD · {teamComp.ap_percent}% AP</span>
      </div>

      {/* Bar */}
      <div className="h-1.5 rounded-full overflow-hidden bg-white/8 flex">
        <div className="h-full" style={{ width: `${teamComp.ad_percent}%`, background: '#f87171' }} />
        <div className="h-full" style={{ width: `${teamComp.ap_percent}%`, background: '#a78bfa' }} />
      </div>

      {/* Tags */}
      {teamComp.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {teamComp.tags.map(tag => (
            <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 border border-white/8 text-white/45">
              {tag}
            </span>
          ))}
        </div>
      )}

      {teamComp.note && (
        <p className="text-white/45 text-[11px] leading-relaxed pl-2 border-l border-lol-gold/20">{teamComp.note}</p>
      )}
    </div>
  )
}
