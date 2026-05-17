'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditLogsApi } from '@/lib/api'
import { PageHeader } from '@/components/shared'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'
import { Download, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { toast } from 'sonner'

interface AuditLog {
  id: string
  created_at: string
  timestamp?: string
  admin_name?: string
  admin_user_id?: string
  action_type: string
  action?: string
  resource_type: string
  resource?: string
  affected_resource_id?: string
  entity_id?: string
  changed_fields?: Record<string, any>
  request_body?: Record<string, any>
  metadata?: Record<string, any>
}

const ACTION_TYPES = [
  'DRIVER_ASSIGNMENT',
  'BOOKING_MODIFICATION',
  'PRICING_CHANGE',
  'USER_ROLE_CHANGE',
  'DRIVER_STATUS_UPDATE',
  'BOOKING_CANCELLATION',
  'ADMIN_USER_CREATED',
  'ADMIN_USER_UPDATED',
  'ADMIN_USER_DEACTIVATED',
  'EXPORT_DATA',
]

function JsonBlock({ data }: { data: Record<string, any> | undefined }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No details available</p>
    )
  }
  return (
    <pre className="text-xs text-muted-foreground bg-muted p-3 rounded-md overflow-auto max-h-60">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

export function AuditLogViewer() {
  const [actionFilter, setActionFilter] = useState('')
  const [adminFilter, setAdminFilter] = useState('')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['admin-audit-logs', actionFilter, adminFilter, startDate, endDate],
    queryFn: () =>
      auditLogsApi
        .list({
          action_type: actionFilter || undefined,
          admin_user_id: adminFilter || undefined,
          start_date: startDate,
          end_date: endDate,
        })
        .then((r) => r.data as AuditLog[]),
    staleTime: 30000,
  })

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleExport = async () => {
    try {
      const res = await auditLogsApi.export({
        start_date: startDate,
        end_date: endDate,
        action_type: actionFilter || undefined,
        admin_user_id: adminFilter || undefined,
      })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${startDate}-${endDate}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Audit logs exported')
    } catch {
      toast.error('Failed to export audit logs')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit Logs"
        subtitle={`${logs.length} records`}
        actions={
          <button className="btn btn-secondary" onClick={handleExport}>
            <Download size={14} /> Export CSV
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-5">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by admin user..."
            value={adminFilter}
            onChange={(e) => setAdminFilter(e.target.value)}
            className="pl-8 w-52"
          />
        </div>

        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Action Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Action Types</SelectItem>
            {ACTION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <input
          className="form-input"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          style={{ width: 'auto' }}
        />
        <span className="text-muted-foreground">—</span>
        <input
          className="form-input"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          style={{ width: 'auto' }}
        />
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Resource ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
                  No audit log entries found
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => {
                const isExpanded = expanded.has(log.id)
                const changed =
                  log.changed_fields || log.request_body || log.metadata

                return (
                  <>
                    <TableRow
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleExpand(log.id)}
                    >
                      <TableCell className="w-8">
                        {changed ? (
                          isExpanded ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {format(
                          new Date(log.created_at || log.timestamp || Date.now()),
                          'MMM d, HH:mm:ss'
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.admin_name || log.admin_user_id || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {(log.action_type || log.action || '').replace(
                            /_/g,
                            ' '
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.resource_type || log.resource || '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {(log.affected_resource_id || log.entity_id || '').slice(
                          0,
                          8
                        )}
                        …
                      </TableCell>
                    </TableRow>
                    {isExpanded && changed && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={6} className="py-3">
                          <div className="space-y-3">
                            {log.changed_fields && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Changed Fields
                                </p>
                                <JsonBlock data={log.changed_fields} />
                              </div>
                            )}
                            {log.request_body && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Request Body
                                </p>
                                <JsonBlock data={log.request_body} />
                              </div>
                            )}
                            {log.metadata && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Metadata
                                </p>
                                <JsonBlock data={log.metadata} />
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
