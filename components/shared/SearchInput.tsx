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
    <div
      className={cn(
        // search-box: relative container for absolute children
        'search-box relative flex items-center w-full',
        className
      )}
      style={style}
    >
      {/* search-icon: absolute left, vertically centered, non-interactive */}
      <Search
        className="search-icon absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none select-none"
        aria-hidden="true"
      />

      {/* search-input: paddingLeft via style to guarantee icon clearance */}
      <Input
        type="text"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="search-input h-10 w-full rounded-lg text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
        style={{ paddingLeft: 38, paddingRight: displayValue ? 40 : 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
      />

      {/* Clear button: absolute right, vertically centered */}
      {displayValue && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={handleClear}
          aria-label="Clear search"
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  )
}
