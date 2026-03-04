import { useState, useEffect } from 'react'

// Module-level cache — survives component remounts, only fetches once
let cachedVersion: string | null = null
let cachedItemMap: Record<string, string> | null = null  // lowercase name → item id

async function loadItemData(): Promise<void> {
  if (cachedItemMap) return
  const vRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json')
  cachedVersion = ((await vRes.json()) as string[])[0]
  const iRes = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${cachedVersion}/data/en_US/item.json`
  )
  const data = await iRes.json()
  cachedItemMap = {}
  for (const [id, item] of Object.entries(data.data as Record<string, { name: string }>)) {
    cachedItemMap[item.name.toLowerCase()] = id
  }
}

export function useItemImages() {
  const [ready, setReady] = useState(!!cachedItemMap)

  useEffect(() => {
    if (cachedItemMap) return
    loadItemData().then(() => setReady(true)).catch(console.warn)
  }, [])

  const getImageUrl = (itemName: string): string | null => {
    if (!cachedItemMap || !cachedVersion) return null
    // exact match first, then case-insensitive
    const id = cachedItemMap[itemName.toLowerCase()]
    if (!id) return null
    return `https://ddragon.leagueoflegends.com/cdn/${cachedVersion}/img/item/${id}.png`
  }

  return { getImageUrl, ready }
}
