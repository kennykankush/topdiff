import type { LiveSnapshot } from '../../../../shared/types'

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const shadow = [
  '0 0 6px rgba(0,0,0,1)',
  '0 0 14px rgba(0,0,0,1)',
  '0 1px 3px rgba(0,0,0,1)',
  '0 2px 8px rgba(0,0,0,0.9)',
].join(', ')

const diffCol = (n: number) => n > 0 ? '#4ade80' : n < 0 ? '#f87171' : 'rgba(255,255,255,0.5)'

type Props = { snapshot: LiveSnapshot; onTogglePanel: () => void }

export default function CompactLiveView({ snapshot, onTogglePanel }: Props) {
  const {
    gameTime, isDead, respawnTimer, currentGold,
    level, scores, csPerMin, expectedCS, killParticipation,
    teamGoldDiff, enemyLaner, objectives, myChampion,
  } = snapshot

  const csDiff   = scores.creepScore - expectedCS
  const goldK    = (n: number) => Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(1)}k` : String(Math.abs(n))
  const goldDiff = teamGoldDiff >= 0 ? `+${goldK(teamGoldDiff)}` : `-${goldK(teamGoldDiff)}`

  return (
    <div className="w-full flex flex-col justify-between" style={{ minHeight: 120, background: 'transparent' }}>

      <div className="flex-1 px-3 pt-3 flex flex-col gap-2.5">

        {/* Game time + gold diff */}
        <div className="flex items-baseline justify-between">
          <span style={{ fontSize: 13, fontWeight: 800, color: 'white', textShadow: shadow }}>
            {fmtTime(gameTime)}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: diffCol(teamGoldDiff), textShadow: shadow }}>
            Team {goldDiff}g
          </span>
        </div>

        {/* Dead banner */}
        {isDead ? (
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: '#f87171', textShadow: shadow, letterSpacing: '0.1em' }}>
              DEAD · {Math.ceil(respawnTimer)}s
            </span>
          </div>
        ) : (
          <>
            {/* KDA + KP */}
            <div className="flex items-baseline gap-2">
              <span style={{ fontSize: 14, fontWeight: 700, color: 'white', textShadow: shadow }}>
                {scores.kills}/{scores.deaths}/{scores.assists}
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textShadow: shadow }}>
                {killParticipation}% KP
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textShadow: shadow, marginLeft: 'auto' }}>
                {myChampion} Lv{level}
              </span>
            </div>

            {/* CS row */}
            <div className="flex items-baseline gap-2">
              <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)', textShadow: shadow }}>
                {scores.creepScore} CS
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textShadow: shadow }}>
                {csPerMin.toFixed(1)}/min
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: diffCol(csDiff), textShadow: shadow }}>
                {csDiff >= 0 ? '+' : ''}{csDiff} pace
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textShadow: shadow, marginLeft: 'auto' }}>
                {currentGold.toLocaleString()}g
              </span>
            </div>

            {/* Enemy laner */}
            {enemyLaner && (
              <div className="flex items-baseline gap-2">
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textShadow: shadow }}>
                  vs {enemyLaner.championName}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textShadow: shadow }}>
                  {enemyLaner.scores.creepScore} CS
                </span>
                {(() => {
                  const d = scores.creepScore - enemyLaner.scores.creepScore
                  return (
                    <span style={{ fontSize: 10, fontWeight: 700, color: diffCol(d), textShadow: shadow }}>
                      {d >= 0 ? '+' : ''}{d}
                    </span>
                  )
                })()}
                {enemyLaner.isDead && (
                  <span style={{ fontSize: 10, color: '#f87171', textShadow: shadow, marginLeft: 'auto' }}>
                    ☠ {Math.ceil(enemyLaner.respawnTimer)}s
                  </span>
                )}
              </div>
            )}

            {/* Objectives */}
            <div className="flex items-baseline gap-4">
              <div className="flex items-baseline gap-1.5">
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textShadow: shadow, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dragon</span>
                <span style={{ fontSize: 10, fontWeight: objectives.nextDragon === 0 ? 700 : 400, color: objectives.nextDragon === 0 ? '#4ade80' : 'rgba(255,255,255,0.65)', textShadow: shadow }}>
                  {objectives.nextDragon === 0 ? 'UP' : fmtTime(objectives.nextDragon)}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textShadow: shadow, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Baron</span>
                <span style={{ fontSize: 10, fontWeight: objectives.nextBaron === 0 ? 700 : 400, color: objectives.nextBaron === 0 ? '#4ade80' : 'rgba(255,255,255,0.65)', textShadow: shadow }}>
                  {objectives.nextBaron < 0 ? '20:00' : objectives.nextBaron === 0 ? 'UP' : fmtTime(objectives.nextBaron)}
                </span>
              </div>
            </div>
          </>
        )}

      </div>

      {/* Back button */}
      <div className="no-drag flex justify-end px-3 pb-3 pt-2">
        <button
          onClick={onTogglePanel}
          className="text-white/35 hover:text-white/70 text-[9px] uppercase tracking-widest transition-colors"
          style={{ textShadow: shadow }}
        >
          panel
        </button>
      </div>

    </div>
  )
}
