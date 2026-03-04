import type { GameplanData } from '../../../../shared/types'
import { useItemImages } from '../hooks/useItemImages'

type Props = { gameplan: GameplanData }

const PLAYSTYLE_CONFIG = {
  'Play Safe':  { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.30)' },
  'Neutral':    { color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.30)'  },
  'Aggressive': { color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.30)'  },
}

function SectionLabel({ children }: { children: string }) {
  return (
    <span className="text-[9px] text-white/25 uppercase tracking-widest font-semibold">
      {children}
    </span>
  )
}

export default function Gameplan({ gameplan }: Props) {
  const style = PLAYSTYLE_CONFIG[gameplan.playstyle]
  const { getImageUrl } = useItemImages()

  return (
    <div className="flex flex-col gap-2.5">
      {/* Header + playstyle badge */}
      <div className="flex items-center justify-between">
        <p className="text-white/30 text-[10px] uppercase tracking-wider">Gameplan · First 10 min</p>
        <span
          className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wide"
          style={{ color: style.color, background: style.bg, border: `1px solid ${style.border}` }}
        >
          {gameplan.playstyle}
        </span>
      </div>

      {/* Early game focus */}
      <div className="flex flex-col gap-1">
        <SectionLabel>Lane Focus</SectionLabel>
        <p className="text-white/65 text-[11px] leading-relaxed">{gameplan.early_game}</p>
      </div>

      {/* Enemy strategy */}
      <div className="flex flex-col gap-1">
        <SectionLabel>Their Angle</SectionLabel>
        <p className="text-white/65 text-[11px] leading-relaxed pl-2 border-l-2" style={{ borderColor: `${style.color}50` }}>
          {gameplan.enemy_strategy}
        </p>
      </div>

      {/* Team threats */}
      {gameplan.team_threats.length > 0 && (
        <div className="flex flex-col gap-1">
          <SectionLabel>Team Threats</SectionLabel>
          {gameplan.team_threats.map((threat, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="flex-shrink-0 mt-0.5 text-[11px]" style={{ color: '#fb923c' }}>⚠</span>
              <span className="text-white/55 text-[11px] leading-snug">{threat}</span>
            </div>
          ))}
        </div>
      )}

      {/* Don't do */}
      {gameplan.dont_do.length > 0 && (
        <div className="flex flex-col gap-1">
          <SectionLabel>Don't Do</SectionLabel>
          {gameplan.dont_do.map((rule, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="flex-shrink-0 mt-0.5 text-[11px]" style={{ color: '#f87171' }}>✕</span>
              <span className="text-white/55 text-[11px] leading-snug">{rule}</span>
            </div>
          ))}
        </div>
      )}

      {/* Power spikes */}
      {gameplan.power_spikes.length > 0 && (
        <div className="flex flex-col gap-1">
          <SectionLabel>Power Spikes</SectionLabel>
          <div className="flex gap-1.5 flex-wrap">
            {gameplan.power_spikes.map((spike, i) => (
              <span
                key={i}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] leading-none"
                style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.20)', color: '#facc15cc' }}
              >
                <span style={{ fontSize: 9 }}>⚡</span>{spike}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Minor items */}
      {gameplan.minor_items.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Minor Buys</SectionLabel>
          <div className="flex gap-2 flex-wrap">
            {gameplan.minor_items.map((item, i) => {
              const imgUrl = getImageUrl(item)
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={item}
                      style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid rgba(200,170,110,0.25)' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <div style={{
                      width: 32, height: 32, borderRadius: 6,
                      background: 'rgba(200,170,110,0.12)', border: '1px solid rgba(200,170,110,0.22)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span style={{ fontSize: 10, color: 'rgba(200,170,110,0.6)', fontWeight: 700 }}>{item[0]}</span>
                    </div>
                  )}
                  <span className="text-white/45 text-[9px] leading-none text-center max-w-[40px] truncate">{item}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
