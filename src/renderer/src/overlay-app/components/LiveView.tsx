import type { LiveSnapshot } from '../../../../shared/types'

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function StatRow({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{value}</span>
        {sub}
      </div>
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0' }} />
}

type Props = { snapshot: LiveSnapshot }

export default function LiveView({ snapshot }: Props) {
  const {
    gameTime, isDead, respawnTimer, currentGold,
    level, scores, csPerMin, expectedCS, killParticipation,
    teamGoldDiff, enemyLaner, objectives, myChampion, myPosition,
  } = snapshot

  const csDiff  = scores.creepScore - expectedCS
  const goldK   = (n: number) => Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
  const signed  = (n: number) => n >= 0 ? `+${goldK(n)}` : `-${goldK(-n)}`
  const diffCol = (n: number) => n > 0 ? '#4ade80' : n < 0 ? '#f87171' : 'rgba(255,255,255,0.4)'

  return (
    <div className="flex flex-col gap-0" style={{ fontSize: 11 }}>

      {/* Game header — time + team gold diff */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <span style={{ fontSize: 12, fontWeight: 700, color: '#c8aa6e', letterSpacing: '0.06em' }}>
          {fmtTime(gameTime)}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color: diffCol(teamGoldDiff) }}>
          Team {teamGoldDiff >= 0 ? '+' : ''}{goldK(teamGoldDiff)}g
        </span>
      </div>

      {/* Dead banner */}
      {isDead && (
        <div className="mx-3 mt-2 py-2 text-center" style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 4,
        }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#f87171', letterSpacing: '0.12em' }}>
            DEAD · {Math.ceil(respawnTimer)}s
          </span>
        </div>
      )}

      {/* Your stats */}
      <div className="mx-3 mt-2 px-2.5 py-2.5" style={{
        background: 'rgba(200,170,110,0.05)',
        border: '1px solid rgba(200,170,110,0.12)',
        borderRadius: 4,
      }}>
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontSize: 9, color: 'rgba(200,170,110,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
            {myChampion}{myPosition ? ` · ${myPosition}` : ''} · Lv{level}
          </span>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{currentGold.toLocaleString()}g</span>
        </div>

        <StatRow
          label="KDA"
          value={`${scores.kills} / ${scores.deaths} / ${scores.assists}`}
          sub={<span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{killParticipation}% KP</span>}
        />
        <Divider />
        <StatRow
          label="CS"
          value={`${scores.creepScore}`}
          sub={
            <div className="flex items-baseline gap-1">
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{csPerMin.toFixed(1)}/min</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: diffCol(csDiff) }}>
                {csDiff >= 0 ? '+' : ''}{csDiff} pace
              </span>
            </div>
          }
        />
      </div>

      {/* Enemy laner */}
      {enemyLaner && (
        <div className="mx-3 mt-1.5 px-2.5 py-2" style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 4,
        }}>
          <div className="flex items-center justify-between mb-1.5">
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              vs {enemyLaner.championName} · Lv{enemyLaner.level}
            </span>
            {enemyLaner.isDead && (
              <span style={{ fontSize: 9, color: '#f87171' }}>☠ {Math.ceil(enemyLaner.respawnTimer)}s</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
              {enemyLaner.scores.kills}/{enemyLaner.scores.deaths}/{enemyLaner.scores.assists}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
              {enemyLaner.scores.creepScore} CS
            </span>
            {(() => {
              const diff = scores.creepScore - enemyLaner.scores.creepScore
              return (
                <span style={{ fontSize: 10, fontWeight: 600, color: diffCol(diff) }}>
                  {signed(diff)} CS
                </span>
              )
            })()}
          </div>
        </div>
      )}

      {/* Objectives */}
      <div className="mx-3 mt-1.5 mb-2 px-2.5 py-2 flex gap-4" style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 4,
      }}>
        <div className="flex-1">
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>
            Dragon {objectives.dragonCount.order > 0 || objectives.dragonCount.chaos > 0
              ? `(${objectives.dragonCount.order}/${objectives.dragonCount.chaos})`
              : ''}
          </div>
          <div style={{ fontSize: 11, color: objectives.nextDragon === 0 ? '#4ade80' : 'rgba(255,255,255,0.6)', fontWeight: objectives.nextDragon === 0 ? 700 : 400 }}>
            {objectives.nextDragon === 0 ? 'UP NOW' : fmtTime(objectives.nextDragon)}
          </div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.05)' }} />
        <div className="flex-1">
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>
            Baron
          </div>
          <div style={{ fontSize: 11, color: objectives.nextBaron === 0 ? '#4ade80' : 'rgba(255,255,255,0.6)', fontWeight: objectives.nextBaron === 0 ? 700 : 400 }}>
            {objectives.nextBaron < 0
              ? <span style={{ color: 'rgba(255,255,255,0.2)' }}>20:00</span>
              : objectives.nextBaron === 0 ? 'UP NOW' : fmtTime(objectives.nextBaron)}
          </div>
        </div>
      </div>

    </div>
  )
}
