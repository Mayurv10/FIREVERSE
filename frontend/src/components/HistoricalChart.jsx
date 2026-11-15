import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts'
import AnalyticsPanel from './AnalyticsPanel'

const historicalData = [
  { year: '2005', fires: 35 },
  { year: '2008', fires: 55 },
  { year: '2011', fires: 42 },
  { year: '2014', fires: 75 },
  { year: '2017', fires: 60 },
  { year: '2020', fires: 90 },
  { year: '2023', fires: 68 },
  { year: '2026', fires: 105 }
]

function HistoricalChart() {
  return (
    <AnalyticsPanel
      title="Historical fire activity"
      subtitle="Illustrative annual comparison · Sample data"
    >
      <div className="chart-area">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={historicalData}>
            <CartesianGrid stroke="#34383d" strokeDasharray="3 3" />
            <XAxis dataKey="year" stroke="#858b93" fontSize={9} />
            <YAxis stroke="#858b93" fontSize={10} width={30} />
            <Tooltip
              contentStyle={{
                background: '#202328',
                border: '1px solid #555',
                color: '#fff'
              }}
            />
            <Bar dataKey="fires" fill="#d98743" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </AnalyticsPanel>
  )
}

export default React.memo(HistoricalChart)
