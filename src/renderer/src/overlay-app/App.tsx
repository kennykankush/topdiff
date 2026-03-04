import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AnalysisResult } from '../../../shared/types'
import SpellTimers from './components/SpellTimers'
import ItemBuildPath from './components/ItemBuildPath'
import MatchInsight from './components/MatchInsight'
import TeamComp from './components/TeamComp'
import RuneSuggestion from './components/RuneSuggestion'
import LaneKitCooldowns from './components/LaneKitCooldowns'
import Gameplan from './components/Gameplan'
import TipsView from './components/TipsView'
import JGPath from './components/JGPath'

declare global {
  interface Window {
    overlayApi: {
      onLoading: (cb: () => void) => void
      onResult: (cb: (result: AnalysisResult) => void) => void
      onError: (cb: (msg: string) => void) => void
      close: () => void
      resize: (height: number) => void
    }
  }
}

type AnalysisState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'result'; data: AnalysisResult }
  | { phase: 'error'; message: string }

type ViewMode = 'panel' | 'tips'
type TabId = 'jg' | 'plan' | 'runes' | 'build' | 'comp' | 'kit'

const TABS: { id: TabId; label: string }[] = [
  { id: 'jg',    label: 'JG'    },
  { id: 'plan',  label: 'Plan'  },
  { id: 'runes', label: 'Runes' },
  { id: 'build', label: 'Build' },
  { id: 'comp',  label: 'Comp'  },
  { id: 'kit',   label: 'Kit'   },
]


export default function App() {
  const [visible, setVisible] = useState(true)
  const [analysis, setAnalysis] = useState<AnalysisState>({ phase: 'idle' })
  const [viewMode, setViewMode] = useState<ViewMode>('panel')
  const [visibleTabs, setVisibleTabs] = useState<TabId[]>(['jg'])
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.overlayApi.onLoading(() => {
      setVisible(true)
      setViewMode('panel')
      setVisibleTabs(['jg'])
      setAnalysis({ phase: 'loading' })
    })
    window.overlayApi.onResult(data => {
      setAnalysis({ phase: 'result', data })
      setVisibleTabs(['jg'])
      setViewMode('panel')
    })
    window.overlayApi.onError(message => setAnalysis({ phase: 'error', message }))
  }, [])

  // Resize window to fit content — observe the always-mounted wrapper so
  // switching between tips/panel never detaches the observer.
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      window.overlayApi.resize(el.offsetHeight + 12)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const analysisData = analysis.phase === 'result' ? analysis.data : null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full"
          style={{ background: 'transparent' }}
        >
          <div ref={wrapperRef}>

          {/* ── TIPS MODE ── */}
          {viewMode === 'tips' && (
            <TipsView analysis={analysisData} onTogglePanel={() => setViewMode('panel')} />
          )}

          {/* ── PANEL MODE ── */}
          {viewMode === 'panel' && (
            <div
              className="flex flex-col"
              style={{
                background: 'rgba(8, 10, 18, 0.92)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
                margin: 6,
                boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
                overflow: 'hidden',
                maxHeight: 880
              }}
            >
              {/* Header */}
              <div className="drag flex items-center justify-between px-3 py-1.5 border-b border-white/5 flex-shrink-0">
                <span className="text-lol-gold/70 text-[11px] font-bold uppercase tracking-widest">TopDiff</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setViewMode('tips')}
                    className="no-drag px-1.5 py-0.5 rounded text-white/30 hover:text-white/65 text-[9px] uppercase tracking-wider transition-colors"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    tips
                  </button>
                  <button
                    onClick={() => { setVisible(false); window.overlayApi.close() }}
                    className="no-drag w-4 h-4 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors"
                  >
                    <span className="text-white/40" style={{ fontSize: 8, lineHeight: 1 }}>✕</span>
                  </button>
                </div>
              </div>

              {/* Spell timers — always visible */}
              <div className="flex-shrink-0 border-b border-white/5">
                <SpellTimers />
              </div>

              {/* Non-result states */}
              {analysis.phase === 'idle' && (
                <p className="text-white/20 text-[11px] text-center py-6 px-3">
                  Run analysis from the main window
                </p>
              )}
              {analysis.phase === 'loading' && (
                <div className="flex flex-col items-center gap-2 py-8">
                  <div className="w-5 h-5 border border-lol-gold/30 border-t-lol-gold rounded-full animate-spin" />
                  <p className="text-white/30 text-[11px]">Analysing...</p>
                </div>
              )}
              {analysis.phase === 'error' && (
                <div className="px-3 py-4 text-center">
                  <p className="text-red-400/80 text-[11px]">{analysis.message}</p>
                </div>
              )}

              {/* ── Tab bar + content (results only) ── */}
              {analysis.phase === 'result' && (
                <>
                  {/* Tab bar */}
                  <div className="no-drag flex flex-shrink-0 border-b border-white/5">
                    {TABS.map(tab => {
                      const active = visibleTabs.includes(tab.id)
                      const stacked = active && visibleTabs.length > 1
                      return (
                        <button
                          key={tab.id}
                          onClick={(e) => {
                            if (e.shiftKey) {
                              // Shift+click: append to stack, or remove if already stacked
                              setVisibleTabs(prev => {
                                if (prev.includes(tab.id)) {
                                  // Remove it — but keep at least 1
                                  return prev.length > 1 ? prev.filter(id => id !== tab.id) : prev
                                }
                                // Append in click order
                                return [...prev, tab.id]
                              })
                            } else {
                              // Normal click: show only this tab
                              setVisibleTabs([tab.id])
                            }
                          }}
                          className="flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors relative"
                          style={{ color: active ? '#c8aa6e' : 'rgba(255,255,255,0.25)' }}
                        >
                          {tab.label}
                          {active && (
                            <motion.div
                              layoutId={stacked ? undefined : 'tab-indicator'}
                              className="absolute bottom-0 left-0 right-0 h-px"
                              style={{ background: stacked ? 'rgba(200,170,110,0.5)' : '#c8aa6e' }}
                            />
                          )}
                          {/* Stack dot — shows when this tab is part of a multi-stack */}
                          {stacked && (
                            <span
                              className="absolute top-0.5 right-1 w-1 h-1 rounded-full"
                              style={{ background: '#c8aa6e' }}
                            />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Tab content — renders in click order */}
                  <div className="overflow-y-auto no-drag" style={{ scrollbarWidth: 'none', maxHeight: 760 }}>
                    <AnimatePresence>
                      {visibleTabs.map((tabId, index) => (
                        <motion.div
                          key={tabId}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          style={{ overflow: 'hidden' }}
                        >
                          {index > 0 && <div className="border-t border-white/5" />}
                          <div className="px-3 py-3">
                            {tabId === 'jg'    && <JGPath jgPath={analysis.data.jg_path} />}
                            {tabId === 'plan'  && <Gameplan gameplan={analysis.data.gameplan} />}
                            {tabId === 'runes' && <RuneSuggestion runes={analysis.data.runes} />}
                            {tabId === 'build' && <ItemBuildPath items={analysis.data.item_path} earlyBuys={analysis.data.early_buys} startingItems={analysis.data.starting_items} />}
                            {tabId === 'comp'  && (
                              <div className="flex flex-col gap-5">
                                <TeamComp teamComp={analysis.data.team_comp} />
                                <MatchInsight insight={analysis.data.match_insight} />
                              </div>
                            )}
                            {tabId === 'kit'   && <LaneKitCooldowns enemyLaner={analysis.data.enemy_laner} />}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </div>
          )}

          </div>{/* end wrapperRef */}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
