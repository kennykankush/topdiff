import type { PostGameSummary } from '../../../../shared/types'

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

type Props = { summary: PostGameSummary; onDismiss: () => void }

export default function PostGameView({ summary, onDismiss }: Props) {
  const {
    durationSeconds, myChampion, kills, deaths, assists,
    cs, csPerMin, expectedCS, killParticipation, teamGoldDiff,
  } = summary

  const csDiff   = cs - expectedCS
  const diffCol  = (n: number) => n > 0 ? '#4ade80' : n < 0 ? '#f87171' : 'rgba(255,255,255,0.4)'
  const goldK    = (n: number) => Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(1)}k` : String(Math.abs(n))

  return (
    <div className="mx-3 my-2 px-3 py-3 flex flex-col gap-3" style={{
      background: 'rgba(8,10,18,0.95)',
      border: '1px solid rgba(200,170,110,0.2)',
      borderRadius: 6,
    }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div style={{ fontSize: 9, color: 'rgba(200,170,110,0.5)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 2 }}>
            Game Over · {fmtTime(durationSeconds)}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#c8aa6e' }}>{myChampion}</div>
        </div>
        <button
          onClick={onDismiss}
          className="no-drag"
          style={{
            fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
            background: 'transparent', border: '1px solid rgba(200,170,110,0.2)',
            color: 'rgba(200,170,110,0.4)', padding: '4px 8px', cursor: 'pointer',
          }}
        >
          Dismiss
        </button>
      </div>

      <div style={{ height: 1, background: 'rgba(200,170,110,0.08)' }} />

      {/* KDA + KP */}
      <div className="flex items-center justify-between">
        <div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>KDA</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.04em' }}>
            {kills} / {deaths} / {assists}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Kill Participation</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'rgba(255,255,255,0.9)' }}>{killParticipation}%</div>
        </div>
      </div>

      {/* CS row */}
      <div className="flex items-center justify-between">
        <div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>CS</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
            {cs} <span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>{csPerMin.toFixed(1)}/min</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>vs Pace</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: diffCol(csDiff) }}>
            {csDiff >= 0 ? '+' : ''}{csDiff} CS
          </div>
        </div>
      </div>

      {/* Team gold */}
      <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 3 }}>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
          Final Team Gold
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: diffCol(teamGoldDiff) }}>
          {teamGoldDiff >= 0 ? '+' : '-'}{goldK(teamGoldDiff)}g {teamGoldDiff >= 0 ? 'ahead' : 'behind'}
        </div>
      </div>
    </div>
  )
}
