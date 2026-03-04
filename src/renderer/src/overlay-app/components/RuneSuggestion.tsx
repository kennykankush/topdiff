import type { RuneData } from '../../../../shared/types'

type Props = { runes: RuneData }

const DDRAGON = 'https://ddragon.leagueoflegends.com/cdn/img'

// Path icon IDs from Data Dragon
const PATH_ICONS: Record<string, string> = {
  'Precision':   `${DDRAGON}/perk-images/Styles/7201_Precision.png`,
  'Domination':  `${DDRAGON}/perk-images/Styles/7200_Domination.png`,
  'Sorcery':     `${DDRAGON}/perk-images/Styles/7202_Sorcery.png`,
  'Resolve':     `${DDRAGON}/perk-images/Styles/7204_Resolve.png`,
  'Inspiration': `${DDRAGON}/perk-images/Styles/7203_Whimsy.png`,
}

// Keystone icon paths from Data Dragon
const KEYSTONE_ICONS: Record<string, string> = {
  'Conqueror':             `${DDRAGON}/perk-images/Styles/Precision/Conqueror/Conqueror.png`,
  'Lethal Tempo':          `${DDRAGON}/perk-images/Styles/Precision/LethalTempo/LethalTempoTemp.png`,
  'Fleet Footwork':        `${DDRAGON}/perk-images/Styles/Precision/FleetFootwork/FleetFootwork.png`,
  'Press the Attack':      `${DDRAGON}/perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png`,
  'Electrocute':           `${DDRAGON}/perk-images/Styles/Domination/Electrocute/Electrocute.png`,
  'Dark Harvest':          `${DDRAGON}/perk-images/Styles/Domination/DarkHarvest/DarkHarvest.png`,
  'Predator':              `${DDRAGON}/perk-images/Styles/Domination/Predator/Predator.png`,
  'Hail of Blades':        `${DDRAGON}/perk-images/Styles/Domination/HailOfBlades/HailOfBlades.png`,
  'Arcane Comet':          `${DDRAGON}/perk-images/Styles/Sorcery/ArcaneComet/ArcaneComet.png`,
  'Phase Rush':            `${DDRAGON}/perk-images/Styles/Sorcery/PhaseRush/PhaseRush.png`,
  'Summon Aery':           `${DDRAGON}/perk-images/Styles/Sorcery/SummonAery/SummonAery.png`,
  'Glacial Augment':       `${DDRAGON}/perk-images/Styles/Inspiration/GlacialAugment/GlacialAugment.png`,
  'First Strike':          `${DDRAGON}/perk-images/Styles/Inspiration/FirstStrike/FirstStrike.png`,
  'Grasp of the Undying':  `${DDRAGON}/perk-images/Styles/Resolve/GraspOfTheUndying/GraspOfTheUndying.png`,
  'Aftershock':            `${DDRAGON}/perk-images/Styles/Resolve/VeteranAftershock/VeteranAftershock.png`,
  'Guardian':              `${DDRAGON}/perk-images/Styles/Resolve/Guardian/Guardian.png`,
}

const PATH_COLORS: Record<string, string> = {
  'Precision':   '#c8aa6e',
  'Domination':  '#c23b3b',
  'Sorcery':     '#6e8dcb',
  'Resolve':     '#4cad5b',
  'Inspiration': '#49d0c5',
}

function PathIcon({ path, size = 14 }: { path: string; size?: number }) {
  const src = PATH_ICONS[path]
  const color = PATH_COLORS[path] ?? '#ffffff'
  if (src) {
    return <img src={src} alt={path} style={{ width: size, height: size, borderRadius: 2 }} />
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 2, background: color, opacity: 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 8, color: 'white', fontWeight: 700 }}>{path[0]}</span>
    </div>
  )
}

export default function RuneSuggestion({ runes }: Props) {
  const keystoneIcon = KEYSTONE_ICONS[runes.keystone]
  const primaryColor = PATH_COLORS[runes.primary_path] ?? '#c8aa6e'
  const secondaryColor = PATH_COLORS[runes.secondary_path] ?? '#888'

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-white/30 text-[10px] uppercase tracking-wider">Runes</p>

      {/* Primary path + keystone */}
      <div className="flex items-center gap-2">
        {/* Keystone icon */}
        <div
          className="relative flex-shrink-0"
          style={{
            width: 32, height: 32, borderRadius: 6,
            border: `1.5px solid ${primaryColor}40`,
            boxShadow: `0 0 8px ${primaryColor}30`,
            overflow: 'hidden',
            background: 'rgba(255,255,255,0.04)'
          }}
        >
          {keystoneIcon
            ? <img src={keystoneIcon} alt={runes.keystone} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center">
                <span style={{ fontSize: 9, color: primaryColor, fontWeight: 700 }}>{runes.keystone[0]}</span>
              </div>
          }
        </div>

        <div className="flex flex-col min-w-0">
          {/* Keystone name + primary path */}
          <div className="flex items-center gap-1.5">
            <span className="text-white/85 text-[12px] font-semibold truncate">{runes.keystone}</span>
            <PathIcon path={runes.primary_path} size={12} />
          </div>
          {/* Primary runes */}
          <span className="text-white/35 text-[10px] truncate">{runes.primary_runes.join(' · ')}</span>
        </div>
      </div>

      {/* Secondary path */}
      <div className="flex items-center gap-1.5 pl-0.5">
        <PathIcon path={runes.secondary_path} size={12} />
        <span className="text-[10px] font-medium" style={{ color: secondaryColor }}>{runes.secondary_path}</span>
        <span className="text-white/35 text-[10px] truncate">{runes.secondary_runes.join(' · ')}</span>
      </div>

      {/* Shards */}
      <div className="flex items-center gap-1 pl-0.5">
        {runes.shards.map((shard, i) => (
          <span
            key={i}
            className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 border border-white/8 text-white/40 leading-none"
          >
            {shard}
          </span>
        ))}
      </div>

      {/* Note */}
      {runes.note && (
        <p className="text-white/45 text-[10px] leading-relaxed pl-2 border-l border-lol-gold/20">{runes.note}</p>
      )}
    </div>
  )
}
