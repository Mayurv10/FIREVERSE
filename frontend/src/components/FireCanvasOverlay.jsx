import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

// Color gradient interpolation matching the FIREVERSE UI legend:
// LOW: #f6d77a -> MODERATE: #f48d38 -> HIGH: #e54c28 -> PEAK: #8d2948
function getIntensityColor(ratio) {
  const clamped = Math.max(0, Math.min(1, ratio))

  if (clamped < 0.33) {
    const t = clamped / 0.33
    // #f6d77a (246, 215, 122) -> #f48d38 (244, 141, 56)
    const r = Math.round(246 + (244 - 246) * t)
    const g = Math.round(215 + (141 - 215) * t)
    const b = Math.round(122 + (56 - 122) * t)
    return `rgb(${r}, ${g}, ${b})`
  } else if (clamped < 0.67) {
    const t = (clamped - 0.33) / 0.34
    // #f48d38 (244, 141, 56) -> #e54c28 (229, 76, 40)
    const r = Math.round(244 + (229 - 244) * t)
    const g = Math.round(141 + (76 - 141) * t)
    const b = Math.round(56 + (40 - 56) * t)
    return `rgb(${r}, ${g}, ${b})`
  } else {
    const t = (clamped - 0.67) / 0.33
    // #e54c28 (229, 76, 40) -> #8d2948 (141, 41, 72)
    const r = Math.round(229 + (141 - 229) * t)
    const g = Math.round(76 + (41 - 76) * t)
    const b = Math.round(40 + (72 - 40) * t)
    return `rgb(${r}, ${g}, ${b})`
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
  // New props for rendering mode and filters
  layerMode = 'Markers',
  confidenceFilter = 0,
  frpFilter = 0,
}) {
  const map = useMap()
  const canvasRef = useRef(null)
  const animFrameRef = useRef(null)

  // Keep latest props in a ref for event handlers and RAF callbacks without rebinding
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
  })

  // Update propsRef whenever props change
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
    }
  }, [fires, grid, dailyGrids, selectedDate, aggregation, variable, showFires, selectedFire, onSelectFire, layerMode, confidenceFilter, frpFilter])

  // Setup Leaflet Canvas Layer on mount
  useEffect(() => {
    if (!map) return

    const canvas = L.DomUtil.create('canvas', 'leaflet-fire-canvas')
    canvas.style.position = 'absolute'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '400'

    const pane = map.getPane('overlayPane')
    pane.appendChild(canvas)
    canvasRef.current = canvas

    function updateSizeAndPosition() {
      if (!canvas || !map) return
      const size = map.getSize()
      const dpr = window.devicePixelRatio || 1

      canvas.width = size.x * dpr
      canvas.height = size.y * dpr
      canvas.style.width = `${size.x}px`
      canvas.style.height = `${size.y}px`

      const topLeft = map.containerPointToLayerPoint([0, 0])
      L.DomUtil.setPosition(canvas, topLeft)
    }

    function render() {
      if (!canvas || !map) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const size = map.getSize()

      ctx.save()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size.x, size.y)

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
      } = propsRef.current

      if (!curShow) {
        ctx.restore()
        return
      }

      const zoom = map.getZoom()
      const bounds = map.getBounds().pad(0.15)
      const south = bounds.getSouth()
      const north = bounds.getNorth()
      const west = bounds.getWest()
      const east = bounds.getEast()

      // Apply confidence and FRP filters to fire list
      const filteredFires = curFires.filter(f => {
        const conf = Number(f.confidence || f.conf)
        const frp = Number(f.frp || 0)
        return conf >= curConf && frp >= curFrp
      })

      // Determine rendering mode
      const useHeatmap = curLayerMode === 'Heatmap'
      const useGrid = curAgg === 'Grid cells' && zoom < 6 && !useHeatmap

      if (useHeatmap) {
        // Heatmap: aggregate fires into a simple density grid (reuse server‑side grid if available)
        const activeGrid = (curDate && curDailyGrids[curDate]) ? curDailyGrids[curDate] : curGrid
        // Find max density for normalization
        let maxCount = 1
        for (let i = 0; i < activeGrid.length; i++) {
          if (activeGrid[i].count > maxCount) maxCount = activeGrid[i].count
        }
        const logMax = Math.log(maxCount + 1)
        const baseRadius = Math.max(5, Math.min(32, 4 + zoom * 3.5))
        for (let i = 0; i < activeGrid.length; i++) {
          const cell = activeGrid[i]
          if (cell.lat < south || cell.lat > north || cell.lon < west || cell.lon > east) continue
          const pt = map.latLngToContainerPoint([cell.lat, cell.lon])
          const norm = Math.log(cell.count + 1) / logMax
          const radius = baseRadius * (0.7 + 0.6 * norm)
          const color = getIntensityColor(norm)
          const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius)
          grad.addColorStop(0, color.replace('rgb', 'rgba').replace(')', ', 0.7)'))
          grad.addColorStop(0.5, color.replace('rgb', 'rgba').replace(')', ', 0.4)'))
          grad.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2)
          ctx.fill()
        }
      } else if (useGrid) {
        // Existing grid rendering (same as before)
        const activeGrid = (curDate && curDailyGrids[curDate]) ? curDailyGrids[curDate] : curGrid
        let maxVal = 1
        for (let i = 0; i < activeGrid.length; i++) {
          if (activeGrid[i].count > maxVal) maxVal = activeGrid[i].count
        }
        const logMax = Math.log(maxVal + 1)
        const baseRadius = Math.max(5, Math.min(32, 4 + zoom * 3.5))
        for (let i = 0; i < activeGrid.length; i++) {
          const cell = activeGrid[i]
          if (cell.lat < south || cell.lat > north || cell.lon < west || cell.lon > east) continue
          const pt = map.latLngToContainerPoint([cell.lat, cell.lon])
          const norm = Math.log(cell.count + 1) / logMax
          const cellRadius = baseRadius * (0.7 + 0.6 * norm)
          const color = getIntensityColor(norm)
          const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, cellRadius)
          grad.addColorStop(0, color.replace('rgb', 'rgba').replace(')', ', 0.88)'))
          grad.addColorStop(0.5, color.replace('rgb', 'rgba').replace(')', ', 0.45)'))
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, cellRadius, 0, Math.PI * 2)
          ctx.fill()
        }
      } else {
        // Individual fire markers (filtered)
        const activeFires = curDate ? filteredFires.filter(f => f.acq_date === curDate) : filteredFires
        const markerRadius = zoom >= 8 ? 6 : zoom >= 5 ? 4.5 : 3.5
        for (let i = 0; i < activeFires.length; i++) {
          const f = activeFires[i]
          const lat = Number(f.latitude)
          const lon = Number(f.longitude)
          if (lat < south || lat > north || lon < west || lon > east) continue
          const pt = map.latLngToContainerPoint([lat, lon])
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, markerRadius, 0, Math.PI * 2)
          ctx.fillStyle = '#ff5a24'
          ctx.fill()
          ctx.lineWidth = 0.75
          ctx.strokeStyle = '#ffad55'
          ctx.stroke()
        }
      }

      // Highlight selected fire (same as before)
      if (curSelected) {
        const selLat = Number(curSelected.latitude)
        const selLon = Number(curSelected.longitude)
        if (selLat >= south && selLat <= north && selLon >= west && selLon <= east) {
          const pt = map.latLngToContainerPoint([selLat, selLon])
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2)
          ctx.lineWidth = 2.5
          ctx.strokeStyle = '#ffffff'
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2)
          ctx.fillStyle = '#ff9851'
          ctx.fill()
        }
      }

      ctx.restore()
    }

    function scheduleRender() {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = requestAnimationFrame(render)
    }

    function onMove() {
      const topLeft = map.containerPointToLayerPoint([0, 0])
      L.DomUtil.setPosition(canvas, topLeft)
      scheduleRender()
    }

    function onResize() {
      updateSizeAndPosition()
      scheduleRender()
    }

    // Interaction handling – same as before but using filtered fires
    function onMapClick(e) {
      const {
        fires: curFires,
        grid: curGrid,
        dailyGrids: curDailyGrids,
        selectedDate: curDate,
        aggregation: curAgg,
        showFires: curShow,
        onSelectFire: curSelectHandler,
        layerMode: curLayerMode,
        confidenceFilter: curConf,
        frpFilter: curFrp,
      } = propsRef.current

      if (!curShow || !curSelectHandler) return

      const clickPt = map.latLngToContainerPoint(e.latlng)
      const zoom = map.getZoom()
      const useGrid = curAgg === 'Grid cells' && zoom < 6 && curLayerMode !== 'Heatmap'

      // Apply filters to fire list for click detection
      const filtered = curFires.filter(f => {
        const conf = Number(f.confidence || f.conf)
        const frp = Number(f.frp || 0)
        return conf >= curConf && frp >= curFrp
      })

      const activeFires = curDate ? filtered.filter(f => f.acq_date === curDate) : filtered

      let closestFire = null
      let minFireDistSq = 16 * 16
      for (let i = 0; i < activeFires.length; i++) {
        const f = activeFires[i]
        const pt = map.latLngToContainerPoint([f.latitude, f.longitude])
        const dx = pt.x - clickPt.x
        const dy = pt.y - clickPt.y
        const distSq = dx * dx + dy * dy
        if (distSq < minFireDistSq) {
          minFireDistSq = distSq
          closestFire = f
        }
      }
      if (closestFire) {
        curSelectHandler(closestFire)
        return
      }

      // Grid click fallback (heatmap or grid)
      if (useGrid) {
        const activeGrid = (curDate && curDailyGrids[curDate]) ? curDailyGrids[curDate] : curGrid
        let closestCell = null
        let minCellDistSq = 24 * 24
        for (let i = 0; i < activeGrid.length; i++) {
          const c = activeGrid[i]
          const pt = map.latLngToContainerPoint([c.lat, c.lon])
          const dx = pt.x - clickPt.x
          const dy = pt.y - clickPt.y
          const distSq = dx * dx + dy * dy
          if (distSq < minCellDistSq) {
            minCellDistSq = distSq
            closestCell = c
          }
        }
        if (closestCell) {
          // pick a representative fire (first matching cell) – fallback to none
          const rep = curFires.find(f => Number(f.latitude) === closestCell.lat && Number(f.longitude) === closestCell.lon)
          if (rep) curSelectHandler(rep)
        }
      }
    }

    // Initial sizing and render
    updateSizeAndPosition()
    render()

    map.on('move', onMove)
    map.on('zoom', onMove)
    map.on('resize', onResize)
    map.on('click', onMapClick)

    return () => {
      map.off('move', onMove)
      map.off('zoom', onMove)
      map.off('resize', onResize)
      map.off('click', onMapClick)
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas)
    }
  }, [map])

  // Update canvas when relevant props change (will trigger scheduleRender via map events)
  useEffect(() => {
    // Force a render on data change
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }
  }, [fires, grid, dailyGrids, selectedDate, aggregation, showFires, selectedFire, layerMode, confidenceFilter, frpFilter])

  return null
}

  fires = [],
  grid = [],
  dailyGrids = {},
  selectedDate = '',
  aggregation = 'Grid cells',
  variable = 'Active fire detections',
  showFires = true,
  selectedFire = null,
  onSelectFire
}) {
  const map = useMap()
  const canvasRef = useRef(null)
  const animFrameRef = useRef(null)

  // Keep latest props in a ref for event handlers and RAF callbacks without rebinding
  const propsRef = useRef({
    fires,
    grid,
    dailyGrids,
    selectedDate,
    aggregation,
    variable,
    showFires,
    selectedFire,
    onSelectFire
  })

  // Setup Leaflet Canvas Layer on mount
  useEffect(() => {
    if (!map) return

    const canvas = L.DomUtil.create('canvas', 'leaflet-fire-canvas')
    canvas.style.position = 'absolute'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '400'

    const pane = map.getPane('overlayPane')
    pane.appendChild(canvas)
    canvasRef.current = canvas

    function updateSizeAndPosition() {
      if (!canvas || !map) return
      const size = map.getSize()
      const dpr = window.devicePixelRatio || 1

      canvas.width = size.x * dpr
      canvas.height = size.y * dpr
      canvas.style.width = `${size.x}px`
      canvas.style.height = `${size.y}px`

      const topLeft = map.containerPointToLayerPoint([0, 0])
      L.DomUtil.setPosition(canvas, topLeft)
    }

    function render() {
      if (!canvas || !map) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const size = map.getSize()

      ctx.save()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size.x, size.y)

      const {
        fires: curFires,
        grid: curGrid,
        dailyGrids: curDailyGrids,
        selectedDate: curDate,
        aggregation: curAgg,
        showFires: curShow,
        selectedFire: curSelected
      } = propsRef.current

      if (!curShow) {
        ctx.restore()
        return
      }

      const zoom = map.getZoom()
      const bounds = map.getBounds().pad(0.15)
      const south = bounds.getSouth()
      const north = bounds.getNorth()
      const west = bounds.getWest()
      const east = bounds.getEast()

      // Determine rendering mode:
      // Global zoom (< 6) or 'Grid cells' mode uses server-side spatial grid
      // Local zoom (>= 6) or 'Regions' mode renders individual high-resolution observations
      const useGrid = curAgg === 'Grid cells' && zoom < 6

      if (useGrid) {
        // Pick date-specific grid cells if available, else full grid
        const activeGrid = (curDate && curDailyGrids[curDate])
          ? curDailyGrids[curDate]
          : curGrid

        // Find max count or max FRP for normalization
        let maxVal = 1
        for (let i = 0; i < activeGrid.length; i++) {
          if (activeGrid[i].count > maxVal) {
            maxVal = activeGrid[i].count
          }
        }
        const logMax = Math.log(maxVal + 1)

        // Scaling radius by zoom
        const baseRadius = Math.max(5, Math.min(32, 4 + zoom * 3.5))

        // Draw grid cells with radial intensity gradient
        for (let i = 0; i < activeGrid.length; i++) {
          const cell = activeGrid[i]
          if (cell.lat < south || cell.lat > north || cell.lon < west || cell.lon > east) {
            continue
          }

          const pt = map.latLngToContainerPoint([cell.lat, cell.lon])
          const norm = Math.log(cell.count + 1) / logMax
          const cellRadius = baseRadius * (0.7 + 0.6 * norm)
          const color = getIntensityColor(norm)

          // Glowing intensity gradient
          const grad = ctx.createRadialGradient(
            pt.x, pt.y, 0,
            pt.x, pt.y, cellRadius
          )
          grad.addColorStop(0, color.replace('rgb', 'rgba').replace(')', ', 0.88)'))
          grad.addColorStop(0.5, color.replace('rgb', 'rgba').replace(')', ', 0.45)'))
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)')

          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, cellRadius, 0, Math.PI * 2)
          ctx.fill()
        }
      } else {
        // Individual fire markers
        const activeFires = curDate
          ? curFires.filter((f) => f.acq_date === curDate)
          : curFires

        const markerRadius = zoom >= 8 ? 6 : zoom >= 5 ? 4.5 : 3.5

        for (let i = 0; i < activeFires.length; i++) {
          const f = activeFires[i]
          const lat = Number(f.latitude)
          const lon = Number(f.longitude)

          if (lat < south || lat > north || lon < west || lon > east) {
            continue
          }

          const pt = map.latLngToContainerPoint([lat, lon])

          ctx.beginPath()
          ctx.arc(pt.x, pt.y, markerRadius, 0, Math.PI * 2)
          ctx.fillStyle = '#ff5a24'
          ctx.fill()
          ctx.lineWidth = 0.75
          ctx.strokeStyle = '#ffad55'
          ctx.stroke()
        }
      }

      // Draw highlight ring on selected fire
      if (curSelected) {
        const selLat = Number(curSelected.latitude)
        const selLon = Number(curSelected.longitude)
        if (selLat >= south && selLat <= north && selLon >= west && selLon <= east) {
          const pt = map.latLngToContainerPoint([selLat, selLon])

          // Outer glowing ring
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2)
          ctx.lineWidth = 2.5
          ctx.strokeStyle = '#ffffff'
          ctx.stroke()

          // Center solid point
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2)
          ctx.fillStyle = '#ff9851'
          ctx.fill()
        }
      }

      ctx.restore()
    }

    function scheduleRender() {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
      animFrameRef.current = requestAnimationFrame(render)
    }

    function onMove() {
      const topLeft = map.containerPointToLayerPoint([0, 0])
      L.DomUtil.setPosition(canvas, topLeft)
      scheduleRender()
    }

    function onResize() {
      updateSizeAndPosition()
      scheduleRender()
    }

    // Interactive map click detection
    function onMapClick(e) {
      const {
        fires: curFires,
        grid: curGrid,
        dailyGrids: curDailyGrids,
        selectedDate: curDate,
        aggregation: curAgg,
        showFires: curShow,
        onSelectFire: curSelectHandler
      } = propsRef.current

      if (!curShow || !curSelectHandler) return

      const clickPt = map.latLngToContainerPoint(e.latlng)
      const zoom = map.getZoom()
      const useGrid = curAgg === 'Grid cells' && zoom < 6

      // First check individual fires (within 16px screen tolerance)
      const activeFires = curDate
        ? curFires.filter((f) => f.acq_date === curDate)
        : curFires

      let closestFire = null
      let minFireDistSq = 16 * 16

      for (let i = 0; i < activeFires.length; i++) {
        const f = activeFires[i]
        const pt = map.latLngToContainerPoint([f.latitude, f.longitude])
        const dx = pt.x - clickPt.x
        const dy = pt.y - clickPt.y
        const distSq = dx * dx + dy * dy

        if (distSq < minFireDistSq) {
          minFireDistSq = distSq
          closestFire = f
        }
      }

      if (closestFire) {
        curSelectHandler(closestFire)
        return
      }

      // If in grid mode, find closest grid cell and pick a representative fire in it
      if (useGrid) {
        const activeGrid = (curDate && curDailyGrids[curDate])
          ? curDailyGrids[curDate]
          : curGrid

        let closestCell = null
        let minCellDistSq = 24 * 24

        for (let i = 0; i < activeGrid.length; i++) {
          const c = activeGrid[i]
          const pt = map.latLngToContainerPoint([c.lat, c.lon])
          const dx = pt.x - clickPt.x
          const dy = pt.y - clickPt.y
          const distSq = dx * dx + dy * dy

          if (distSq < minCellDistSq) {
            minCellDistSq = distSq
            closestCell = c
          }
        }

        if (closestCell) {
          // Find closest fire observation near cell center
          let bestFire = null
          let bestDist = Infinity

          for (let i = 0; i < curFires.length; i++) {
            const f = curFires[i]
            const dLat = f.latitude - closestCell.lat
            const dLon = f.longitude - closestCell.lon
            const d = dLat * dLat + dLon * dLon
            if (d < bestDist) {
              bestDist = d
              bestFire = f
            }
          }

          if (bestFire) {
            curSelectHandler(bestFire)
            return
          }
        }
      }

      // If click was in empty space, deselect
      curSelectHandler(null)
    }

    map.on('move', onMove)
    map.on('moveend', scheduleRender)
    map.on('zoomend', scheduleRender)
    map.on('resize', onResize)
    map.on('click', onMapClick)

    updateSizeAndPosition()
    scheduleRender()

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
      map.off('move', onMove)
      map.off('moveend', scheduleRender)
      map.off('zoomend', scheduleRender)
      map.off('resize', onResize)
      map.off('click', onMapClick)

      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas)
      }
    }
  }, [map])

  // Trigger canvas redraw whenever data or display settings change
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
      onSelectFire
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }
    animFrameRef.current = requestAnimationFrame(() => {
      if (!canvasRef.current || !map) return
      const ctx = canvasRef.current.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const size = map.getSize()

      ctx.save()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size.x, size.y)

      const {
        fires: curFires,
        grid: curGrid,
        dailyGrids: curDailyGrids,
        selectedDate: curDate,
        aggregation: curAgg,
        showFires: curShow,
        selectedFire: curSelected
      } = propsRef.current

      if (!curShow) {
        ctx.restore()
        return
      }

      const zoom = map.getZoom()
      const bounds = map.getBounds().pad(0.15)
      const south = bounds.getSouth()
      const north = bounds.getNorth()
      const west = bounds.getWest()
      const east = bounds.getEast()

      const useGrid = curAgg === 'Grid cells' && zoom < 6

      if (useGrid) {
        const activeGrid = (curDate && curDailyGrids[curDate])
          ? curDailyGrids[curDate]
          : curGrid

        let maxVal = 1
        for (let i = 0; i < activeGrid.length; i++) {
          if (activeGrid[i].count > maxVal) {
            maxVal = activeGrid[i].count
          }
        }
        const logMax = Math.log(maxVal + 1)
        const baseRadius = Math.max(5, Math.min(32, 4 + zoom * 3.5))

        for (let i = 0; i < activeGrid.length; i++) {
          const cell = activeGrid[i]
          if (cell.lat < south || cell.lat > north || cell.lon < west || cell.lon > east) {
            continue
          }

          const pt = map.latLngToContainerPoint([cell.lat, cell.lon])
          const norm = Math.log(cell.count + 1) / logMax
          const cellRadius = baseRadius * (0.7 + 0.6 * norm)
          const color = getIntensityColor(norm)

          const grad = ctx.createRadialGradient(
            pt.x, pt.y, 0,
            pt.x, pt.y, cellRadius
          )
          grad.addColorStop(0, color.replace('rgb', 'rgba').replace(')', ', 0.88)'))
          grad.addColorStop(0.5, color.replace('rgb', 'rgba').replace(')', ', 0.45)'))
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)')

          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, cellRadius, 0, Math.PI * 2)
          ctx.fill()
        }
      } else {
        const activeFires = curDate
          ? curFires.filter((f) => f.acq_date === curDate)
          : curFires

        const markerRadius = zoom >= 8 ? 6 : zoom >= 5 ? 4.5 : 3.5

        for (let i = 0; i < activeFires.length; i++) {
          const f = activeFires[i]
          const lat = Number(f.latitude)
          const lon = Number(f.longitude)

          if (lat < south || lat > north || lon < west || lon > east) {
            continue
          }

          const pt = map.latLngToContainerPoint([lat, lon])

          ctx.beginPath()
          ctx.arc(pt.x, pt.y, markerRadius, 0, Math.PI * 2)
          ctx.fillStyle = '#ff5a24'
          ctx.fill()
          ctx.lineWidth = 0.75
          ctx.strokeStyle = '#ffad55'
          ctx.stroke()
        }
      }

      if (curSelected) {
        const selLat = Number(curSelected.latitude)
        const selLon = Number(curSelected.longitude)
        if (selLat >= south && selLat <= north && selLon >= west && selLon <= east) {
          const pt = map.latLngToContainerPoint([selLat, selLon])

          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2)
          ctx.lineWidth = 2.5
          ctx.strokeStyle = '#ffffff'
          ctx.stroke()

          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2)
          ctx.fillStyle = '#ff9851'
          ctx.fill()
        }
      }

      ctx.restore()
    })
  }, [fires, grid, dailyGrids, selectedDate, aggregation, variable, showFires, selectedFire, map])

  // Returns null because this component mounts directly into Leaflet's canvas, creating 0 React DOM nodes!
  return null
}

export default FireCanvasOverlay
