import React from 'react'
import { Settings2 } from 'lucide-react'

function AnalyticsPanel({ title, subtitle, children }) {
  return (
    <section className="analytics-panel">
      <div className="panel-heading">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>

        <button
          className="icon-button"
          aria-label="Panel settings"
        >
          <Settings2 size={15} />
        </button>
      </div>

      {children}
    </section>
  )
}

export default React.memo(AnalyticsPanel)
