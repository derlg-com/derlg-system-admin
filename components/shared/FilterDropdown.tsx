'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface FilterOption {
  label: string
  value: string
}

interface FilterDropdownProps<V extends string | string[]> {
  label?: string
  options: FilterOption[]
  value: V
  onChange: (value: V) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

export function FilterDropdown<V extends string | string[]>({
  label = 'Filter',
  options,
  value,
  onChange,
  placeholder = 'All',
  className,
  style,
}: FilterDropdownProps<V>) {
  const [open, setOpen] = useState(false)

  // Support both single-select (string) and multi-select (string[]) for backward compatibility
  const isMulti = Array.isArray(value)
  const selectedValues: string[] = useMemo(
    () => (Array.isArray(value) ? (value as string[]) : value ? [value as string] : []),
    [value]
  )
  const selectedCount = selectedValues.length

  const selectedLabels = useMemo(() => {
    return options
      .filter((opt) => selectedValues.includes(opt.value))
      .map((opt) => opt.label)
  }, [options, selectedValues])

  // `V` is pinned by the caller's `value`, so the branch that fires always
  // produces the matching shape — but TypeScript cannot prove that from a
  // runtime `Array.isArray` check on a generic.
  const emit = (next: string | string[]) => onChange(next as V)

  const handleToggle = (optValue: string) => {
    if (isMulti) {
      const current = value as string[]
      if (current.includes(optValue)) {
        emit(current.filter((v) => v !== optValue))
      } else {
        emit([...current, optValue])
      }
    } else {
      // Single-select mode: toggle off if already selected, otherwise select
      const current = value as string
      emit(current === optValue ? '' : optValue)
      setOpen(false)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    emit(isMulti ? [] : '')
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-10 gap-1.5 font-normal',
            selectedCount > 0 && 'border-primary/50',
            className
          )}
          style={{
            background: selectedCount > 0 ? 'var(--brand-primary-muted)' : 'var(--bg-elevated)',
            border: `1px solid ${selectedCount > 0 ? 'var(--brand-primary)' : 'var(--border-strong)'}`,
            color: selectedCount > 0 ? 'var(--brand-primary)' : 'var(--text-primary)',
            ...style,
          }}
        >
          <span className="truncate max-w-[120px]">
            {selectedCount > 0
              ? selectedCount === 1
                ? selectedLabels[0]
                : `${selectedCount} selected`
              : placeholder}
          </span>
          {selectedCount > 0 ? (
            <span
              role="button"
              aria-label="Clear filter"
              className="ml-0.5 flex items-center justify-center h-5 w-5 rounded hover:bg-white/20"
              onClick={handleClear}
            >
              <X className="size-3.5" />
            </span>
          ) : (
            <ChevronDown className="size-3.5 opacity-60" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selectedValues.includes(option.value)}
            onCheckedChange={() => handleToggle(option.value)}
            onSelect={(e) => e.preventDefault()}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
        {options.length === 0 && (
          <div className="px-2 py-3 text-sm text-muted-foreground text-center">
            No options available
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
