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

const PROVIDER_LABELS: Record<Provider, string> = { openai: 'OpenAI', claude: 'Claude', openrouter: 'OpenRouter' }
const PROVIDER_HINT: Record<Provider, string> = { openai: 'sk-...', claude: 'sk-ant-...', openrouter: 'sk-or-...' }

const CLAUDE_MODELS = [
  { value: 'claude-sonnet-4-6',         label: 'Sonnet 4.6',  tag: 'recommended',  input: 3.00,  output: 15.00 },
  { value: 'claude-opus-4-6',           label: 'Opus 4.6',    tag: 'most capable', input: 15.00, output: 75.00 },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5',   tag: 'fastest',      input: 0.80,  output: 4.00  },
]

const OPENAI_MODELS = [
  { value: 'gpt-4.1',     label: 'GPT-4.1',    tag: 'recommended', input: 2.00, output: 8.00  },
  { value: 'gpt-4o',      label: 'GPT-4o',      tag: '',            input: 2.50, output: 10.00 },
  { value: 'gpt-4o-mini', label: 'GPT-4o mini', tag: 'fastest',     input: 0.15, output: 0.60  },
]

const divider = { borderBottom: '1px solid rgba(255,255,255,0.05)' } as const

const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
  color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase',
}

const inputBase: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderBottom: '1px solid rgba(200,170,110,0.3)',
  padding: '8px 10px', color: '#F0E6D3', fontSize: 12,
  outline: 'none', letterSpacing: '0.02em', fontFamily: 'inherit',
}

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
      setProvider(cfg.activeProvider); setKeys(cfg.keys)
      setSelectedModel({ openai: cfg.models.openai ?? 'gpt-4.1', claude: cfg.models.claude ?? 'claude-sonnet-4-6', openrouter: '' })
      setInputModel(cfg.models.openrouterText ?? ''); setInputVisionModel(cfg.models.openrouterVision ?? '')
      setLoading(false)
    })
  }, [])

  function handleProviderChange(p: Provider) {
    setProvider(p); setInputKey(''); setChangingKey(false); setError(null); setSuccess(false)
  }

  async function handleSave() {
    if (!keys[provider] && !inputKey.trim()) { setError('Enter an API key'); return }
    setSaving(true); setError(null); setSuccess(false)
    const result = await window.api.setProviderConfig({
      provider, apiKey: inputKey.trim() || undefined,
      model: provider === 'openrouter' ? inputModel.trim() || undefined : selectedModel[provider] || undefined,
      visionModel: provider === 'openrouter' ? inputVisionModel.trim() || undefined : undefined,
    })
    setSaving(false)
    if (result.ok) {
      setSuccess(true); setKeys(prev => ({ ...prev, [provider]: true })); setChangingKey(false); setInputKey('')
      setTimeout(onClose, 800)
    } else { setError(result.error ?? 'Failed to save') }
  }

  return (
    <div className="no-drag" style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(1,10,19,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: 320, background: 'rgba(8,10,18,0.99)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.85)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', ...divider }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(200,170,110,0.7)', textTransform: 'uppercase' }}>AI Provider</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 14, lineHeight: 1, padding: '2px 4px' }}>✕</button>
        </div>
        <div style={{ padding: '16px' }}>
          {loading ? <div style={{ textAlign: 'center', color: 'rgba(200,170,110,0.4)', fontSize: 11, padding: '24px 0' }}>Loading...</div> : (
            <>
              <div style={{ display: 'flex', gap: 3, marginBottom: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 7, padding: 3 }}>
                {(['openai', 'claude', 'openrouter'] as Provider[]).map(p => (
                  <button key={p} onClick={() => handleProviderChange(p)} style={{
                    flex: 1, padding: '6px 0', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                    cursor: 'pointer', border: 'none', outline: 'none', borderRadius: 5, position: 'relative',
                    background: provider === p ? 'rgba(200,170,110,0.12)' : 'transparent',
                    color: provider === p ? '#C8AA6E' : 'rgba(255,255,255,0.3)', transition: 'all 0.15s',
                  }}>
                    {PROVIDER_LABELS[p]}
                    {keys[p] && <span style={{ position: 'absolute', top: 3, right: 5, width: 3, height: 3, borderRadius: '50%', background: provider === p ? '#C8AA6E' : 'rgba(200,170,110,0.4)' }} />}
                  </button>
                ))}
              </div>
              {provider === 'openrouter' && <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', margin: '0 0 14px', letterSpacing: '0.05em', lineHeight: 1.6 }}>Free models available · Web search not supported</p>}
              {(provider === 'claude' || provider === 'openai') && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ ...labelStyle, marginBottom: 8 }}>Model</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(provider === 'claude' ? CLAUDE_MODELS : OPENAI_MODELS).map(m => {
                      const active = selectedModel[provider] === m.value
                      return (
                        <button key={m.value} onClick={() => setSelectedModel(prev => ({ ...prev, [provider]: m.value }))} style={{
                          padding: '8px 10px', textAlign: 'left', cursor: 'pointer', borderRadius: 7,
                          background: active ? 'rgba(200,170,110,0.08)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${active ? 'rgba(200,170,110,0.3)' : 'rgba(255,255,255,0.06)'}`,
                          color: active ? '#C8AA6E' : 'rgba(255,255,255,0.35)', transition: 'all 0.12s',
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: active ? '#C8AA6E' : 'transparent', border: `1px solid ${active ? '#C8AA6E' : 'rgba(255,255,255,0.2)'}` }} />
                          <span style={{ flex: 1 }}>
                            <span style={{ fontSize: 11, letterSpacing: '0.04em' }}>{m.label}</span>
                            {m.tag && <span style={{ marginLeft: 6, fontSize: 9, letterSpacing: '0.08em', color: active ? 'rgba(200,170,110,0.55)' : 'rgba(255,255,255,0.2)' }}>{m.tag}</span>}
                          </span>
                          <span style={{ fontSize: 9, letterSpacing: '0.04em', textAlign: 'right', flexShrink: 0, color: active ? 'rgba(200,170,110,0.6)' : 'rgba(255,255,255,0.18)', lineHeight: 1.6 }}>
                            <span style={{ display: 'block' }}>${m.input}/M in</span>
                            <span style={{ display: 'block' }}>${m.output}/M out</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <div style={{ ...labelStyle, marginBottom: 8 }}>API Key</div>
                {keys[provider] && !changingKey ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: '#4ade80', letterSpacing: '0.05em' }}>✓ Key configured</span>
                    <button onClick={() => setChangingKey(true)} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>Change</button>
                  </div>
                ) : (
                  <input type="password" placeholder={PROVIDER_HINT[provider]} value={inputKey} onChange={e => setInputKey(e.target.value)} style={{ ...inputBase, borderRadius: 5 }} autoFocus />
                )}
              </div>
              {provider === 'openrouter' && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ ...labelStyle, marginBottom: 8 }}>Text Model <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span></div>
                  <input type="text" placeholder="deepseek/deepseek-chat-v3-0324:free" value={inputModel} onChange={e => setInputModel(e.target.value)} style={{ ...inputBase, borderRadius: 5, marginBottom: 10 }} />
                  <div style={{ ...labelStyle, marginBottom: 8 }}>Vision Model <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span></div>
                  <input type="text" placeholder="qwen/qwen2.5-vl-72b-instruct:free" value={inputVisionModel} onChange={e => setInputVisionModel(e.target.value)} style={{ ...inputBase, borderRadius: 5 }} />
                </div>
              )}
              {error && <p style={{ fontSize: 10, color: '#E84057', margin: '0 0 12px', textAlign: 'center' }}>{error}</p>}
              {success && <p style={{ fontSize: 10, color: '#4ade80', margin: '0 0 12px', textAlign: 'center', letterSpacing: '0.05em' }}>✓ Saved</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} style={{ flex: 1, padding: '9px', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)', borderRadius: 7 }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '9px', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', background: saving ? 'rgba(200,170,110,0.06)' : 'rgba(200,170,110,0.12)', border: '1px solid rgba(200,170,110,0.3)', color: saving ? 'rgba(200,170,110,0.3)' : '#C8AA6E', borderRadius: 7, transition: 'all 0.15s' }}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [champion, setChampion] = useState('')
  const [championConfirmed, setChampionConfirmed] = useState(false)
  const [role, setRole] = useState('Mid')
  const [side, setSide] = useState<'Blue' | 'Red'>('Blue')
  const [enemies, setEnemies] = useState<string[]>(['', '', '', '', ''])
  const [enemiesConfirmed, setEnemiesConfirmed] = useState<boolean[]>([false, false, false, false, false])
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
    setEnemiesConfirmed(prev => prev.map((c, i) => i === index ? false : c))
  }

  function confirmEnemy(index: number, value: string) {
    setEnemies(prev => prev.map((e, i) => i === index ? value : e))
    setEnemiesConfirmed(prev => prev.map((c, i) => i === index ? true : c))
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
        setError(result.note ?? 'No picks locked in yet.')
      } else {
        const roleOrder = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']
        const filled = ['', '', '', '', '']
        for (const pick of result.picks) {
          const idx = roleOrder.findIndex(r => r.toLowerCase() === pick.role.toLowerCase())
          if (idx !== -1) filled[idx] = pick.champion
        }
        setEnemies(filled)
        setEnemiesConfirmed(filled.map(f => !!f))
        if (result.myChampion) { setChampion(result.myChampion); setChampionConfirmed(true) }
        const pending = result.pendingRoles?.length ? ` — waiting on: ${result.pendingRoles.join(', ')}` : ''
        const myStr = result.myChampion ? ` · You: ${result.myChampion}` : ''
        setStatus(`${result.picks.length} champion${result.picks.length > 1 ? 's' : ''} detected${myStr}${pending}`)
      }
    } catch {
      setError('Screenshot failed — check Screen Recording permission.')
    } finally {
      setScreenshotting(false); refreshUsage()
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
        enemyTeam: filledEnemies,
      })
      if (result.ok) setStatus('Analysis sent to overlay')
      else setError(result.error ?? 'Something went wrong.')
    } catch {
      setError('Failed to connect to the app backend.')
    } finally {
      setAnalysing(false); refreshUsage()
    }
  }

  const champImg = championConfirmed ? getImageUrl(champion) : null

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080C14',
      display: 'flex', flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
      color: '#F0E6D3',
    }}>
      {showSettings && (
        <SettingsModal activeProvider={activeProvider} onClose={() => {
          setShowSettings(false)
          window.api.getProviderConfig().then(cfg => setActiveProvider(cfg.activeProvider))
        }} />
      )}

      {/* Drag region */}
      <div className="drag" style={{ height: 28, flexShrink: 0 }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 18px 18px', gap: 12 }}>

        {/* ── Logo header ── */}
        <div style={{ position: 'relative', textAlign: 'center', padding: '6px 0 18px' }}>

          {/* Settings button — top right */}
          <button
            className="no-drag"
            onClick={() => setShowSettings(true)}
            title={`Provider: ${PROVIDER_LABELS[activeProvider]}`}
            style={{
              position: 'absolute', top: 4, right: 0,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 6, cursor: 'pointer', padding: '5px 8px',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.15s',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
            <span style={{ fontSize: 9, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase' }}>{PROVIDER_LABELS[activeProvider]}</span>
          </button>

          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(200,170,110,0.25))' }} />
            <h1 style={{
              margin: 0, fontSize: 30, fontWeight: 900, letterSpacing: '0.32em',
              color: '#C8AA6E', textTransform: 'uppercase',
            }}>
              TOPDIFF
            </h1>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, rgba(200,170,110,0.25))' }} />
          </div>

          {/* Subtitle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ width: 4, height: 4, background: 'rgba(200,170,110,0.28)', transform: 'rotate(45deg)', display: 'inline-block' }} />
            <span style={{ fontSize: 9, letterSpacing: '0.28em', color: 'rgba(200,170,110,0.32)', textTransform: 'uppercase' }}>
              Pre-Game Analysis
            </span>
            <span style={{ width: 4, height: 4, background: 'rgba(200,170,110,0.28)', transform: 'rotate(45deg)', display: 'inline-block' }} />
          </div>
        </div>

        {/* ── Main glass panel ── */}
        <div style={{
          background: 'rgba(8, 10, 18, 0.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
          boxShadow: '0 4px 32px rgba(0,0,0,0.7)',
          overflow: 'visible',
        }}>

          {/* ── Your Pick ── */}
          <div style={{ padding: '18px 18px 16px', ...divider }}>

            {/* Section label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
              <div style={{ width: 2, height: 11, background: 'rgba(200,170,110,0.55)', borderRadius: 1 }} />
              <span style={{ ...labelStyle }}>Your Pick</span>
            </div>

            {/* Portrait + input row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>

              {/* Portrait */}
              <div style={{
                width: 68, height: 68, flexShrink: 0,
                border: `1px solid ${championConfirmed ? 'rgba(200,170,110,0.35)' : 'rgba(255,255,255,0.08)'}`,
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 10, overflow: 'hidden',
                transition: 'border-color 0.2s',
                boxShadow: championConfirmed ? '0 0 16px rgba(200,170,110,0.1)' : 'none',
              }}>
                {champImg
                  ? <img src={champImg} alt={champion} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.08)' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="8" r="4" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5"/>
                        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                }
              </div>

              {/* Right column: name input + role/side */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 2 }}>

                {/* Champion name input */}
                <ChampionInput
                  value={champion}
                  onChange={v => { setChampion(v); setChampionConfirmed(false) }}
                  onConfirm={v => { setChampion(v); setChampionConfirmed(true) }}
                  placeholder="Champion name..."
                  className="no-drag"
                  style={{
                    width: '100%', background: 'transparent', border: 'none',
                    borderBottom: `1px solid ${championConfirmed ? 'rgba(200,170,110,0.4)' : 'rgba(255,255,255,0.12)'}`,
                    padding: '5px 2px', color: '#F0E6D3', fontSize: 15,
                    fontWeight: 600, outline: 'none', letterSpacing: '0.02em',
                    transition: 'border-color 0.2s',
                  }}
                />

                {/* Role + Side row */}
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {/* Role pills */}
                  <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                    {ROLES.map(r => (
                      <button key={r} className="no-drag" onClick={() => setRole(r)} style={{
                        flex: 1, padding: '5px 0', fontSize: 9, fontWeight: 700,
                        letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
                        border: `1px solid ${role === r ? 'rgba(200,170,110,0.35)' : 'rgba(255,255,255,0.06)'}`,
                        outline: 'none', borderRadius: 5,
                        background: role === r ? 'rgba(200,170,110,0.12)' : 'rgba(255,255,255,0.02)',
                        color: role === r ? '#C8AA6E' : 'rgba(255,255,255,0.25)',
                        transition: 'all 0.15s',
                      }}>{r}</button>
                    ))}
                  </div>

                  {/* Divider */}
                  <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

                  {/* Side pills */}
                  {(['Blue', 'Red'] as const).map(s => (
                    <button key={s} className="no-drag" onClick={() => setSide(s)} style={{
                      padding: '5px 10px', fontSize: 9, fontWeight: 700,
                      letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
                      border: `1px solid ${side === s
                        ? s === 'Blue' ? 'rgba(11,196,227,0.4)' : 'rgba(232,64,87,0.4)'
                        : 'rgba(255,255,255,0.06)'}`,
                      outline: 'none', borderRadius: 5,
                      background: side === s
                        ? s === 'Blue' ? 'rgba(11,196,227,0.12)' : 'rgba(232,64,87,0.12)'
                        : 'rgba(255,255,255,0.02)',
                      color: side === s
                        ? s === 'Blue' ? '#0BC4E3' : '#E84057'
                        : 'rgba(255,255,255,0.25)',
                      transition: 'all 0.15s',
                    }}>{s}</button>
                  ))}
                </div>

              </div>
            </div>
          </div>

          {/* ── Enemy Draft ── */}
          <div style={{ padding: '18px 18px 20px' }}>

            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 2, height: 11, background: 'rgba(200,170,110,0.55)', borderRadius: 1 }} />
                <span style={{ ...labelStyle }}>Enemy Draft</span>
              </div>
              <button
                className="no-drag"
                onClick={handleScreenshot}
                disabled={screenshotting}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', fontSize: 9, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 6,
                  color: screenshotting ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.45)',
                  cursor: screenshotting ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="6" width="20" height="14" rx="2"/>
                  <circle cx="12" cy="13" r="3"/>
                  <path d="M8 6l2-3h4l2 3"/>
                </svg>
                {screenshotting ? 'Scanning...' : 'Auto-detect'}
              </button>
            </div>

            {/* 5-column enemy grid */}
            <div style={{ display: 'flex', gap: 8 }}>
              {ROLE_FULL.map((label, i) => {
                const confirmed = enemiesConfirmed[i]
                const img = confirmed ? getImageUrl(enemies[i]) : null
                const filled = !!enemies[i].trim()
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>

                    {/* Portrait */}
                    <div style={{
                      width: '100%', aspectRatio: '1',
                      borderRadius: 9, overflow: 'hidden',
                      border: `1px solid ${confirmed ? 'rgba(200,170,110,0.35)' : 'rgba(255,255,255,0.07)'}`,
                      background: 'rgba(255,255,255,0.025)',
                      transition: 'border-color 0.2s',
                      boxShadow: confirmed ? '0 0 10px rgba(200,170,110,0.08)' : 'none',
                    }}>
                      {img
                        ? <img src={img} alt={enemies[i]} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.1)' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="8" r="4" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5"/>
                              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </div>
                      }
                    </div>

                    {/* Role label */}
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: confirmed ? 'rgba(200,170,110,0.65)' : 'rgba(255,255,255,0.2)',
                      transition: 'color 0.2s',
                    }}>
                      {ROLES[i]}
                    </span>

                    {/* Name input */}
                    <ChampionInput
                      value={enemies[i]}
                      onChange={v => setEnemy(i, v)}
                      onConfirm={v => confirmEnemy(i, v)}
                      placeholder={label}
                      className="no-drag"
                      style={{
                        width: '100%', background: 'transparent', border: 'none',
                        borderBottom: `1px solid ${filled ? 'rgba(200,170,110,0.32)' : 'rgba(255,255,255,0.08)'}`,
                        padding: '4px 0', fontSize: 10, fontWeight: confirmed ? 600 : 400,
                        color: confirmed ? '#C8AA6E' : filled ? '#F0E6D3' : 'rgba(255,255,255,0.28)',
                        outline: 'none', textAlign: 'center', letterSpacing: '0.02em',
                        transition: 'all 0.2s',
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>

        </div>

        {/* ── Status / Error ── */}
        {(status || error) && (
          <div style={{ textAlign: 'center', padding: '2px 0' }}>
            {status && !error && <p style={{ margin: 0, fontSize: 10, color: '#4ade80', letterSpacing: '0.04em' }}>✓ {status}</p>}
            {error && <p style={{ margin: 0, fontSize: 10, color: '#E84057' }}>{error}</p>}
          </div>
        )}

        {/* ── Actions ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <button
            className="no-drag"
            onClick={handleAnalyse}
            disabled={analysing}
            style={{
              width: '100%', padding: '14px', fontSize: 11, fontWeight: 800,
              letterSpacing: '0.22em', textTransform: 'uppercase',
              cursor: analysing ? 'not-allowed' : 'pointer',
              border: 'none', outline: 'none', borderRadius: 8,
              background: analysing ? 'rgba(200,170,110,0.08)' : '#C8AA6E',
              color: analysing ? 'rgba(200,170,110,0.4)' : '#010A13',
              boxShadow: analysing ? 'none' : '0 0 24px rgba(200,170,110,0.22)',
              transition: 'all 0.2s',
            }}
          >
            {analysing ? 'Analysing...' : 'Analyse Match'}
          </button>

          <button
            className="no-drag"
            onClick={() => window.api.showOverlay()}
            style={{
              width: '100%', padding: '9px', fontSize: 9, fontWeight: 600,
              letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              color: 'rgba(255,255,255,0.22)', borderRadius: 7, outline: 'none', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(255,255,255,0.22)' }}
          >
            Show Overlay
          </button>
        </div>

        {/* ── Usage footer ── */}
        {usage && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 2 }}>
            <span style={{ fontSize: 8, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.12)', textTransform: 'uppercase' }}>Session</span>
            <span style={{ width: 1, height: 8, background: 'rgba(255,255,255,0.07)' }} />
            {usage.costUsd > 0
              ? <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.04em' }}>${usage.costUsd < 0.001 ? usage.costUsd.toFixed(6) : usage.costUsd.toFixed(4)}</span>
              : <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.16)', letterSpacing: '0.04em' }}>free</span>
            }
            <span style={{ width: 1, height: 8, background: 'rgba(255,255,255,0.07)' }} />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.04em' }}>{((usage.inputTokens + usage.outputTokens) / 1000).toFixed(1)}k tok</span>
            <span style={{ width: 1, height: 8, background: 'rgba(255,255,255,0.07)' }} />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.14)', letterSpacing: '0.04em' }}>{usage.calls} {usage.calls === 1 ? 'call' : 'calls'}</span>
          </div>
        )}

      </div>
    </div>
  )
}
