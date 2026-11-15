import React from 'react'
import { Flame } from 'lucide-react'
import { formatAcquisitionTime, formatConfidence } from '../utils/formatters'

function FireDetailsPanel({ fire, onClose }) {
  if (!fire) return null

  return (
    <div className="fire-details-panel">
      <div className="fire-details-header">
        <div>
          <span className="map-kicker">NASA FIRE OBSERVATION</span>
          <h3>Fire Detection Details</h3>
        </div>
        <button
          className="fire-close-button"
          onClick={onClose}
          aria-label="Close fire details"
        >
          ×
        </button>
      </div>

      <div className="fire-coordinate">
        <Flame size={19} />
        <div>
          <strong>
            {fire.latitude}, {fire.longitude}
          </strong>
          <small>Latitude / Longitude</small>
        </div>
      </div>

      <div className="fire-detail-grid">
        <div className="fire-detail-item">
          <small>ACQUISITION DATE</small>
          <strong>{fire.acq_date || 'N/A'}</strong>
        </div>

        <div className="fire-detail-item">
          <small>ACQUISITION TIME (UTC)</small>
          <strong>{formatAcquisitionTime(fire.acq_time)}</strong>
        </div>

        <div className="fire-detail-item">
          <small>BRIGHTNESS TI4</small>
          <strong>{fire.bright_ti4 != null ? `${fire.bright_ti4} K` : 'N/A'}</strong>
        </div>

        <div className="fire-detail-item">
          <small>BRIGHTNESS TI5</small>
          <strong>{fire.bright_ti5 != null ? `${fire.bright_ti5} K` : 'N/A'}</strong>
        </div>

        <div className="fire-detail-item">
          <small>FIRE RADIATIVE POWER</small>
          <strong>{fire.frp != null ? `${fire.frp} MW` : 'N/A'}</strong>
        </div>

        <div className="fire-detail-item">
          <small>CONFIDENCE</small>
          <strong>{formatConfidence(fire.confidence)}</strong>
        </div>

        <div className="fire-detail-item">
          <small>SATELLITE</small>
          <strong>{fire.satellite || 'N/A'}</strong>
        </div>

        <div className="fire-detail-item">
          <small>INSTRUMENT</small>
          <strong>{fire.instrument || 'N/A'}</strong>
        </div>

        <div className="fire-detail-item">
          <small>DAY / NIGHT</small>
          <strong>
            {fire.daynight === 'D'
              ? 'Day'
              : fire.daynight === 'N'
                ? 'Night'
                : 'N/A'}
          </strong>
        </div>

        <div className="fire-detail-item">
          <small>DATA VERSION</small>
          <strong>{fire.version || 'N/A'}</strong>
        </div>

        <div className="fire-detail-item">
          <small>SCAN</small>
          <strong>{fire.scan ?? 'N/A'}</strong>
        </div>

        <div className="fire-detail-item">
          <small>TRACK</small>
          <strong>{fire.track ?? 'N/A'}</strong>
        </div>
      </div>

      <p className="fire-details-note">
        Observation supplied by NASA FIRMS.
      </p>
    </div>
  )
}

export default React.memo(FireDetailsPanel)
