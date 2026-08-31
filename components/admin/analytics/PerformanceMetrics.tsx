'use client'

import { useState } from 'react'
import { ArrowUpDown, Star } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'

interface PerformanceRecord {
  id: string
  name: string
  total_trips: number
  average_rating?: number
  revenue_generated?: number
}

interface PerformanceMetricsProps {
  data: PerformanceRecord[]
  loading?: boolean
  title?: string
}

type SortKey = 'name' | 'total_trips' | 'average_rating' | 'revenue_generated'
type SortDir = 'asc' | 'desc'

/**
 * Hoisted to module scope: defining it inside `PerformanceMetrics` gave the
 * component a fresh identity on every render, so React unmounted and remounted
 * each header instead of updating it.
 */
function SortHeader({
  label,
  colKey,
  activeKey,
  onSort,
}: {
  label: string
  colKey: SortKey
  activeKey: SortKey
  onSort: (key: SortKey) => void
}) {
  return (
    <button
      className="flex items-center gap-1"
      onClick={() => onSort(colKey)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, color: 'inherit' }}
    >
      {label}
      <ArrowUpDown size={12} className={activeKey === colKey ? 'text-primary' : 'text-muted-foreground'} />
    </button>
  )
}

export function PerformanceMetrics({
  data,
  loading,
  title = 'Performance Metrics',
}: PerformanceMetricsProps) {
  const [sortKey, setSortKey] = useState<SortKey>('total_trips')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...data].sort((a, b) => {
    const aVal = a[sortKey] ?? 0
    const bVal = b[sortKey] ?? 0
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal)
    }
    return sortDir === 'asc'
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number)
  })



  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{title}</span>
      </div>
      <DataTable
        data={sorted}
        loading={loading}
        rowKey="id"
        emptyMessage="No performance data available"
        columns={[
          {
            key: 'name',
            label: <SortHeader label="Name" colKey="name" activeKey={sortKey} onSort={handleSort} />,
            render: (r: PerformanceRecord) => (
              <span className="font-medium">{r.name}</span>
            ),
          },
          {
            key: 'total_trips',
            label: <SortHeader label="Total Trips" colKey="total_trips" activeKey={sortKey} onSort={handleSort} />,
            render: (r: PerformanceRecord) => (
              <span className="font-semibold">{r.total_trips}</span>
            ),
          },
          {
            key: 'average_rating',
            label: <SortHeader label="Avg Rating" colKey="average_rating" activeKey={sortKey} onSort={handleSort} />,
            render: (r: PerformanceRecord) =>
              r.average_rating ? (
                <span className="inline-flex items-center gap-1">
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  {Number(r.average_rating).toFixed(1)}
                </span>
              ) : (
                '—'
              ),
          },
          {
            key: 'revenue_generated',
            label: <SortHeader label="Revenue" colKey="revenue_generated" activeKey={sortKey} onSort={handleSort} />,
            render: (r: PerformanceRecord) =>
              r.revenue_generated != null ? (
                <span className="font-mono">${r.revenue_generated.toLocaleString()}</span>
              ) : (
                '—'
              ),
          },
        ]}
      />
    </div>
  )
}
