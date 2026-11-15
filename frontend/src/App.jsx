import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Landing from './components/Landing';
import About from './components/About';
import Topbar from './components/Topbar';
import ControlBar from './components/ControlBar';
import DailyActivityChart from './components/DailyActivityChart';
import HistoricalChart from './components/HistoricalChart';
import RegionalOverview from './components/RegionalOverview';
import FireMap from './components/FireMap';
import Timeline from './components/Timeline';

import { fetchFires } from './services/api';
import 'leaflet/dist/leaflet.css';
import './App.css';
import WeatherPanel from './components/WeatherPanel';
import ExportButtons from './components/ExportButtons';

function App() {
  // Page navigation state: 'landing' | 'dashboard' | 'about'
  const [page, setPage] = useState('landing');

  // Visualization controls

    const [variable, setVariable] = useState('Active fire detections');
  const [aggregation, setAggregation] = useState('Grid cells');
  const [playing, setPlaying] = useState(false);
  const [date, setDate] = useState('');
  const [showFires, setShowFires] = useState(true);
  // Map rendering mode: Markers, Heatmap, Clusters
  const [layerMode, setLayerMode] = useState('Markers');
  // Filters
  const [confidenceFilter, setConfidenceFilter] = useState(0);
  const [frpFilter, setFrpFilter] = useState(0);




  // NASA FIRMS data states
  const [fires, setFires] = useState([]);
  const [grid, setGrid] = useState([]);
  const [dailyGrids, setDailyGrids] = useState({});
  const [fireCount, setFireCount] = useState(0);
  const [returnedCount, setReturnedCount] = useState(0);
  const [dailyCounts, setDailyCounts] = useState([]);
  const [loadingFires, setLoadingFires] = useState(true);
  const [fireError, setFireError] = useState(null);

  // Inspection & navigation
  const [selectedFire, setSelectedFire] = useState(null);
  const [mapTarget, setMapTarget] = useState(null);

  // Convert dailyCounts into Recharts data (strictly uses dailyCounts, not fires array)
  const dailyActivity = useMemo(() => {
    if (!Array.isArray(dailyCounts) || dailyCounts.length === 0) return [];
    return dailyCounts.map(item => ({
      day: String(item.date).slice(5),
      fires: Number(item.count) || 0,
      fullDate: String(item.date),
    }));
  }, [dailyCounts]);

  // Fetch data once when dashboard is active
  useEffect(() => {
    if (page !== 'dashboard') return;
    const controller = new AbortController();
    const loadData = async () => {
      try {
        setLoadingFires(true);
        setFireError(null);
        const data = await fetchFires({ days: 5, limit: 1500, signal: controller.signal });
        setFires(Array.isArray(data.fires) ? data.fires : []);
        setGrid(Array.isArray(data.grid) ? data.grid : []);
        setDailyGrids(data.daily_grids && typeof data.daily_grids === 'object' ? data.daily_grids : {});
        setFireCount(Number(data.count) || 0);
        setReturnedCount(Number(data.returned) || data.fires?.length || 0);
        setDailyCounts(Array.isArray(data.daily_counts) ? data.daily_counts : []);
        if (Array.isArray(data.daily_counts) && data.daily_counts.length > 0) {
          const sorted = data.daily_counts.map(d => d.date).sort();
          setDate(sorted[sorted.length - 1]);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('NASA FIRMS data error:', err);
          setFireError(err.message || 'Unable to load NASA FIRMS fire data.');
        }
      } finally {
        if (!controller.signal.aborted) setLoadingFires(false);
      }
    };
    loadData();
    return () => controller.abort();
  }, [page]);

  // UI callbacks
  const handleDateChange = useCallback(newDate => setDate(newDate), []);
  const handleVariableChange = useCallback(v => setVariable(v), []);
  const handleAggregationChange = useCallback(a => setAggregation(a), []);
  const handleToggleFires = useCallback(() => {
    setShowFires(prev => !prev);
    setSelectedFire(null);
  }, []);
  const handleSelectFire = useCallback(fire => setSelectedFire(fire), []);
  const handleTogglePlay = useCallback(() => setPlaying(p => !p), []);
  const handleSelectRegion = useCallback((center, zoom) => setMapTarget({ center, zoom, timestamp: Date.now() }), []);
  const handleResetView = useCallback((center, zoom) => setMapTarget({ center, zoom, timestamp: Date.now() }), []);
  const handleNavigate = useCallback(target => setPage(target), []);

  // Page rendering
  if (page === 'landing') {
    return (
      <div className="app-container">
        <Landing onEnter={() => handleNavigate('dashboard')} />
      </div>
    );
  }

  if (page === 'about') {
    return (
      <div className="app-container">
        <Topbar />
        <About />
        <footer className="footer">
          <p>Data source: NASA FIRMS (VIIRS) – <a href="https://firms.modaps.eosdis.nasa.gov" target="_blank" rel="noopener noreferrer">https://firms.modaps.eosdis.nasa.gov</a></p>
        </footer>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="dashboard">
      <Topbar>
        <nav className="nav-links">
          <button onClick={() => handleNavigate('dashboard')} className="nav-button">Dashboard</button>
          <button onClick={() => handleNavigate('about')} className="nav-button">About</button>
        </nav>
      </Topbar>

      <ControlBar
        date={date}
        onDateChange={handleDateChange}
        minDate={dailyActivity[0]?.fullDate}
        maxDate={dailyActivity[dailyActivity.length - 1]?.fullDate}
        variable={variable}
        onVariableChange={handleVariableChange}
        aggregation={aggregation}
        onAggregationChange={handleAggregationChange}
        showFires={showFires}
        onToggleFires={handleToggleFires}
        confidenceFilter={confidenceFilter}
        onConfidenceFilterChange={setConfidenceFilter}
        frpFilter={frpFilter}
        onFrpFilterChange={setFrpFilter}
        layerMode={layerMode}
        onLayerModeChange={setLayerMode}
        onResetFilters={() => {
          setConfidenceFilter(0);
          setFrpFilter(0);
          setLayerMode('Markers');
        }}
      />

      <div className="workspace">
        <aside className="left-panel">
          <DailyActivityChart dailyCounts={dailyCounts} totalCount={fireCount} loading={loadingFires} error={fireError} />
          <HistoricalChart />
          <RegionalOverview onSelectRegion={handleSelectRegion} />
        </aside>
        <FireMap
          fires={fires}
          grid={grid}
          dailyGrids={dailyGrids}
          fireCount={fireCount}
          returnedCount={returnedCount}
          loading={loadingFires}
          error={fireError}
          selectedDate={date}
          aggregation={aggregation}
          variable={variable}
          showFires={showFires}
          selectedFire={selectedFire}
          onSelectFire={handleSelectFire}
          mapTarget={mapTarget}
          onResetView={handleResetView}
        />
      </div>

      <Timeline date={date} onDateChange={handleDateChange} dailyActivity={dailyActivity} playing={playing} onTogglePlay={handleTogglePlay} />

      <footer className="footer">
        <p>Data source: NASA FIRMS (VIIRS) – <a href="https://firms.modaps.eosdis.nasa.gov" target="_blank" rel="noopener noreferrer">https://firms.modaps.eosdis.nasa.gov</a></p>
        <button className="nav-button" onClick={() => handleNavigate('about')}>About FIRERVERSE</button>
      </footer>
    </div>
  );
}

export default App;
