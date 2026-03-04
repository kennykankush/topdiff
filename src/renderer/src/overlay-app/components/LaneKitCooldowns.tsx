import type { EnemyLanerData } from '../../../../shared/types'

type Props = { enemyLaner: EnemyLanerData }

const SPELL_KEYS = ['Q', 'W', 'E', 'R'] as const

export default function LaneKitCooldowns({ enemyLaner }: Props) {
  const { champion, abilities } = enemyLaner

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-white/30 text-[10px] uppercase tracking-wider">{champion} — Kit</p>
      <div className="flex flex-col gap-2">
        {SPELL_KEYS.map(key => {
          const ab = abilities[key]
          const cds = ab.cooldown_pre6 ?? ab.cooldown_levels ?? []
          const cdStr = cds.length > 0 ? `${cds[0]}–${cds[cds.length - 1]}s` : '—'

          return (
            <div key={key} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded bg-white/8 text-white/60 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {key}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-white/85 text-[12px] font-medium">{ab.name}</span>
                  {ab.summary && (
                    <span className="px-1 py-0.5 rounded bg-white/5 border border-white/8 text-white/40 text-[10px] leading-none">
                      {ab.summary}
                    </span>
                  )}
                  <span className="text-lol-blue/60 text-[10px] ml-auto">{cdStr}</span>
                </div>
                <p className="text-white/40 text-[10px] leading-snug mt-0.5">{ab.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
