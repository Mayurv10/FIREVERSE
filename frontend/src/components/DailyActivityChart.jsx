import React, { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts'
import AnalyticsPanel from './AnalyticsPanel'

function DailyActivityChart({
  dailyCounts = [],
  totalCount = 0,
  loading = false,
  error = null
}) {
  // Convert backend daily_counts directly into Recharts data.
  // Strictly relies on daily_counts, NOT on the fires array (Section 5).
  const chartData = useMemo(() => {
    if (!Array.isArray(dailyCounts) || dailyCounts.length === 0) {
      return []
    }

    return dailyCounts.map((item) => {
      const dateStr = String(item.date || '')
      // Date format MM-DD for X axis, full date YYYY-MM-DD for tooltip
      const dayLabel = dateStr.length >= 10 ? dateStr.slice(5) : dateStr
      return {
        day: dayLabel,
        fires: Number(item.count) || 0,
        fullDate: dateStr
      }
    })
  }, [dailyCounts])

  return (
    <AnalyticsPanel
      title="Daily fire activity"
      subtitle="NASA FIRMS · Actual daily detections"
    >
      <div className="chart-area">
        {loading ? (
          <p>Loading NASA fire activity...</p>
        ) : error ? (
          <p>Unable to load NASA data.</p>
        ) : chartData.length === 0 ? (
          <p>No daily fire activity available.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{
                top: 10,
                right: 10,
                left: 0,
                bottom: 0
              }}
            >
              <CartesianGrid
                stroke="#34383d"
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="day"
                stroke="#858b93"
                fontSize={10}
              />

              <YAxis
                stroke="#858b93"
                fontSize={10}
                width={45}
                tickFormatter={(value) => value.toLocaleString()}
              />

              <Tooltip
                labelFormatter={(label, payload) =>
                  payload?.[0]?.payload?.fullDate || label
                }
                formatter={(value) => [
                  Number(value).toLocaleString(),
                  'Fire detections'
                ]}
                contentStyle={{
                  background: '#202328',
                  border: '1px solid #555',
                  color: '#fff'
                }}
              />

              <Area
                type="monotone"
                dataKey="fires"
                name="Fire detections"
                stroke="#ff9851"
                fill="#ff7839"
                fillOpacity={0.22}
                connectNulls
                isAnimationActive={false}
                activeDot={{
                  r: 5,
                  stroke: '#ffffff',
                  strokeWidth: 2
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="chart-legend">
        <span className="legend-dot orange" />
        NASA fire detections
      </div>

      <div className="chart-legend">
        <small>
          {loading
            ? 'Loading NASA data...'
            : error
              ? 'Unable to load NASA data'
              : `${totalCount.toLocaleString()} observations analysed`}
        </small>
      </div>
    </AnalyticsPanel>
  )
}

export default React.memo(DailyActivityChart)
