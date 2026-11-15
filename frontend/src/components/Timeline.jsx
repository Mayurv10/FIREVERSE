import React, { useEffect } from 'react'
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react'

function Timeline({
  date,
  onDateChange,
  dailyActivity = [],
  playing = false,
  onTogglePlay
}) {
  const currentIndex = Math.max(
    dailyActivity.findIndex((item) => item.fullDate === date),
    0
  )

  // Automatic timeline playback when playing is true
  useEffect(() => {
    if (!playing || dailyActivity.length <= 1) return

    const interval = setInterval(() => {
      onDateChange((prevDate) => {
        const idx = dailyActivity.findIndex((item) => item.fullDate === prevDate)
        const nextIdx = (idx + 1) % dailyActivity.length
        return dailyActivity[nextIdx]?.fullDate || prevDate
      })
    }, 1500)

    return () => clearInterval(interval)
  }, [playing, dailyActivity, onDateChange])

  const handlePrev = () => {
    if (currentIndex > 0) {
      onDateChange(dailyActivity[currentIndex - 1].fullDate)
    }
  }

  const handleNext = () => {
    if (currentIndex < dailyActivity.length - 1) {
      onDateChange(dailyActivity[currentIndex + 1].fullDate)
    }
  }

  const handleSliderChange = (e) => {
    const selected = dailyActivity[Number(e.target.value)]
    if (selected) {
      onDateChange(selected.fullDate)
    }
  }

  return (
    <div className="timeline">
      <div className="timeline-controls">
        <button
          aria-label="Previous date"
          onClick={handlePrev}
          disabled={currentIndex <= 0}
        >
          <SkipBack size={16} />
        </button>

        <button
          className="play-button"
          onClick={onTogglePlay}
          aria-label={playing ? 'Pause timeline' : 'Play timeline'}
          disabled={dailyActivity.length === 0}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <button
          aria-label="Next date"
          onClick={handleNext}
          disabled={currentIndex >= dailyActivity.length - 1}
        >
          <SkipForward size={16} />
        </button>
      </div>

      <div className="timeline-content">
        <div className="timeline-title">
          <strong>{date || 'Loading date...'}</strong>
          <span>HISTORICAL FIRE EXPLORATION</span>
        </div>

        <input
          type="range"
          min="0"
          max={Math.max(dailyActivity.length - 1, 0)}
          value={currentIndex}
          className="timeline-slider"
          aria-label="Select fire observation date"
          disabled={dailyActivity.length === 0}
          onChange={handleSliderChange}
        />

        <div className="timeline-years">
          {dailyActivity.map((item) => (
            <span key={item.fullDate}>
              {item.fullDate.slice(5)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default React.memo(Timeline)
