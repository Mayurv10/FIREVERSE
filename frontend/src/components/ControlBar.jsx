import React from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';

function ControlBar({
  date,
  onDateChange,
  minDate,
  maxDate,
  aggregation,
  onAggregationChange,
  showFires,
  onToggleFires,
  // New filter props
  confidenceFilter,
  onConfidenceFilterChange,
  frpFilter,
  onFrpFilterChange,
  // Visualization mode
  layerMode,
  onLayerModeChange,
  // Reset filters
  onResetFilters,
}) {
  return (
    <section className="controlbar">
      <div className="control-group">
        <label>ANALYSIS PERIOD</label>
        <div className="control-input">
          <CalendarDays size={15} />
          <input
            type="date"
            value={date || ''}
            min={minDate || undefined}
            max={maxDate || undefined}
            onChange={(e) => onDateChange(e.target.value)}
            aria-label="Filter observation date"
          />
        </div>
      </div>

      <div className="control-group">
        <label>AGGREGATE BY</label>
        <div className="segmented">
          {['Grid cells', 'Regions'].map((item) => (
            <button
              key={item}
              className={aggregation === item ? 'selected' : ''}
              onClick={() => onAggregationChange(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="control-group map-toggle">
        <label>FIRE LAYER</label>
        <button
          className={`toggle ${showFires ? 'on' : ''}`}
          onClick={onToggleFires}
          aria-label="Toggle fire layer"
        >
          <span />
        </button>
      </div>

      {/* Visualization mode selector */}
      <div className="control-group">
        <label>MAP VIEW</label>
        <div className="segmented">
          {['Markers', 'Heatmap', 'Clusters'].map((mode) => (
            <button
              key={mode}
              className={layerMode === mode ? 'selected' : ''}
              onClick={() => onLayerModeChange(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* New filter controls */}
      <div className="control-group">
        <label>CONFIDENCE ≥ %</label>
        <div className="control-input">
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={confidenceFilter}
            onChange={(e) => onConfidenceFilterChange(Number(e.target.value))}
            aria-label="Confidence filter"
          />
          <span>{confidenceFilter}%</span>
        </div>
      </div>

      <div className="control-group">
        <label>FRP ≥ MW</label>
        <div className="control-input">
          <input
            type="range"
            min="0"
            max="500"
            step="10"
            value={frpFilter}
            onChange={(e) => onFrpFilterChange(Number(e.target.value))}
            aria-label="FRP filter"
          />
          <span>{frpFilter} MW</span>
        </div>
      </div>

      {/* Reset filters button */}
      <div className="control-group">
        <button className="reset-button" onClick={onResetFilters}>Reset Filters</button>
      </div>
    </section>
  );
}

export default React.memo(ControlBar);
