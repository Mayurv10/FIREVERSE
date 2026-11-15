// Format NASA acquisition time as HH:MM UTC
export function formatAcquisitionTime(time) {
  if (time === null || time === undefined || time === '') {
    return 'N/A'
  }

  const value = String(time).padStart(4, '0')
  return `${value.slice(0, 2)}:${value.slice(2, 4)} UTC`
}

// Convert NASA confidence codes into readable labels
export function formatConfidence(confidence) {
  const labels = {
    l: 'Low',
    n: 'Nominal',
    h: 'High'
  }

  return (
    labels[String(confidence).toLowerCase()] ||
    confidence ||
    'N/A'
  )
}

// Format numbers with thousand separators
export function formatNumber(val) {
  if (val === null || val === undefined || isNaN(val)) {
    return '0'
  }
  return Number(val).toLocaleString()
}
