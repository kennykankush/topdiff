import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AnalysisResult } from '../../../../shared/types'

type Props = {
  analysis: AnalysisResult | null
  onTogglePanel: () => void
}

function compileTips(data: AnalysisResult): string[] {
  const tips: string[] = []
  const g = data.gameplan

  // Lane focus first — most important
  tips.push(g.early_game)
  tips.push(`Their angle: ${g.enemy_strategy}`)
  g.dont_do.forEach(d => tips.push(`Don't: ${d}`))
  g.team_threats.forEach(t => tips.push(t))
  data.match_insight.tips.forEach(t => tips.push(t))
  g.power_spikes.forEach(s => tips.push(`Spike → ${s}`))
  if (data.team_comp.note) tips.push(data.team_comp.note)
  if (data.runes.note) tips.push(`Runes: ${data.runes.note}`)

  return tips.filter(Boolean)
}

export default function TipsView({ analysis, onTogglePanel }: Props) {
  const tips = analysis
    ? compileTips(analysis)
    : ['Run analysis from the main window to get live tips.']

  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(1)

  // Reset to first tip when new analysis comes in
  useEffect(() => { setIndex(0) }, [analysis])

  // Auto-rotate every 15s
  useEffect(() => {
    const id = setInterval(() => {
      setDir(1)
      setIndex(i => (i + 1) % tips.length)
    }, 15000)
    return () => clearInterval(id)
  }, [tips.length])

  const go = (d: 1 | -1) => {
    setDir(d)
    setIndex(i => (i + d + tips.length) % tips.length)
  }

  return (
    <div className="w-full flex flex-col justify-between" style={{ background: 'transparent', minHeight: 120 }}>
      {/* Tip text */}
      <div className="flex-1 flex items-start pt-4 px-3">
        <div className="relative w-full" style={{ minHeight: 72 }}>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.p
              key={index}
              custom={dir}
              initial={{ opacity: 0, y: dir * 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: dir * -10 }}
              transition={{ duration: 0.35 }}
              className="text-white text-[13px] font-semibold leading-relaxed"
              style={{
                textShadow: [
                  '0 0 6px rgba(0,0,0,1)',
                  '0 0 14px rgba(0,0,0,1)',
                  '0 1px 3px rgba(0,0,0,1)',
                  '0 2px 8px rgba(0,0,0,0.9)',
                ].join(', ')
              }}
            >
              {tips[index]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom bar — dots + back button */}
      <div className="no-drag flex items-center justify-between px-3 pb-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => go(-1)}
            className="text-white/40 hover:text-white/80 text-[12px] transition-colors leading-none"
            style={{ textShadow: '0 0 6px rgba(0,0,0,1)' }}
          >‹</button>

          <div className="flex gap-1">
            {tips.map((_, i) => (
              <button
                key={i}
                onClick={() => { setDir(i > index ? 1 : -1); setIndex(i) }}
                className="rounded-full transition-all"
                style={{
                  width: i === index ? 14 : 5,
                  height: 5,
                  background: i === index ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.22)',
                  boxShadow: '0 0 4px rgba(0,0,0,0.8)'
                }}
              />
            ))}
          </div>

          <button
            onClick={() => go(1)}
            className="text-white/40 hover:text-white/80 text-[12px] transition-colors leading-none"
            style={{ textShadow: '0 0 6px rgba(0,0,0,1)' }}
          >›</button>
        </div>

        <button
          onClick={onTogglePanel}
          className="text-white/35 hover:text-white/70 text-[9px] uppercase tracking-widest transition-colors"
          style={{ textShadow: '0 0 6px rgba(0,0,0,1)' }}
        >
          panel
        </button>
      </div>
    </div>
  )
}
