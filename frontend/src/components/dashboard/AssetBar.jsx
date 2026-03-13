export function AssetBar({ equity, debt, cash }) {
  return (
    <div className="space-y-1">
      <div className="flex rounded-full overflow-hidden h-2">
        {equity > 0 && (
          <div
            className="bg-terracotta"
            style={{ width: `${equity}%` }}
            title={`Equity ${equity}%`}
          />
        )}
        {debt > 0 && (
          <div
            className="bg-sand"
            style={{ width: `${debt}%` }}
            title={`Debt ${debt}%`}
          />
        )}
        {cash > 0 && (
          <div
            className="bg-muted-light/50"
            style={{ width: `${cash}%` }}
            title={`Cash ${cash}%`}
          />
        )}
      </div>
      <div className="flex gap-3 text-xs text-muted">
        {equity > 0 && <span><span className="inline-block w-2 h-2 rounded-full bg-terracotta mr-1" />{equity}% equity</span>}
        {debt > 0 && <span><span className="inline-block w-2 h-2 rounded-full bg-sand mr-1" />{debt}% debt</span>}
        {cash > 0 && <span><span className="inline-block w-2 h-2 rounded-full bg-muted-light/50 mr-1" />{cash}% cash</span>}
      </div>
    </div>
  )
}
