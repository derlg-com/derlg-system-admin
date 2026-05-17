'use client'

import { useState, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  label: React.ReactNode
  render?: (row: T) => React.ReactNode
  width?: string
  sortable?: boolean
}

export interface FilterConfig {
  key: string
  label: string
  options: { label: string; value: string }[]
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  rowKey?: string | ((row: T) => string)
  onRowClick?: (row: T) => void
  pageSize?: number
  actions?: (row: T) => React.ReactNode
  filters?: FilterConfig[]
  activeFilters?: Record<string, string[]>
  onFilter?: (key: string, values: string[]) => void
  onSort?: (key: string, direction: 'asc' | 'desc') => void
  onPageChange?: (page: number) => void
  totalCount?: number
  currentPage?: number
}

export function DataTable<T extends Record<string, any> = Record<string, any>>({
  columns,
  data,
  loading,
  emptyMessage = 'No records found',
  rowKey,
  onRowClick,
  pageSize = 20,
  actions,
  filters,
  activeFilters,
  onFilter,
  onSort,
  onPageChange,
  totalCount,
  currentPage: controlledPage,
}: DataTableProps<T>) {
  const [internalPage, setInternalPage] = useState(1)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const page = controlledPage ?? internalPage
  const setPage = onPageChange
    ? (p: number) => onPageChange(p)
    : setInternalPage

  const sorted = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  const totalItems = totalCount ?? sorted.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(page, totalPages)

  const paged = useMemo(() => {
    return sorted.slice((safePage - 1) * pageSize, safePage * pageSize)
  }, [sorted, safePage, pageSize])

  const handleSort = (key: string) => {
    const newDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc'
    if (sortKey === key) {
      setSortDir(newDir)
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    onSort?.(key, newDir)
    if (!controlledPage) setInternalPage(1)
  }

  const getKey = (row: T, i: number): string => {
    if (!rowKey) return String(i)
    if (typeof rowKey === 'function') return rowKey(row)
    return String((row as Record<string, any>)[rowKey] ?? i)
  }

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey) return <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
    if (sortDir === 'asc') return <ArrowUp className="size-3.5 text-primary" />
    return <ArrowDown className="size-3.5 text-primary" />
  }

  if (loading) {
    return (
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {columns.map((col) => (
                <TableHead key={col.key} style={{ width: col.width }}>
                  {col.label}
                </TableHead>
              ))}
              {actions && <TableHead className="w-[120px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <Skeleton className="h-4 w-[70%]" />
                  </TableCell>
                ))}
                {actions && (
                  <TableCell>
                    <Skeleton className="h-7 w-20" />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border py-16 text-center">
        <p className="text-sm font-medium text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    style={{ width: col.width }}
                    className={cn(
                      'whitespace-nowrap',
                      col.sortable && 'cursor-pointer select-none'
                    )}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1.5">
                      {col.label}
                      {col.sortable && <SortIcon colKey={col.key} />}
                    </div>
                  </TableHead>
                ))}
                {actions && (
                  <TableHead className="w-[120px] whitespace-nowrap">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((row, i) => (
                <TableRow
                  key={getKey(row, i)}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    onRowClick && 'cursor-pointer',
                    'group'
                  )}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className="whitespace-nowrap">
                      {col.render ? col.render(row) : String(row[col.key] ?? '-')}
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        {actions(row)}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <span className="text-sm text-muted-foreground">
            {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, totalItems)} of{' '}
            {totalItems}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setPage(1)}
              disabled={safePage === 1}
              aria-label="First page"
            >
              <ChevronsLeft className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setPage(safePage - 1)}
              disabled={safePage === 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="min-w-[4rem] text-center text-sm font-medium tabular-nums">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setPage(safePage + 1)}
              disabled={safePage === totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setPage(totalPages)}
              disabled={safePage === totalPages}
              aria-label="Last page"
            >
              <ChevronsRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
