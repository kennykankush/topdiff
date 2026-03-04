import { useState } from 'react'
import ChampionInput from './components/ChampionInput'
import { useChampionNames } from './hooks/useChampionNames'

const ROLES = ['Top', 'JG', 'Mid', 'Bot', 'Sup']
const ROLE_FULL = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']

declare global {
  interface Window {
    api: {
      detectPicks: () => Promise<{ ok: boolean; picks: { champion: string; role: string }[]; myChampion?: string | null; scene?: string; note?: string; pendingRoles?: string[]; error?: string }>
      analyse: (payload: { myChampion: string; myRole: string; side: 'Blue' | 'Red'; enemyTeam: string[] }) => Promise<{ ok: boolean; error?: string }>
      showOverlay: () => void
    }
  }
}

// Corner bracket decorator
function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const size = 8
  const t = pos.startsWith('t')
  const l = pos.endsWith('l')
  return (
    <span style={{
      position: 'absolute',
      [t ? 'top' : 'bottom']: 0,
      [l ? 'left' : 'right']: 0,
      width: size,
      height: size,
      borderColor: '#C8AA6E',
      borderStyle: 'solid',
      borderWidth: 0,
      [t ? 'borderTopWidth' : 'borderBottomWidth']: 1,
      [l ? 'borderLeftWidth' : 'borderRightWidth']: 1,
      opacity: 0.6,
    }} />
  )
}

function Panel({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={className} style={{ position: 'relative', background: 'rgba(10,20,40,0.6)', border: '1px solid rgba(200,170,110,0.15)', ...style }}>
      <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ width: 2, height: 10, background: '#C8AA6E', opacity: 0.8 }} />
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#C8AA6E', opacity: 0.7, textTransform: 'uppercase' }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(200,170,110,0.2), transparent)' }} />
    </div>
  )
}

export default function App() {
  const [champion, setChampion] = useState('')
  const [role, setRole] = useState('Mid')
  const [side, setSide] = useState<'Blue' | 'Red'>('Blue')
  const [enemies, setEnemies] = useState<string[]>(['', '', '', '', ''])
  const [screenshotting, setScreenshotting] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { getImageUrl } = useChampionNames()

  function setEnemy(index: number, value: string) {
    setEnemies(prev => prev.map((e, i) => i === index ? value : e))
  }

  async function handleScreenshot() {
    setError(null); setStatus(null); setScreenshotting(true)
    try {
      const result = await window.api.detectPicks()
      if (!result.ok) {
        setError(result.error ?? 'Screenshot failed.')
      } else if (result.scene === 'not_champion_select') {
        setError(`Not a champion select screen — ${result.note ?? 'try again during draft pick'}`)
      } else if (result.picks.length === 0) {
        setError(result.note ?? 'No picks locked in yet. Wait for champions to be selected.')
      } else {
        const roleOrder = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']
        const filled = ['', '', '', '', '']
        for (const pick of result.picks) {
          const idx = roleOrder.findIndex(r => r.toLowerCase() === pick.role.toLowerCase())
          if (idx !== -1) filled[idx] = pick.champion
        }
        setEnemies(filled)
        if (result.myChampion) setChampion(result.myChampion)
        const pending = result.pendingRoles?.length
          ? ` — waiting on: ${result.pendingRoles.join(', ')}`
          : ''
        const myStr = result.myChampion ? ` · You: ${result.myChampion}` : ''
        setStatus(`${result.picks.length} enemy champion${result.picks.length > 1 ? 's' : ''} detected${myStr}${pending}`)
      }
    } catch {
      setError('Screenshot failed — check Screen Recording permission.')
    } finally {
      setScreenshotting(false)
    }
  }

  async function handleAnalyse() {
    if (!champion.trim()) { setError('Enter your champion.'); return }
    const filledEnemies = enemies.filter(e => e.trim())
    if (filledEnemies.length === 0) { setError('Add at least one enemy.'); return }
    setError(null); setStatus(null); setAnalysing(true)
    try {
      const result = await window.api.analyse({
        myChampion: champion.trim(),
        myRole: role === 'JG' ? 'Jungle' : role === 'Sup' ? 'Support' : role,
        side,
        enemyTeam: filledEnemies
      })
      if (result.ok) setStatus('Analysis sent to overlay')
      else setError(result.error ?? 'Something went wrong.')
    } catch {
      setError('Failed to connect to the app backend.')
    } finally {
      setAnalysing(false)
    }
  }

  const champImg = getImageUrl(champion)

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #010A13 0%, #0A1428 60%, #010A13 100%)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
      color: '#F0E6D3',
      overflow: 'hidden',
    }}>
      {/* Drag region */}
      <div className="drag" style={{ height: 32, flexShrink: 0 }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 20px 20px', gap: 14, overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', paddingBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 2 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(200,170,110,0.4))' }} />
            <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '0.25em', color: '#C8AA6E', textTransform: 'uppercase', margin: 0, textShadow: '0 0 20px rgba(200,170,110,0.4)' }}>
              TOPDIFF
            </h1>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(200,170,110,0.4), transparent)' }} />
          </div>
          <p style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(200,170,110,0.4)', textTransform: 'uppercase', margin: 0 }}>
            Pre-Game Analysis
          </p>
        </div>

        {/* Your Champion */}
        <Panel style={{ padding: '12px 14px' }}>
          <SectionLabel>Your Champion</SectionLabel>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Portrait */}
            <div style={{
              width: 52, height: 52, flexShrink: 0,
              border: '1px solid rgba(200,170,110,0.3)',
              background: 'rgba(0,0,0,0.4)',
              overflow: 'hidden',
              clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
              position: 'relative',
            }}>
              {champImg
                ? <img src={champImg} alt={champion} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.08)' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="8" r="4" stroke="rgba(200,170,110,0.3)" strokeWidth="1.5"/>
                      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(200,170,110,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
              }
            </div>
            <div style={{ flex: 1 }}>
              <ChampionInput
                value={champion}
                onChange={setChampion}
                placeholder="Search champion..."
                className="no-drag"
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: 'none',
                  borderBottom: '1px solid rgba(200,170,110,0.25)',
                  padding: '7px 4px',
                  color: '#F0E6D3',
                  fontSize: 14,
                  fontWeight: 600,
                  outline: 'none',
                  letterSpacing: '0.02em',
                }}
              />
              {champion && <div style={{ fontSize: 10, color: 'rgba(200,170,110,0.5)', marginTop: 2, letterSpacing: '0.05em' }}>
                {champion.toUpperCase()}
              </div>}
            </div>
          </div>
        </Panel>

        {/* Role + Side */}
        <div style={{ display: 'flex', gap: 10 }}>
          {/* Role */}
          <Panel style={{ flex: 1, padding: '10px 12px' }}>
            <SectionLabel>Role</SectionLabel>
            <div style={{ display: 'flex', gap: 4 }}>
              {ROLES.map(r => (
                <button
                  key={r}
                  className="no-drag"
                  onClick={() => setRole(r)}
                  style={{
                    flex: 1, padding: '5px 0', fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
                    border: 'none', outline: 'none',
                    background: role === r ? 'rgba(200,170,110,0.15)' : 'transparent',
                    color: role === r ? '#C8AA6E' : 'rgba(240,230,211,0.3)',
                    borderBottom: `1px solid ${role === r ? '#C8AA6E' : 'transparent'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </Panel>

          {/* Side */}
          <Panel style={{ padding: '10px 12px', minWidth: 90 }}>
            <SectionLabel>Side</SectionLabel>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['Blue', 'Red'] as const).map(s => (
                <button
                  key={s}
                  className="no-drag"
                  onClick={() => setSide(s)}
                  style={{
                    flex: 1, padding: '5px 0', fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
                    border: 'none', outline: 'none',
                    background: side === s
                      ? s === 'Blue' ? 'rgba(11,196,227,0.12)' : 'rgba(220,60,60,0.12)'
                      : 'transparent',
                    color: side === s
                      ? s === 'Blue' ? '#0BC4E3' : '#E84057'
                      : 'rgba(240,230,211,0.3)',
                    borderBottom: `1px solid ${side === s ? (s === 'Blue' ? '#0BC4E3' : '#E84057') : 'transparent'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </Panel>
        </div>

        {/* Enemy Team */}
        <Panel style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <SectionLabel>Enemy Team</SectionLabel>
            <button
              className="no-drag"
              onClick={handleScreenshot}
              disabled={screenshotting}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', fontSize: 9, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                background: 'transparent',
                border: '1px solid rgba(200,170,110,0.3)',
                color: screenshotting ? 'rgba(200,170,110,0.4)' : '#C8AA6E',
                cursor: screenshotting ? 'not-allowed' : 'pointer',
                clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 11 }}>⬡</span>
              {screenshotting ? 'Scanning...' : 'Scan'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ROLE_FULL.map((label, i) => {
              const img = getImageUrl(enemies[i])
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Role tag */}
                  <div style={{
                    width: 28, flexShrink: 0, fontSize: 8, fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: 'rgba(200,170,110,0.4)', textAlign: 'right',
                  }}>
                    {ROLES[i]}
                  </div>

                  {/* Portrait */}
                  <div style={{
                    width: 30, height: 30, flexShrink: 0,
                    border: `1px solid ${img ? 'rgba(200,170,110,0.3)' : 'rgba(200,170,110,0.1)'}`,
                    background: 'rgba(0,0,0,0.4)',
                    overflow: 'hidden',
                    clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                  }}>
                    {img && <img src={img} alt={enemies[i]} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.1)' }} />}
                  </div>

                  <ChampionInput
                    value={enemies[i]}
                    onChange={v => setEnemy(i, v)}
                    placeholder={`Enemy ${label}`}
                    className="no-drag"
                    style={{
                      flex: 1,
                      background: 'rgba(0,0,0,0.25)',
                      border: 'none',
                      borderBottom: '1px solid rgba(200,170,110,0.15)',
                      padding: '5px 4px',
                      color: '#F0E6D3',
                      fontSize: 12,
                      outline: 'none',
                    }}
                  />
                </div>
              )
            })}
          </div>
        </Panel>

        {/* Status / Error */}
        {status && !error && (
          <p style={{ textAlign: 'center', fontSize: 11, color: '#0BC4E3', letterSpacing: '0.05em', margin: 0 }}>
            ✓ {status}
          </p>
        )}
        {error && (
          <p style={{ textAlign: 'center', fontSize: 11, color: '#E84057', margin: 0 }}>
            {error}
          </p>
        )}

        {/* Analyse button */}
        <button
          className="no-drag"
          onClick={handleAnalyse}
          disabled={analysing}
          style={{
            width: '100%', padding: '13px', fontSize: 11, fontWeight: 900,
            letterSpacing: '0.2em', textTransform: 'uppercase', cursor: analysing ? 'not-allowed' : 'pointer',
            border: 'none', outline: 'none',
            background: analysing
              ? 'rgba(200,170,110,0.1)'
              : 'linear-gradient(135deg, #C8AA6E 0%, #C89B3C 50%, #A57C35 100%)',
            color: analysing ? 'rgba(200,170,110,0.5)' : '#010A13',
            clipPath: 'polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)',
            boxShadow: analysing ? 'none' : '0 0 20px rgba(200,170,110,0.25)',
            transition: 'all 0.2s',
            opacity: analysing ? 0.6 : 1,
          }}
        >
          {analysing ? 'Analysing...' : 'Analyse Match'}
        </button>

        {/* Show overlay */}
        <button
          className="no-drag"
          onClick={() => window.api.showOverlay()}
          style={{
            width: '100%', padding: '7px', fontSize: 9, fontWeight: 700,
            letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer',
            border: '1px solid rgba(200,170,110,0.12)', outline: 'none',
            background: 'transparent',
            color: 'rgba(200,170,110,0.35)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'rgba(200,170,110,0.3)'
            e.currentTarget.style.color = 'rgba(200,170,110,0.6)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(200,170,110,0.12)'
            e.currentTarget.style.color = 'rgba(200,170,110,0.35)'
          }}
        >
          Show Overlay
        </button>

      </div>
    </div>
  )
}
