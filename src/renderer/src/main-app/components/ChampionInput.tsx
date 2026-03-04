import { useState, useRef, useEffect, useCallback } from 'react'
import { useChampionNames } from '../hooks/useChampionNames'

// Fuzzy normalize: strip apostrophes, spaces, dots → lowercase
// "cho'gath" → "chogath", "Kai Sa" → "kaisa", "Nunu & Willump" → "nunuwillump"
function normalize(s: string): string {
  return s.toLowerCase().replace(/['\s.&]/g, '')
}

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

export default function ChampionInput({ value, onChange, placeholder, className, style }: Props) {
  const { champions, getImageUrl } = useChampionNames()
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const suggestions =
    value.trim().length === 0
      ? []
      : champions
          .filter(c => normalize(c).includes(normalize(value)))
          .slice(0, 8)

  const showDropdown = open && suggestions.length > 0

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const select = useCallback((name: string) => {
    onChange(name)
    setOpen(false)
    setHighlighted(0)
  }, [onChange])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (showDropdown && suggestions[highlighted]) select(suggestions[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'Tab' && showDropdown && suggestions[highlighted]) {
      e.preventDefault()
      select(suggestions[highlighted])
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={value}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        className={className}
        style={style}
        onChange={e => {
          onChange(e.target.value)
          setOpen(true)
          setHighlighted(0)
        }}
        onFocus={() => value.trim().length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
      />

      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 200,
            marginTop: 3,
            background: 'rgba(6,8,16,0.98)',
            border: '1px solid rgba(200,170,110,0.3)',
            borderRadius: 8,
            backdropFilter: 'blur(16px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.85)',
            overflow: 'hidden',
          }}
        >
          {suggestions.map((name, i) => {
            const img = getImageUrl(name)
            return (
              <button
                key={name}
                onMouseDown={e => { e.preventDefault(); select(name) }}
                onMouseEnter={() => setHighlighted(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  textAlign: 'left',
                  padding: '5px 10px',
                  fontSize: 13,
                  cursor: 'pointer',
                  border: 'none',
                  background: i === highlighted ? 'rgba(200,170,110,0.10)' : 'transparent',
                  color: i === highlighted ? '#c8aa6e' : 'rgba(255,255,255,0.70)',
                  transition: 'background 0.1s',
                }}
              >
                {img && (
                  <img
                    src={img}
                    alt=""
                    style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                  />
                )}
                {name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
