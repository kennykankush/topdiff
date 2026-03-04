// Fetches champion spell data from Riot's Data Dragon CDN
// Abilities are static game data — no API key needed

export interface DDragonSpell {
  name: string
  cooldown: number[]  // per rank, usually 5 values (3 for R)
}

export interface DDragonChampionSpells {
  Q: DDragonSpell
  W: DDragonSpell
  E: DDragonSpell
  R: DDragonSpell
}

let cachedVersion: string | null = null
// display name (lowercase) → DDragon key  e.g. "wukong" → "MonkeyKing"
const championKeyCache: Record<string, string> = {}
// DDragon key → spell data
const spellCache: Record<string, DDragonChampionSpells> = {}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`DDragon fetch failed: ${url} (${res.status})`)
  return res.json()
}

export async function getLatestVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion
  const versions = await fetchJson('https://ddragon.leagueoflegends.com/api/versions.json') as string[]
  cachedVersion = versions[0]
  console.log('[DDragon] Latest patch:', cachedVersion)
  return cachedVersion
}

async function buildChampionKeyMap(version: string): Promise<void> {
  if (Object.keys(championKeyCache).length > 0) return
  const data = await fetchJson(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
  ) as { data: Record<string, { name: string }> }
  for (const [key, champ] of Object.entries(data.data)) {
    championKeyCache[champ.name.toLowerCase()] = key
    championKeyCache[key.toLowerCase()] = key  // also index by key itself
  }
}

export async function getChampionSpells(championName: string): Promise<DDragonChampionSpells | null> {
  try {
    const version = await getLatestVersion()
    await buildChampionKeyMap(version)

    const key = championKeyCache[championName.toLowerCase()]
    if (!key) {
      console.warn('[DDragon] Champion not found:', championName)
      return null
    }

    if (spellCache[key]) return spellCache[key]

    const data = await fetchJson(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion/${key}.json`
    ) as { data: Record<string, { spells: Array<{ name: string; cooldown: number[] }> }> }

    const spells = data.data[key].spells
    const result: DDragonChampionSpells = {
      Q: { name: spells[0].name, cooldown: spells[0].cooldown.slice(0, 5) },
      W: { name: spells[1].name, cooldown: spells[1].cooldown.slice(0, 5) },
      E: { name: spells[2].name, cooldown: spells[2].cooldown.slice(0, 5) },
      R: { name: spells[3].name, cooldown: spells[3].cooldown.slice(0, 3) },
    }

    spellCache[key] = result
    console.log(`[DDragon] Loaded spells for ${championName}:`, Object.entries(result).map(([k, v]) => `${k}:${v.name}`).join(', '))
    return result
  } catch (err) {
    console.warn('[DDragon] Failed to fetch spells for', championName, err)
    return null
  }
}
