'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  placeholder?: string
  onSearch?: (query: string) => void
  debounceMs?: number
  className?: string
  defaultValue?: string
  // Legacy controlled props (for backward compatibility)
  value?: string
  onChange?: (v: string) => void
  style?: React.CSSProperties
}

export function SearchInput({
  placeholder = 'Search...',
  onSearch,
  debounceMs = 300,
  className,
  defaultValue = '',
  value,
  onChange,
  style,
}: SearchInputProps) {
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = useState(defaultValue)
  const displayValue = isControlled ? value : internalValue
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debouncedSearch = useCallback(
    (query: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        onSearch?.(query)
      }, debounceMs)
    },
    [onSearch, debounceMs]
  )

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    if (!isControlled) {
      setInternalValue(newValue)
    }
    onChange?.(newValue)
    if (onSearch) {
      debouncedSearch(newValue)
    }
  }

  const handleClear = () => {
    if (!isControlled) {
      setInternalValue('')
    }
    onChange?.('')
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    onSearch?.('')
  }

  return (
    <div className={cn('relative flex items-center', className)} style={style}>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
      />
      <Input
        type="text"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="pl-9 pr-9 h-9 bg-background"
      />
      {displayValue && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={handleClear}
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  )
}
