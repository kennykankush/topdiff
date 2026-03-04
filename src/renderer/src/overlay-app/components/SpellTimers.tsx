import { useState, useEffect, useRef } from 'react'

const DDRAGON = '14.24.1'

const SPELLS = [
  { name: 'Flash',   key: 'SummonerFlash',   cd: 300 },
  { name: 'Ign',     key: 'SummonerDot',      cd: 180 },
  { name: 'TP',      key: 'SummonerTeleport', cd: 360 },
  { name: 'Ghost',   key: 'SummonerHaste',    cd: 210 },
  { name: 'Exh',     key: 'SummonerExhaust',  cd: 210 },
  { name: 'Heal',    key: 'SummonerHeal',     cd: 240 },
  { name: 'Bar',     key: 'SummonerBarrier',  cd: 180 },
  { name: 'Cln',     key: 'SummonerBoost',    cd: 210 },
  { name: 'Smite',   key: 'SummonerSmite',    cd: 15  },
] as const

type SpellKey = typeof SPELLS[number]['key']
type TimerMap = Record<SpellKey, { remaining: number; active: boolean }>

function fmt(s: number) {
  if (s <= 0) return 'UP'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${s}s`
}

const init = (): TimerMap =>
  Object.fromEntries(SPELLS.map(s => [s.key, { remaining: 0, active: false }])) as TimerMap

export default function SpellTimers() {
  const [timers, setTimers] = useState<TimerMap>(init)
  const iv = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    iv.current = setInterval(() => {
      setTimers(prev => {
        let changed = false
        const next = { ...prev }
        for (const key of Object.keys(next) as SpellKey[]) {
          if (next[key].active && next[key].remaining > 0) {
            next[key] = { ...next[key], remaining: next[key].remaining - 1 }
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, 1000)
    return () => { if (iv.current) clearInterval(iv.current) }
  }, [])

  function start(spell: typeof SPELLS[number]) {
    setTimers(prev => ({ ...prev, [spell.key]: { remaining: spell.cd, active: true } }))
  }

  return (
    <div className="px-3 py-2 border-b border-white/5">
      <p className="text-white/25 text-[9px] uppercase tracking-wider mb-1.5">Summoner Spells</p>
      <div className="flex gap-1.5 flex-wrap">
        {SPELLS.map(spell => {
          const s = timers[spell.key]
          const up = s.active && s.remaining === 0
          const active = s.active && s.remaining > 0
          return (
            <button
              key={spell.key}
              onClick={() => start(spell)}
              className="no-drag flex flex-col items-center gap-0.5 active:scale-90 transition-transform"
            >
              <div
                className="relative w-8 h-8 rounded overflow-hidden"
                style={{
                  border: up ? '1.5px solid #4ade80' : active ? '1.5px solid #fb923c' : '1.5px solid rgba(255,255,255,0.08)',
                  boxShadow: up ? '0 0 6px rgba(74,222,128,0.5)' : undefined
                }}
              >
                <img
                  src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON}/img/spell/${spell.key}.png`}
                  alt={spell.name}
                  className="w-full h-full object-cover"
                  style={{ opacity: active ? 0.25 : 1 }}
                />
                {s.active && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span style={{ fontSize: 8, fontWeight: 700, color: up ? '#4ade80' : 'white', lineHeight: 1 }}>
                      {fmt(s.remaining)}
                    </span>
                  </div>
                )}
              </div>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', lineHeight: 1 }}>{spell.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
