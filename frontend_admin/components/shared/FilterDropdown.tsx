'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, Check, X } from 'lucide-react'
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

interface FilterDropdownProps {
  label?: string
  options: FilterOption[]
  value: string | string[]
  onChange: (value: any) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

export function FilterDropdown({
  label = 'Filter',
  options,
  value,
  onChange,
  placeholder = 'All',
  className,
  style,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false)

  // Support both single-select (string) and multi-select (string[]) for backward compatibility
  const isMulti = Array.isArray(value)
  const selectedValues: string[] = isMulti ? value : value ? [value] : []
  const selectedCount = selectedValues.length

  const selectedLabels = useMemo(() => {
    return options
      .filter((opt) => selectedValues.includes(opt.value))
      .map((opt) => opt.label)
  }, [options, selectedValues])

  const handleToggle = (optValue: string) => {
    if (isMulti) {
      const current = value as string[]
      if (current.includes(optValue)) {
        onChange(current.filter((v) => v !== optValue))
      } else {
        onChange([...current, optValue])
      }
    } else {
      // Single-select mode: toggle off if already selected, otherwise select
      const current = value as string
      onChange(current === optValue ? '' : optValue)
      setOpen(false)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(isMulti ? [] : '')
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-9 gap-1.5 font-normal',
            selectedCount > 0 && 'border-primary/50 bg-primary/5',
            className
          )}
          style={style}
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
              tabIndex={0}
              className="ml-0.5 inline-flex size-4 items-center justify-center rounded-sm hover:bg-muted"
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onChange(isMulti ? [] : '')
                }
              }}
            >
              <X className="size-3" />
            </span>
          ) : (
            <ChevronDown className="size-3.5 text-muted-foreground" />
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
