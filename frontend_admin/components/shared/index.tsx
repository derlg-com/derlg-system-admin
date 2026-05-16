'use client'

export { DataTable, type Column, type FilterConfig } from './DataTable'
export { SearchInput } from './SearchInput'
export { FilterDropdown, type FilterOption } from './FilterDropdown'
export { ConfirmDialog } from './ConfirmDialog'
export { ImageUpload } from './ImageUpload'

import { Search } from 'lucide-react'

// Legacy simple search input (kept for backwards compatibility)
interface LegacySearchInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  style?: React.CSSProperties
}

export function LegacySearchInput({ value, onChange, placeholder = 'Search...', style }: LegacySearchInputProps) {
  return (
    <div className="search-bar" style={{ minWidth: 220, ...style }}>
      <Search size={15} color="var(--text-muted)" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

// Status Badge
interface StatusBadgeProps {
  status: string
  mapping?: Record<string, { label?: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }>
}

const DEFAULT_MAPPING: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  AVAILABLE: { variant: 'success' },
  CONFIRMED: { variant: 'success' },
  COMPLETED: { variant: 'success' },
  APPROVED: { variant: 'success' },
  ACTIVE: { variant: 'success' },
  BUSY: { variant: 'warning' },
  RESERVED: { variant: 'warning' },
  PENDING: { variant: 'warning' },
  SCHEDULED: { variant: 'warning' },
  ACKNOWLEDGED: { variant: 'warning' },
  IN_MAINTENANCE: { variant: 'warning' },
  OFFLINE: { variant: 'default' },
  CANCELLED: { variant: 'danger' },
  REFUNDED: { variant: 'danger' },
  REJECTED: { variant: 'danger' },
  SENT: { variant: 'danger' },
  RESOLVED: { variant: 'info' },
  SOS: { variant: 'danger' },
  MEDICAL: { variant: 'warning' },
}

export function StatusBadge({ status, mapping }: StatusBadgeProps) {
  const map = { ...DEFAULT_MAPPING, ...(mapping || {}) }
  const entry = map[status]
  const variant = entry?.variant || 'default'
  const label = (entry as any)?.label || status.replace(/_/g, ' ')
  return <span className={`badge badge-${variant}`}>{label}</span>
}

// Modal wrapper
interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  maxWidth?: number
  footer?: React.ReactNode
}

export function Modal({ open, title, onClose, children, maxWidth = 560, footer }: ModalProps) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

// Form field wrapper
interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
  hint?: string
}

export function FormField({ label, error, required, children, hint }: FormFieldProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="form-label">
        {label}
        {required && <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>}
      {error && <div className="form-error">{error}</div>}
    </div>
  )
}

// Page header
interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
    </div>
  )
}
