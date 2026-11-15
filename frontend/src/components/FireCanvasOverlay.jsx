import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Color gradient interpolation matching the FIREVERSE UI legend:
// LOW: #f6d77a -> MODERATE: #f48d38 -> HIGH: #e54c28 -> PEAK: #8d2948
function getIntensityColor(ratio) {
  const clamped = Math.max(0, Math.min(1, ratio));
  if (clamped < 0.33) {
    const t = clamped / 0.33;
    const r = Math.round(246 + (244 - 246) * t);
    const g = Math.round(215 + (141 - 215) * t);
    const b = Math.round(122 + (56 - 122) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (clamped < 0.67) {
    const t = (clamped - 0.33) / 0.34;
    const r = Math.round(244 + (229 - 244) * t);
    const g = Math.round(141 + (76 - 141) * t);
    const b = Math.round(56 + (40 - 56) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const t = (clamped - 0.67) / 0.33;
    const r = Math.round(229 + (141 - 229) * t);
    const g = Math.round(76 + (41 - 76) * t);
    const b = Math.round(40 + (72 - 40) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

function FireCanvasOverlay({
  fires = [],
  grid = [],
  dailyGrids = {},
  selectedDate = '',
  aggregation = 'Grid cells',
  variable = 'Active fire detections',
  showFires = true,
  selectedFire = null,
  onSelectFire,
  // Additional rendering options
  layerMode = 'Markers',
  confidenceFilter = 0,
  frpFilter = 0,
}) {
  const map = useMap();
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // Keep latest props for callbacks without re‑creating functions
  const propsRef = useRef({
    fires,
    grid,
    dailyGrids,
    selectedDate,
    aggregation,
    variable,
    showFires,
    selectedFire,
    onSelectFire,
    layerMode,
    confidenceFilter,
    frpFilter,
  });

  // Sync ref when props change
  useEffect(() => {
    propsRef.current = {
      fires,
      grid,
      dailyGrids,
      selectedDate,
      aggregation,
      variable,
      showFires,
      selectedFire,
      onSelectFire,
      layerMode,
      confidenceFilter,
      frpFilter,
    };
  }, [fires, grid, dailyGrids, selectedDate, aggregation, variable, showFires, selectedFire, onSelectFire, layerMode, confidenceFilter, frpFilter]);

  // Initialise canvas layer
  useEffect(() => {
    if (!map) return;
    const canvas = L.DomUtil.create('canvas', 'leaflet-fire-canvas');
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '400';
    const pane = map.getPane('overlayPane');
    pane.appendChild(canvas);
    canvasRef.current = canvas;

    const updateSizeAndPosition = () => {
      if (!canvas || !map) return;
      const size = map.getSize();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size.x * dpr;
      canvas.height = size.y * dpr;
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas, topLeft);
    };

    const render = () => {
      if (!canvas || !map) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const size = map.getSize();
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.x, size.y);

      const {
        fires: curFires,
        grid: curGrid,
        dailyGrids: curDailyGrids,
        selectedDate: curDate,
        aggregation: curAgg,
        showFires: curShow,
        selectedFire: curSelected,
        layerMode: curLayerMode,
        confidenceFilter: curConf,
        frpFilter: curFrp,
      } = propsRef.current;

      if (!curShow) { ctx.restore(); return; }

      const zoom = map.getZoom();
      const bounds = map.getBounds().pad(0.15);
      const south = bounds.getSouth();
      const north = bounds.getNorth();
      const west = bounds.getWest();
      const east = bounds.getEast();

      // Apply confidence & FRP filters
      const filteredFires = curFires.filter(f => {
        const conf = Number(f.confidence || f.conf);
        const frp = Number(f.frp || 0);
        return conf >= curConf && frp >= curFrp;
      });

      const useHeatmap = curLayerMode === 'Heatmap';
      const useGrid = curAgg === 'Grid cells' && zoom < 6 && !useHeatmap;

      if (useHeatmap) {
        const activeGrid = (curDate && curDailyGrids[curDate]) ? curDailyGrids[curDate] : curGrid;
        let maxCount = 1;
        for (let i = 0; i < activeGrid.length; i++) {
          if (activeGrid[i].count > maxCount) maxCount = activeGrid[i].count;
        }
        const logMax = Math.log(maxCount + 1);
        const baseRadius = Math.max(5, Math.min(32, 4 + zoom * 3.5));
        for (let i = 0; i < activeGrid.length; i++) {
          const cell = activeGrid[i];
          if (cell.lat < south || cell.lat > north || cell.lon < west || cell.lon > east) continue;
          const pt = map.latLngToContainerPoint([cell.lat, cell.lon]);
          const norm = Math.log(cell.count + 1) / logMax;
          const radius = baseRadius * (0.7 + 0.6 * norm);
          const color = getIntensityColor(norm);
          const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);
          grad.addColorStop(0, color.replace('rgb', 'rgba').replace(')', ', 0.7)'));
          grad.addColorStop(0.5, color.replace('rgb', 'rgba').replace(')', ', 0.4)'));
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (useGrid) {
        const activeGrid = (curDate && curDailyGrids[curDate]) ? curDailyGrids[curDate] : curGrid;
        let maxVal = 1;
        for (let i = 0; i < activeGrid.length; i++) {
          if (activeGrid[i].count > maxVal) maxVal = activeGrid[i].count;
        }
        const logMax = Math.log(maxVal + 1);
        const baseRadius = Math.max(5, Math.min(32, 4 + zoom * 3.5));
        for (let i = 0; i < activeGrid.length; i++) {
          const cell = activeGrid[i];
          if (cell.lat < south || cell.lat > north || cell.lon < west || cell.lon > east) continue;
          const pt = map.latLngToContainerPoint([cell.lat, cell.lon]);
          const norm = Math.log(cell.count + 1) / logMax;
          const cellRadius = baseRadius * (0.7 + 0.6 * norm);
          const color = getIntensityColor(norm);
          const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, cellRadius);
          grad.addColorStop(0, color.replace('rgb', 'rgba').replace(')', ', 0.88)'));
          grad.addColorStop(0.5, color.replace('rgb', 'rgba').replace(')', ', 0.45)'));
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, cellRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const activeFires = curDate ? filteredFires.filter(f => f.acq_date === curDate) : filteredFires;
        const markerRadius = zoom >= 8 ? 6 : zoom >= 5 ? 4.5 : 3.5;
        for (let i = 0; i < activeFires.length; i++) {
          const f = activeFires[i];
          const lat = Number(f.latitude);
          const lon = Number(f.longitude);
          if (lat < south || lat > north || lon < west || lon > east) continue;
          const pt = map.latLngToContainerPoint([lat, lon]);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, markerRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#ff5a24';
          ctx.fill();
          ctx.lineWidth = 0.75;
          ctx.strokeStyle = '#ffad55';
          ctx.stroke();
        }
      }

      // Highlight selected fire
      if (curSelected) {
        const selLat = Number(curSelected.latitude);
        const selLon = Number(curSelected.longitude);
        if (selLat >= south && selLat <= north && selLon >= west && selLon <= east) {
          const pt = map.latLngToContainerPoint([selLat, selLon]);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ff9851';
          ctx.fill();
        }
      }

      ctx.restore();
    };

    const scheduleRender = () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(render);
    };

    const onMove = () => {
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas, topLeft);
      scheduleRender();
    };
    const onResize = () => { updateSizeAndPosition(); scheduleRender(); };

    const onMapClick = (e) => {
      const { fires: curFires, selectedDate: curDate, aggregation: curAgg, onSelectFire: curSelect } = propsRef.current;
      if (!curSelect) return;
      const clickPt = map.latLngToContainerPoint(e.latlng);
      const zoom = map.getZoom();
      const useGrid = curAgg === 'Grid cells' && zoom < 6;
      const activeFires = curDate ? curFires.filter(f => f.acq_date === curDate) : curFires;
      // Nearest fire within 16px
      let closest = null;
      let minDist = 16 * 16;
      for (let i = 0; i < activeFires.length; i++) {
        const f = activeFires[i];
        const pt = map.latLngToContainerPoint([f.latitude, f.longitude]);
        const dx = pt.x - clickPt.x;
        const dy = pt.y - clickPt.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < minDist) { minDist = d2; closest = f; }
      }
      if (closest) { curSelect(closest); return; }

      if (useGrid) {
        const curDailyGrids = propsRef.current.dailyGrids;
        const curGrid = propsRef.current.grid;
        const activeGrid = (curDate && curDailyGrids[curDate]) ? curDailyGrids[curDate] : curGrid;
        let bestCell = null;
        let bestDist = 24 * 24;
        for (let i = 0; i < activeGrid.length; i++) {
          const c = activeGrid[i];
          const pt = map.latLngToContainerPoint([c.lat, c.lon]);
          const dx = pt.x - clickPt.x;
          const dy = pt.y - clickPt.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestDist) { bestDist = d2; bestCell = c; }
        }
        if (bestCell) {
          const rep = curFires.find(f => Number(f.latitude) === bestCell.lat && Number(f.longitude) === bestCell.lon);
          if (rep) curSelect(rep);
        }
      }
    };

    // Initial setup
    updateSizeAndPosition();
    render();
    map.on('move', onMove);
    map.on('zoom', onMove);
    map.on('resize', onResize);
    map.on('click', onMapClick);

    return () => {
      map.off('move', onMove);
      map.off('zoom', onMove);
      map.off('resize', onResize);
      map.off('click', onMapClick);
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [map]);

  // Force canvas redraw when data changes
  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, [fires, grid, dailyGrids, selectedDate, aggregation, showFires, selectedFire, layerMode, confidenceFilter, frpFilter]);

  return null;
}

export default FireCanvasOverlay;
