import type { AnalysisItem, EarlyBuyItem, StartingItem } from '../../../../shared/types'
import { useItemImages } from '../hooks/useItemImages'

type Props = { items: AnalysisItem[]; earlyBuys: EarlyBuyItem[]; startingItems: StartingItem[] }

function ItemIcon({ url, name, size = 36 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{ width: size, height: size, borderRadius: 6, flexShrink: 0 }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 6, flexShrink: 0,
      background: 'rgba(200,170,110,0.12)', border: '1px solid rgba(200,170,110,0.2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <span style={{ fontSize: 11, color: 'rgba(200,170,110,0.6)', fontWeight: 700 }}>{name[0]}</span>
    </div>
  )
}

function ItemRow({ item, note, cost, imageUrl, size = 36 }: {
  item: string; note: string; cost: number; imageUrl: string | null; size?: number
}) {
  return (
    <div className="flex items-start gap-2.5">
      <ItemIcon url={imageUrl} name={item} size={size} />
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-white/85 text-[12px] font-semibold leading-tight truncate">{item}</span>
          {cost > 0 && (
            <span className="text-lol-gold/55 text-[10px] flex-shrink-0">{cost.toLocaleString()}g</span>
          )}
        </div>
        {note && <p className="text-white/40 text-[10px] leading-snug mt-0.5">{note}</p>}
      </div>
    </div>
  )
}

export default function ItemBuildPath({ items, earlyBuys, startingItems }: Props) {
  const { getImageUrl } = useItemImages()
  const laneItems = items.filter(i => i.slot <= 2)
  const compItems = items.filter(i => i.slot > 2)

  return (
    <div className="flex flex-col gap-4">

      {/* Starting items */}
      {startingItems.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <p className="text-white/25 text-[9px] uppercase tracking-widest">Start</p>
            <div className="flex-1 h-px bg-white/5" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {startingItems.map((s, i) => {
              const url = getImageUrl(s.item)
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <ItemIcon url={url} name={s.item} size={34} />
                  <span className="text-white/40 text-[9px] leading-none text-center" style={{ maxWidth: 44 }}>
                    {s.item.replace(' Potion', ' Pot').replace('Health ', 'HP ')}
                  </span>
                  {s.cost > 0 && (
                    <span className="text-lol-gold/40 text-[8px] leading-none">{s.cost}g</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Early / first-back buys */}
      {earlyBuys.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <p className="text-white/25 text-[9px] uppercase tracking-widest">First Back</p>
            <div className="flex-1 h-px bg-white/5" />
          </div>
          {earlyBuys.map((buy, i) => (
            <ItemRow
              key={i}
              item={buy.item}
              note={buy.note}
              cost={buy.cost}
              imageUrl={getImageUrl(buy.item)}
              size={32}
            />
          ))}
        </div>
      )}

      {/* Lane core — slots 1-2 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <p className="text-white/25 text-[9px] uppercase tracking-widest">Core Lane</p>
          <div className="flex-1 h-px bg-white/5" />
        </div>
        {laneItems.map(item => (
          <ItemRow
            key={item.slot}
            item={item.item}
            note={item.note}
            cost={item.cost}
            imageUrl={getImageUrl(item.item)}
          />
        ))}
      </div>

      {/* Team comp — slots 3-6 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <p className="text-white/25 text-[9px] uppercase tracking-widest">vs Their Comp</p>
          <div className="flex-1 h-px bg-white/5" />
        </div>
        {compItems.map(item => (
          <ItemRow
            key={item.slot}
            item={item.item}
            note={item.note}
            cost={item.cost}
            imageUrl={getImageUrl(item.item)}
          />
        ))}
      </div>

    </div>
  )
}
