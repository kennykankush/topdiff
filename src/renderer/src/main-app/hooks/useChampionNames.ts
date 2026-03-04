import { useState, useEffect } from 'react'

interface ChampionEntry { name: string; key: string }

// Module-level cache — fetches once per session
let cachedNames: string[] | null = null
let cachedVersion: string | null = null
// normalized display name → DDragon key (e.g. "wukong" → "MonkeyKing")
let cachedKeyMap: Record<string, string> | null = null

function normalize(name: string): string {
  return name.toLowerCase().replace(/['\s.&]/g, '')
}

export function useChampionNames(): {
  champions: string[]
  getImageUrl: (displayName: string) => string | null
} {
  const [champions, setChampions] = useState<string[]>(cachedNames ?? [])

  useEffect(() => {
    if (cachedNames) return
    ;(async () => {
      try {
        const vRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json')
        cachedVersion = ((await vRes.json()) as string[])[0]
        const cRes = await fetch(
          `https://ddragon.leagueoflegends.com/cdn/${cachedVersion}/data/en_US/champion.json`
        )
        const data = await cRes.json()
        const entries = Object.entries(data.data) as [string, { name: string }][]
        cachedKeyMap = {}
        cachedNames = entries.map(([key, champ]) => {
          cachedKeyMap![normalize(champ.name)] = key
          cachedKeyMap![normalize(key)] = key
          return champ.name
        }).sort()
        setChampions(cachedNames)
      } catch {
        // silently fail — user can still type
      }
    })()
  }, [])

  const getImageUrl = (displayName: string): string | null => {
    if (!cachedKeyMap || !cachedVersion || !displayName.trim()) return null
    const key = cachedKeyMap[normalize(displayName)]
    if (!key) return null
    return `https://ddragon.leagueoflegends.com/cdn/${cachedVersion}/img/champion/${key}.png`
  }

  return { champions, getImageUrl }
}
