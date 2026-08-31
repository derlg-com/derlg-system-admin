'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { MessageSquare, ThumbsDown, ThumbsUp, User, UserX } from 'lucide-react'

import { aiSessionsApi } from '@/lib/api'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Archived concierge conversations.
 *
 * Until the transcript archive existed these rows were unreachable: the agent
 * kept conversations only in Redis, so nothing survived its 7-day TTL and this
 * screen had nothing to show.
 */

interface AISessionRow {
  id: string
  title: string | null
  language: string
  isActive: boolean
  isGuest: boolean
  userId: string | null
  guestKey: string | null
  user: { id: string; email: string; fullName: string | null } | null
  messageCount: number
  lastMessageAt: string | null
  createdAt: string
  convertedToBooking: boolean
}

interface TranscriptMessage {
  id: string
  seq: number
  role: string
  content: string
  messageType: string
  helpful: boolean | null
  createdAt: string
}

interface Transcript extends AISessionRow {
  messages: TranscriptMessage[]
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  zh: 'Chinese',
  km: 'Khmer',
}

function whoLabel(row: AISessionRow): string {
  if (!row.isGuest) return row.user?.email ?? row.userId ?? 'Unknown user'
  return row.guestKey ?? 'Guest'
}

export function AISessionList() {
  const [search, setSearch] = useState('')
  const [language, setLanguage] = useState<string>('all')
  const [audience, setAudience] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [openSessionId, setOpenSessionId] = useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['ai-sessions', { search, language, audience, page }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 }
      if (search.trim()) params.search = search.trim()
      if (language !== 'all') params.language = language
      // The backend expects the string 'true'; omit the param entirely otherwise
      // so `forbidNonWhitelisted` has nothing to object to.
      if (audience === 'guests') params.onlyGuests = 'true'
      const res = await aiSessionsApi.list(params)
      return res.data as { data: AISessionRow[]; meta: { total: number } }
    },
    staleTime: 30000,
  })

  const transcriptQuery = useQuery({
    queryKey: ['ai-session-transcript', openSessionId],
    queryFn: async () => {
      const res = await aiSessionsApi.getTranscript(openSessionId as string)
      return res.data as Transcript
    },
    // Only fetch once a row has actually been opened.
    enabled: openSessionId !== null,
    staleTime: 60000,
  })

  const columns: Column<AISessionRow>[] = [
    {
      key: 'who',
      label: 'Participant',
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.isGuest ? (
            <UserX size={14} className="text-amber-600" />
          ) : (
            <User size={14} className="text-emerald-600" />
          )}
          <span className="truncate">{whoLabel(row)}</span>
        </div>
      ),
    },
    {
      key: 'language',
      label: 'Language',
      render: (row) => LANGUAGE_LABELS[row.language] ?? row.language,
    },
    {
      key: 'messageCount',
      label: 'Messages',
      sortable: true,
      render: (row) => (
        <span className="flex items-center gap-1">
          <MessageSquare size={13} className="text-slate-400" />
          {row.messageCount}
        </span>
      ),
    },
    {
      key: 'convertedToBooking',
      label: 'Converted',
      render: (row) =>
        row.convertedToBooking ? (
          <Badge className="bg-emerald-100 text-emerald-800">Booked</Badge>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'lastMessageAt',
      label: 'Last activity',
      sortable: true,
      render: (row) =>
        row.lastMessageAt
          ? format(new Date(row.lastMessageAt), 'dd MMM yyyy HH:mm')
          : <span className="text-slate-400">no messages</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by email, name, or guest handle"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="max-w-xs"
        />
        <Select
          value={language}
          onValueChange={(v: string) => {
            setLanguage(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All languages</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="zh">Chinese</SelectItem>
            <SelectItem value="km">Khmer</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={audience}
          onValueChange={(v: string) => {
            setAudience(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Audience" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            <SelectItem value="guests">Guests only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={listQuery.data?.data ?? []}
        loading={listQuery.isLoading}
        rowKey="id"
        emptyMessage="No concierge conversations recorded yet"
        totalCount={listQuery.data?.meta.total ?? 0}
        currentPage={page}
        onPageChange={setPage}
        actions={(row) => (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpenSessionId(row.id)}
          >
            Transcript
          </Button>
        )}
      />

      <Dialog
        open={openSessionId !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setOpenSessionId(null)
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Conversation transcript</DialogTitle>
          </DialogHeader>

          {transcriptQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading transcript…</p>
          ) : transcriptQuery.isError ? (
            <p className="text-sm text-rose-600">
              Could not load this transcript.
            </p>
          ) : (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              <p className="text-xs text-slate-500">
                {whoLabel(transcriptQuery.data as AISessionRow)} ·{' '}
                {transcriptQuery.data?.messages.length ?? 0} messages
              </p>
              {transcriptQuery.data?.messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === 'user'
                      ? 'rounded-lg bg-slate-100 p-3'
                      : 'rounded-lg bg-emerald-50 p-3'
                  }
                >
                  <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium uppercase">{message.role}</span>
                    <span>#{message.seq}</span>
                    {message.messageType !== 'text' ? (
                      <Badge variant="outline">{message.messageType}</Badge>
                    ) : null}
                    {message.helpful === true ? (
                      <ThumbsUp size={12} className="text-emerald-600" />
                    ) : null}
                    {message.helpful === false ? (
                      <ThumbsDown size={12} className="text-rose-600" />
                    ) : null}
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                </div>
              ))}
              {transcriptQuery.data?.messages.length === 0 ? (
                <p className="text-sm text-slate-500">
                  This session has no archived messages.
                </p>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
