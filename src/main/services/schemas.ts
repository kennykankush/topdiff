import { z } from 'zod'

const RuneSchema = z.object({
  primary_path: z.string(),
  keystone: z.string(),
  primary_runes: z.array(z.string()),
  secondary_path: z.string(),
  secondary_runes: z.array(z.string()),
  shards: z.array(z.string()),
  note: z.string()
})

const AbilitySchema = z.object({
  name: z.string(),
  summary: z.string(),
  description: z.string(),
  cooldown_pre6: z.array(z.number()).optional(),
  cooldown_levels: z.array(z.number()).optional()
})

const GameplanSchema = z.object({
  playstyle: z.enum(['Play Safe', 'Neutral', 'Aggressive']),
  early_game: z.string(),
  enemy_strategy: z.string(),
  team_threats: z.array(z.string()),
  power_spikes: z.array(z.string()),
  dont_do: z.array(z.string()),
  minor_items: z.array(z.string())
})

const EarlyBuySchema = z.object({
  item: z.string(),
  cost: z.number(),
  note: z.string()
})

export const AnalysisResultSchema = z.object({
  starting_items: z.array(z.object({ item: z.string(), cost: z.number() })),
  early_buys: z.array(EarlyBuySchema),
  item_path: z.array(z.object({
    slot: z.number(),
    item: z.string(),
    cost: z.number(),
    note: z.string()
  })),
  runes: RuneSchema,
  match_insight: z.object({
    win_rate: z.number(),
    difficulty: z.number().min(1).max(10),
    patch: z.string(),
    tips: z.array(z.string())
  }),
  enemy_laner: z.object({
    champion: z.string(),
    abilities: z.object({
      Q: AbilitySchema,
      W: AbilitySchema,
      E: AbilitySchema,
      R: AbilitySchema
    })
  }),
  team_comp: z.object({
    damage_type: z.enum(['AD Heavy', 'AP Heavy', 'Mixed', 'Tank Heavy', 'Poke Heavy', 'Engage Heavy']),
    ad_percent: z.number(),
    ap_percent: z.number(),
    tags: z.array(z.string()),
    note: z.string()
  }),
  gameplan: GameplanSchema,
  jg_path: z.object({
    champion: z.string(),
    start_buff: z.enum(['Red', 'Blue']),
    path_summary: z.string(),
    gank_timing: z.string(),
    ward_tip: z.string()
  })
})
