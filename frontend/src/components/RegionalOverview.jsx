import React from 'react'
import { ChevronDown } from 'lucide-react'
import AnalyticsPanel from './AnalyticsPanel'

const REGIONS = [
  { id: '01', name: 'South America', detail: 'Amazon region', center: [-10, -55], zoom: 4 },
  { id: '02', name: 'Central Africa', detail: 'Congo basin', center: [0, 22], zoom: 4 },
  { id: '03', name: 'South Asia', detail: 'India region', center: [22, 79], zoom: 4 },
  { id: '04', name: 'Southeast Asia', detail: 'Indonesia region', center: [-2, 118], zoom: 4 },
  { id: '05', name: 'North America', detail: 'Western region', center: [42, -118], zoom: 4 }
]

function RegionalOverview({ onSelectRegion }) {
  return (
    <AnalyticsPanel
      title="Regional overview"
      subtitle="Regions to investigate"
    >
      <div className="region-list">
        {REGIONS.map((region) => (
          <div
            className="region-row"
            key={region.id}
            style={{ cursor: onSelectRegion ? 'pointer' : 'default' }}
            onClick={() => onSelectRegion?.(region.center, region.zoom)}
            role={onSelectRegion ? 'button' : undefined}
            tabIndex={onSelectRegion ? 0 : undefined}
          >
            <span className="region-number">{region.id}</span>
            <div>
              <strong>{region.name}</strong>
              <small>{region.detail}</small>
            </div>
            <ChevronDown size={14} />
          </div>
        ))}
      </div>
    </AnalyticsPanel>
  )
}

export default React.memo(RegionalOverview)
