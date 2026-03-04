// Shared types used by both main process and renderer

export interface AnalysisItem {
  slot: number
  item: string
  cost: number
  note: string
}

export interface MatchInsightData {
  win_rate: number
  difficulty: number
  patch: string
  tips: string[]
}

export interface AbilityData {
  name: string
  summary: string        // 1-4 word tag e.g. "AOE nuke", "Point-click stun"
  description: string
  cooldown_pre6?: number[]
  cooldown_levels?: number[]
}

export interface EnemyLanerData {
  champion: string
  abilities: {
    Q: AbilityData
    W: AbilityData
    E: AbilityData
    R: AbilityData
  }
}

export interface TeamCompData {
  damage_type: 'AD Heavy' | 'AP Heavy' | 'Mixed' | 'Tank Heavy' | 'Poke Heavy' | 'Engage Heavy'
  ad_percent: number     // 0-100
  ap_percent: number     // 0-100
  tags: string[]         // e.g. ["Heavy CC", "Dive comp", "Long range poke"]
  note: string           // e.g. "Build MR 3rd item — 4 of 5 enemies deal magic damage"
}

export interface RuneData {
  primary_path: string        // e.g. "Precision"
  keystone: string            // e.g. "Conqueror"
  primary_runes: string[]     // 3 runes from primary tree
  secondary_path: string      // e.g. "Domination"
  secondary_runes: string[]   // 2 runes from secondary tree
  shards: string[]            // 3 stat shards e.g. ["Adaptive Force", "Adaptive Force", "Armor"]
  note: string                // Why these runes for this matchup/comp
}

export interface GameplanData {
  playstyle: 'Play Safe' | 'Neutral' | 'Aggressive'
  early_game: string        // First 10 minutes focus: what to do, when to trade
  enemy_strategy: string    // Their core angle/playbook
  team_threats: string[]    // How other enemy champs may interfere during lane (1-2)
  power_spikes: string[]    // Your strongest windows (2-3)
  dont_do: string[]         // Your champion's behavioural pitfalls in this matchup (2-3)
  minor_items: string[]     // Cheap components with lane-phase value (1-3)
}

export interface EarlyBuyItem {
  item: string
  cost: number
  note: string   // why this item early — what it counters specifically
}

export interface StartingItem {
  item: string
  cost: number
}

export interface JGPathData {
  champion: string
  start_buff: 'Red' | 'Blue'
  path_summary: string   // e.g. "Red → Raptors → top gank"
  gank_timing: string    // e.g. "~2:15 top side"
  ward_tip: string       // e.g. "Ward tri-brush before 1:30"
}

export interface AnalysisResult {
  starting_items: StartingItem[]
  early_buys: EarlyBuyItem[]
  item_path: AnalysisItem[]
  runes: RuneData
  match_insight: MatchInsightData
  enemy_laner: EnemyLanerData
  team_comp: TeamCompData
  gameplan: GameplanData
  jg_path: JGPathData
}
