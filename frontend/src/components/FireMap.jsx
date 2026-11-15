import React, { useEffect, useState, useTransition } from 'react'
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet'
import { Globe2, Layers, Activity } from 'lucide-react'
import FireCanvasOverlay from './FireCanvasOverlay'
import FireDetailsPanel from './FireDetailsPanel'

// Controller to smoothly fly the Leaflet map to new center/zoom
function MapViewController({ viewTarget }) {
  const map = useMap()

  useEffect(() => {
    if (viewTarget) {
      map.flyTo(viewTarget.center, viewTarget.zoom, {
        duration: 1.2,
        easeLinearity: 0.25
      })
    }
  }, [viewTarget, map])

  return null
}

function FireMap({
  fires = [],
  grid = [],
  dailyGrids = {},
  fireCount = 0,
  returnedCount = 0,
  loading = false,
  error = null,
  selectedDate = '',
  aggregation = 'Grid cells',
  variable = 'Active fire detections',
  showFires = true,
  selectedFire = null,
  onSelectFire,
  mapTarget = null,
  onResetView
}) {
  const [activeLayerMode, setActiveLayerMode] = useState('auto')
  const [, startTransition] = useTransition()

  // Calculate stats for current view
  const currentDetectionsCount = selectedDate && dailyGrids[selectedDate]
    ? dailyGrids[selectedDate].reduce((sum, c) => sum + c.count, 0)
    : fireCount

  const handleGlobalClick = () => {
    onResetView?.([15, 10], 2)
  }

  const handleToggleLayerMode = () => {
    startTransition(() => {
      setActiveLayerMode((prev) => (prev === 'auto' ? 'detail' : 'auto'))
    })
  }

  return (
    <main className="map-area">
      {/* MAP HEADING */}
      <div className="map-heading">
        <div>
          <span className="map-kicker">GLOBAL MONITORING</span>
          <h2>Earth Observation Map</h2>
          <p>
            {loading
              ? 'Loading NASA satellite observations...'
              : error
                ? 'NASA data connection failed'
                : selectedDate
                  ? `${currentDetectionsCount.toLocaleString()} detections on ${selectedDate} (${fireCount.toLocaleString()} 5-day total)`
                  : `${fireCount.toLocaleString()} total NASA fire detections`}
          </p>
        </div>

        <div className="map-actions">
          <button
            onClick={handleToggleLayerMode}
            aria-label="Toggle layer mode"
            title="Switch between auto grid and high-resolution detection layer"
          >
            <Layers size={15} />
            {activeLayerMode === 'auto' ? 'Grid view' : 'Detail view'}
          </button>

          <button onClick={handleGlobalClick} aria-label="Reset global view">
            <Globe2 size={15} />
            Global
          </button>
        </div>
      </div>

      {/* MAP CONTAINER */}
      <div className="map-container">
        <MapContainer
          center={[15, 10]}
          zoom={2}
          minZoom={2}
          maxZoom={10}
          scrollWheelZoom={true}
          zoomControl={false}
          worldCopyJump={true}
          preferCanvas={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="dark-map-tiles"
          />

          <MapViewController viewTarget={mapTarget} />

          {/* HIGH PERFORMANCE CANVAS OVERLAY (0 React components created) */}
          <FireCanvasOverlay
            fires={fires}
            grid={grid}
            dailyGrids={dailyGrids}
            selectedDate={selectedDate}
            aggregation={activeLayerMode === 'detail' ? 'Points' : aggregation}
            variable={variable}
            showFires={showFires}
            selectedFire={selectedFire}
            onSelectFire={onSelectFire}
          />

          <ZoomControl position="bottomright" />
        </MapContainer>

        {/* SELECTED FIRE DETAILS PANEL */}
        {selectedFire && (
          <FireDetailsPanel
            fire={selectedFire}
            onClose={() => onSelectFire(null)}
          />
        )}

        {/* MAP WATERMARK */}
        <div className="map-watermark">
          <Globe2 size={13} />
          INTERACTIVE GLOBAL MAP
        </div>

        {/* MAP LEGEND */}
        <div className="map-legend">
          <div className="legend-title">
            <span>FIRE INTENSITY</span>
            <Activity size={14} />
          </div>

          <div className="gradient-bar" />

          <div className="gradient-labels">
            <span>LOW</span>
            <span>MODERATE</span>
            <span>HIGH</span>
          </div>

          <div className="legend-note">
            {loading ? (
              'Loading NASA observations...'
            ) : error ? (
              `Error: ${error}`
            ) : showFires ? (
              <>
                <strong>{fireCount.toLocaleString()}</strong> total detections
                <br />
                <span>
                  {aggregation === 'Grid cells'
                    ? 'Aggregated geographic grid (100% data coverage)'
                    : `${returnedCount.toLocaleString()} high-res records loaded`}
                </span>
              </>
            ) : (
              'Fire layer is hidden'
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default React.memo(FireMap)
