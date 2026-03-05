import type { DDragonChampionSpells } from '../services/data-dragon'

// Bump these when you change the respective prompts
export const VISION_PROMPT_VERSION = 'v2'
export const ANALYSIS_PROMPT_VERSION = 'v1'

export interface AnalysisPromptParams {
  myChampion: string
  myRole: string
  side: 'Blue' | 'Red'
  enemyLaner: string
  enemyTeam: string[]
  enemySpells?: DDragonChampionSpells | null  // pre-fetched from Data Dragon
  patch?: string | null  // e.g. "15.4.1" from Data Dragon
}

export const ANALYSIS_SYSTEM_PROMPT = `You are a League of Legends coaching assistant.

Do exactly ONE web search for current patch win rate and optimal builds/runes. Output ONLY a raw JSON object — no markdown, no \`\`\`json, nothing outside the braces.

Schema:
{"starting_items":[{"item":str,"cost":int}],"early_buys":[{"item":str,"cost":int,"note":str}],"runes":{"primary_path":str,"keystone":str,"primary_runes":[3],"secondary_path":str,"secondary_runes":[2],"shards":[3],"note":str},"item_path":[{"slot":1-6,"item":str,"cost":int,"note":str}],"match_insight":{"win_rate":float,"difficulty":1-10,"patch":str,"tips":[3]},"enemy_laner":{"champion":str,"abilities":{"Q":{"name":str,"summary":str,"description":str,"cooldown_pre6":[5]},"W":{"name":str,"summary":str,"description":str,"cooldown_pre6":[5]},"E":{"name":str,"summary":str,"description":str,"cooldown_pre6":[5]},"R":{"name":str,"summary":str,"description":str,"cooldown_levels":[3]}}},"team_comp":{"damage_type":str,"ad_percent":int,"ap_percent":int,"tags":[2-4],"note":str},"gameplan":{"playstyle":str,"early_game":str,"enemy_strategy":str,"team_threats":[2],"power_spikes":[3],"dont_do":[3],"minor_items":[1-3]},"jg_path":{"champion":str,"start_buff":"Red"|"Blue","path_summary":str,"gank_timing":str,"ward_tip":str}}

Rules:
- ONE search only. Use training knowledge for everything else.
- TONE: write like a coach talking to a player — punchy, direct, action words. "Bait his W before trading" not "It is advisable to provoke the enemy into using their W ability prior to initiating a trade". Short sentences. No filler.
- starting_items: 2-4 items to buy at game start (e.g. Doran's Blade + Health Potion for fighters/ADC, Doran's Ring + 2 Potions for mages, Doran's Shield for hard lanes, Long Sword + 3 Potions for early aggression, Corrupting Potion for sustained poke, Jungle Item + refillable for junglers). Include Health Potions separately as an item.
- early_buys: 2-4 items to buy on first back or within first 3 minutes — PATH-EFFICIENT and matchup-reactive. E.g. Executioner's Calling vs heavy healing (Vladimir, Soraka, Aatrox), Null-Magic Mantle vs AP laner, Cloth Armor vs AD assassin, Caulfield's Warhammer for ability haste spike, Vampiric Scepter for sustain matchups. Note = what it specifically counters.
- item_path: 6 final build slots. Slots 1-2 = core lane items (may upgrade FROM an early_buy, e.g. Executioner's → Mortal Reminder); slots 3-6 = situational vs full team comp (heavy AP→MR, heavy AD→armor, assassin-heavy→Zhonya's/Sterak's). Each note = one short reason why.
- runes: primary_path ∈ {Precision,Domination,Sorcery,Resolve,Inspiration}; 3 primary_runes from rows 1-3; 2 secondary_runes; 3 shards ∈ {Adaptive Force,Attack Speed,Ability Haste,Armor,Magic Resist,Health}.
- ability summary: 1-4 words. description: what it does + what to watch for — direct and specific.
- If enemy spell data is provided, use those exact cooldown numbers.
- damage_type ∈ {AD Heavy,AP Heavy,Mixed,Tank Heavy,Poke Heavy,Engage Heavy}
- gameplan (all = first 10 min): playstyle ∈ {Play Safe,Neutral,Aggressive}; early_game = trading windows + key ward spot; enemy_strategy = their lane playbook in one or two sentences; team_threats = 2 strings on other champs; power_spikes = 3 breakpoints; dont_do = 3 mistakes; minor_items = 1-3 cheap buys with lane value not in item_path or early_buys (e.g. Cull, Control Ward, Refillable Potion).
- jg_path: based on the enemy jungler champion — start_buff = which buff they typically start (Red or Blue); path_summary = short clear path (e.g. "Blue → Gromp → Wolves → gank mid"); gank_timing = expected first gank window (e.g. "Level 2 top ~2:10" or "Level 3 mid ~3:30"); ward_tip = one specific ward spot + timing to be safe.`

export function buildAnalysisUserPrompt(params: AnalysisPromptParams): string {
  const patchStr = params.patch ? `patch ${params.patch}` : 'current patch'
  const sideContext = params.side === 'Blue'
    ? 'Blue side. Enemy jungler is Red side — their Red Buff is top-right (Baron side), so if they start Red expect early top pressure; if they start Blue (Dragon side) expect early bot pressure.'
    : 'Red side. Enemy jungler is Blue side — their Red Buff is bottom-left (Dragon side), so if they start Red expect early bot pressure; if they start Blue (Baron side) expect early top pressure.'

  const lines: string[] = [
    `Playing ${params.myChampion} ${params.myRole} vs ${params.enemyLaner} (laner). Full enemy team: ${params.enemyTeam.join(', ')}. Patch: ${patchStr}. We are ${params.side} side — ${sideContext}.`
  ]

  if (params.enemySpells) {
    const s = params.enemySpells
    lines.push(
      `\n${params.enemyLaner} ability data (from Data Dragon — use these exact cooldowns):`,
      `Q - ${s.Q.name}: CD [${s.Q.cooldown.join(', ')}]`,
      `W - ${s.W.name}: CD [${s.W.cooldown.join(', ')}]`,
      `E - ${s.E.name}: CD [${s.E.cooldown.join(', ')}]`,
      `R - ${s.R.name}: CD [${s.R.cooldown.join(', ')}]`,
      `\nSearch for ${params.myChampion} vs ${params.enemyLaner} ${patchStr} win rate, recent buffs/nerfs, and meta build. Return the JSON report.`
    )
  } else {
    lines.push(`Search for ${params.myChampion} vs ${params.enemyLaner} ${patchStr} win rate, recent buffs/nerfs, and meta build. Return the JSON coaching report.`)
  }

  return lines.join('\n')
}

export const VISION_PROMPT = `Output ONLY a raw JSON object, no text before or after.

{"scene":"champion_select","my_champion":"ChampionName","my_role":"Top","enemy_picks":[{"champion":"ChampionName","role":"Top"}],"pending_roles":[],"note":"","confidence":"high"}

scene: "champion_select" | "not_champion_select" | "unknown"
my_champion: YOUR team's highlighted/active champion (bottom-left side, has role icons) — null if none
my_role: YOUR position — infer from the role icon shown next to your champion on YOUR team side. One of: "Top","Jungle","Mid","Bot","Support" — null if unclear
enemy_picks: only confirmed locked enemy champions — infer roles from champion identity (e.g. Thresh→Support, Lee Sin→Jungle)
CRITICAL: each role must appear at most once in enemy_picks. Use process of elimination — if two champions seem like the same role, assign the second one the remaining unfilled role.
pending_roles: enemy roles not yet locked
confidence: "high"=5 locked, "medium"=3-4, "low"=<3
If not champion select: scene="not_champion_select", enemy_picks=[], my_champion=null, my_role=null`
