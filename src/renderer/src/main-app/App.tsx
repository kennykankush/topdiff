import { useState, useEffect } from 'react'
import ChampionInput from './components/ChampionInput'
import { useChampionNames } from './hooks/useChampionNames'

const ROLES = ['Top', 'JG', 'Mid', 'Bot', 'Sup']
const ROLE_FULL = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']

type Provider = 'claude' | 'openai' | 'openrouter'

declare global {
  interface Window {
    api: {
      detectPicks: () => Promise<{ ok: boolean; picks: { champion: string; role: string }[]; myChampion?: string | null; scene?: string; note?: string; pendingRoles?: string[]; error?: string }>
      analyse: (payload: { myChampion: string; myRole: string; side: 'Blue' | 'Red'; enemyTeam: string[] }) => Promise<{ ok: boolean; error?: string }>
      showOverlay: () => void
      getUsage: () => Promise<{ inputTokens: number; outputTokens: number; costUsd: number; calls: number }>
      getProviderConfig: () => Promise<{ activeProvider: Provider; keys: { openai: boolean; claude: boolean; openrouter: boolean }; models: { openai?: string; claude?: string; openrouterText?: string; openrouterVision?: string } }>
      setProviderConfig: (payload: { provider: Provider; apiKey?: string; model?: string; visionModel?: string }) => Promise<{ ok: boolean; provider?: Provider; error?: string }>
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

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: 'OpenAI',
  claude: 'Claude',
  openrouter: 'OpenRouter',
}

const PROVIDER_HINT: Record<Provider, string> = {
  openai: 'sk-...',
  claude: 'sk-ant-...',
  openrouter: 'sk-or-...',
}

const CLAUDE_MODELS = [
  { value: 'claude-sonnet-4-6',         label: 'Sonnet 4.6', tag: 'recommended', input: 3.00,  output: 15.00 },
  { value: 'claude-opus-4-6',           label: 'Opus 4.6',   tag: 'most capable', input: 15.00, output: 75.00 },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5',  tag: 'fastest',      input: 0.80,  output: 4.00  },
]

const OPENAI_MODELS = [
  { value: 'gpt-4.1',     label: 'GPT-4.1',      tag: 'recommended', input: 2.00,  output: 8.00  },
  { value: 'gpt-4o',      label: 'GPT-4o',        tag: '',            input: 2.50,  output: 10.00 },
  { value: 'gpt-4o-mini', label: 'GPT-4o mini',   tag: 'fastest',     input: 0.15,  output: 0.60  },
]

function SettingsModal({ onClose, activeProvider }: { onClose: () => void; activeProvider: Provider }) {
  const [loading, setLoading] = useState(true)
  const [provider, setProvider] = useState<Provider>(activeProvider)
  const [keys, setKeys] = useState<{ openai: boolean; claude: boolean; openrouter: boolean }>({ openai: false, claude: false, openrouter: false })
  const [selectedModel, setSelectedModel] = useState<Record<Provider, string>>({ openai: 'gpt-4.1', claude: 'claude-sonnet-4-6', openrouter: '' })
  const [inputKey, setInputKey] = useState('')
  const [inputModel, setInputModel] = useState('')
  const [inputVisionModel, setInputVisionModel] = useState('')
  const [changingKey, setChangingKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    window.api.getProviderConfig().then(cfg => {
      setProvider(cfg.activeProvider)
      setKeys(cfg.keys)
      setSelectedModel({
        openai: cfg.models.openai ?? 'gpt-4.1',
        claude: cfg.models.claude ?? 'claude-sonnet-4-6',
        openrouter: '',
      })
      setInputModel(cfg.models.openrouterText ?? '')
      setInputVisionModel(cfg.models.openrouterVision ?? '')
      setLoading(false)
    })
  }, [])

  function handleProviderChange(p: Provider) {
    setProvider(p)
    setInputKey('')
    setChangingKey(false)
    setError(null)
    setSuccess(false)
  }

  const hasKeyForProvider = keys[provider]

  async function handleSave() {
    if (!hasKeyForProvider && !inputKey.trim()) {
      setError('Enter an API key')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(false)
    const result = await window.api.setProviderConfig({
      provider,
      apiKey: inputKey.trim() || undefined,
      model: provider === 'openrouter' ? inputModel.trim() || undefined : selectedModel[provider] || undefined,
      visionModel: provider === 'openrouter' ? inputVisionModel.trim() || undefined : undefined,
    })
    setSaving(false)
    if (result.ok) {
      setSuccess(true)
      setKeys(prev => ({ ...prev, [provider]: true }))
      setChangingKey(false)
      setInputKey('')
      setTimeout(onClose, 800)
    } else {
      setError(result.error ?? 'Failed to save')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(200,170,110,0.2)',
    borderBottom: '1px solid rgba(200,170,110,0.4)',
    padding: '7px 8px',
    color: '#F0E6D3',
    fontSize: 12,
    outline: 'none',
    letterSpacing: '0.02em',
    fontFamily: 'inherit',
  }

  return (
    <div
      className="no-drag"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(1,10,19,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: 300,
        background: 'rgba(5,15,30,0.98)',
        border: '1px solid rgba(200,170,110,0.25)',
        position: 'relative',
        padding: '20px 18px',
      }}>
        <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />

        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>AI Provider</SectionLabel>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'rgba(200,170,110,0.4)', fontSize: 11, padding: '20px 0' }}>Loading...</div>
        ) : (
          <>
            {/* Provider selector */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              {(['openai', 'claude', 'openrouter'] as Provider[]).map(p => (
                <button
                  key={p}
                  onClick={() => handleProviderChange(p)}
                  style={{
                    flex: 1, padding: '6px 0', fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
                    border: 'none', outline: 'none', position: 'relative',
                    background: provider === p ? 'rgba(200,170,110,0.12)' : 'transparent',
                    color: provider === p ? '#C8AA6E' : 'rgba(240,230,211,0.35)',
                    borderBottom: `1px solid ${provider === p ? '#C8AA6E' : 'rgba(200,170,110,0.1)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  {PROVIDER_LABELS[p]}
                  {keys[p] && (
                    <span style={{
                      position: 'absolute', top: 2, right: 4,
                      width: 4, height: 4, borderRadius: '50%',
                      background: provider === p ? '#C8AA6E' : 'rgba(200,170,110,0.4)',
                    }} />
                  )}
                </button>
              ))}
            </div>

            {/* OpenRouter note */}
            {provider === 'openrouter' && (
              <p style={{ fontSize: 9, color: 'rgba(200,170,110,0.4)', margin: '0 0 12px', letterSpacing: '0.05em', lineHeight: 1.5 }}>
                Free models available · Web search not supported
              </p>
            )}

            {/* Model selector — Claude and OpenAI */}
            {(provider === 'claude' || provider === 'openai') && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(200,170,110,0.5)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Model
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {(provider === 'claude' ? CLAUDE_MODELS : OPENAI_MODELS).map(m => {
                    const active = selectedModel[provider] === m.value
                    return (
                      <button
                        key={m.value}
                        onClick={() => setSelectedModel(prev => ({ ...prev, [provider]: m.value }))}
                        style={{
                          padding: '7px 8px', textAlign: 'left', cursor: 'pointer',
                          background: active ? 'rgba(200,170,110,0.1)' : 'transparent',
                          border: `1px solid ${active ? 'rgba(200,170,110,0.35)' : 'rgba(200,170,110,0.1)'}`,
                          color: active ? '#C8AA6E' : 'rgba(240,230,211,0.45)',
                          transition: 'all 0.12s',
                          display: 'flex', alignItems: 'center', gap: 7,
                        }}
                      >
                        {/* Radio dot */}
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                          background: active ? '#C8AA6E' : 'transparent',
                          border: `1px solid ${active ? '#C8AA6E' : 'rgba(200,170,110,0.3)'}`,
                        }} />

                        {/* Name + tag */}
                        <span style={{ flex: 1 }}>
                          <span style={{ fontSize: 10, letterSpacing: '0.04em' }}>{m.label}</span>
                          {m.tag && (
                            <span style={{
                              marginLeft: 5, fontSize: 8, letterSpacing: '0.08em',
                              color: active ? 'rgba(200,170,110,0.6)' : 'rgba(240,230,211,0.25)',
                            }}>
                              {m.tag}
                            </span>
                          )}
                        </span>

                        {/* Pricing */}
                        <span style={{ fontSize: 8, letterSpacing: '0.04em', textAlign: 'right', flexShrink: 0, color: active ? 'rgba(200,170,110,0.7)' : 'rgba(240,230,211,0.25)', lineHeight: 1.5 }}>
                          <span style={{ display: 'block' }}>${m.input}/M in</span>
                          <span style={{ display: 'block' }}>${m.output}/M out</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* API Key */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(200,170,110,0.5)', textTransform: 'uppercase', marginBottom: 6 }}>
                API Key
              </div>
              {hasKeyForProvider && !changingKey ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: '#0BC4E3', letterSpacing: '0.05em' }}>✓ Key configured</span>
                  <button
                    onClick={() => setChangingKey(true)}
                    style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                      background: 'transparent', border: 'none', color: 'rgba(200,170,110,0.5)', cursor: 'pointer', padding: '2px 0',
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <input
                  type="password"
                  placeholder={PROVIDER_HINT[provider]}
                  value={inputKey}
                  onChange={e => setInputKey(e.target.value)}
                  style={inputStyle}
                  autoFocus
                />
              )}
            </div>

            {/* OpenRouter model overrides */}
            {provider === 'openrouter' && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(200,170,110,0.5)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Text Model <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span>
                </div>
                <input
                  type="text"
                  placeholder="deepseek/deepseek-chat-v3-0324:free"
                  value={inputModel}
                  onChange={e => setInputModel(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 8 }}
                />
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(200,170,110,0.5)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Vision Model <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span>
                </div>
                <input
                  type="text"
                  placeholder="qwen/qwen2.5-vl-72b-instruct:free"
                  value={inputVisionModel}
                  onChange={e => setInputVisionModel(e.target.value)}
                  style={inputStyle}
                />
              </div>
            )}

            {/* Error / Success */}
            {error && <p style={{ fontSize: 10, color: '#E84057', margin: '0 0 10px', textAlign: 'center' }}>{error}</p>}
            {success && <p style={{ fontSize: 10, color: '#0BC4E3', margin: '0 0 10px', textAlign: 'center', letterSpacing: '0.05em' }}>✓ Saved</p>}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1, padding: '8px', fontSize: 9, fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
                  background: 'transparent', border: '1px solid rgba(200,170,110,0.2)',
                  color: 'rgba(200,170,110,0.4)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 2, padding: '8px', fontSize: 9, fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer',
                  background: saving ? 'rgba(200,170,110,0.06)' : 'rgba(200,170,110,0.12)',
                  border: '1px solid rgba(200,170,110,0.3)',
                  color: saving ? 'rgba(200,170,110,0.3)' : '#C8AA6E',
                  transition: 'all 0.15s',
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
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
  const [showSettings, setShowSettings] = useState(false)
  const [activeProvider, setActiveProvider] = useState<Provider>('claude')
  const [usage, setUsage] = useState<{ inputTokens: number; outputTokens: number; costUsd: number; calls: number } | null>(null)
  const { getImageUrl } = useChampionNames()

  useEffect(() => {
    window.api.getProviderConfig().then(cfg => setActiveProvider(cfg.activeProvider))
  }, [])

  async function refreshUsage() {
    const u = await window.api.getUsage()
    if (u.calls > 0) setUsage(u)
  }

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
      refreshUsage()
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
      refreshUsage()
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
      {showSettings && (
        <SettingsModal
          activeProvider={activeProvider}
          onClose={() => {
            setShowSettings(false)
            window.api.getProviderConfig().then(cfg => setActiveProvider(cfg.activeProvider))
          }}
        />
      )}

      {/* Drag region */}
      <div className="drag" style={{ height: 32, flexShrink: 0 }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: `0 20px ${usage ? 8 : 20}px`, gap: 14, overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', paddingBottom: 4, position: 'relative' }}>
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

          {/* Settings button */}
          <button
            className="no-drag"
            onClick={() => setShowSettings(true)}
            title={`Provider: ${PROVIDER_LABELS[activeProvider]}`}
            style={{
              position: 'absolute', right: 0, top: 0,
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '4px 6px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(200,170,110,0.45)" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
            <span style={{ fontSize: 7, letterSpacing: '0.08em', color: 'rgba(200,170,110,0.35)', textTransform: 'uppercase' }}>
              {PROVIDER_LABELS[activeProvider]}
            </span>
          </button>
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

      {/* Usage footer — outside scroll area, always pinned to bottom */}
      {usage && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          borderTop: '1px solid rgba(200,170,110,0.08)',
          padding: '7px 20px 10px',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 8, letterSpacing: '0.1em', color: 'rgba(200,170,110,0.25)', textTransform: 'uppercase' }}>
            Session
          </span>
          <span style={{ width: 1, height: 8, background: 'rgba(200,170,110,0.12)' }} />
          {usage.costUsd > 0 ? (
            <span style={{ fontSize: 9, color: 'rgba(200,170,110,0.5)', letterSpacing: '0.04em' }}>
              ${usage.costUsd < 0.001 ? usage.costUsd.toFixed(6) : usage.costUsd.toFixed(4)}
            </span>
          ) : (
            <span style={{ fontSize: 9, color: 'rgba(200,170,110,0.3)', letterSpacing: '0.04em' }}>free</span>
          )}
          <span style={{ width: 1, height: 8, background: 'rgba(200,170,110,0.12)' }} />
          <span style={{ fontSize: 9, color: 'rgba(200,170,110,0.35)', letterSpacing: '0.04em' }}>
            {((usage.inputTokens + usage.outputTokens) / 1000).toFixed(1)}k tok
          </span>
          <span style={{ width: 1, height: 8, background: 'rgba(200,170,110,0.12)' }} />
          <span style={{ fontSize: 9, color: 'rgba(200,170,110,0.25)', letterSpacing: '0.04em' }}>
            {usage.calls} {usage.calls === 1 ? 'call' : 'calls'}
          </span>
        </div>
      )}
    </div>
  )
}
