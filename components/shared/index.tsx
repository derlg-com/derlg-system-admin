'use client'

import { Search } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  style?: React.CSSProperties
}

export function SearchInput({ value, onChange, placeholder = 'Search...', style }: SearchInputProps) {
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

// Filter Dropdown
interface FilterOption {
  label: string
  value: string
}

interface FilterDropdownProps {
  value: string
  onChange: (v: string) => void
  options: FilterOption[]
  placeholder?: string
  style?: React.CSSProperties
}

export function FilterDropdown({ value, onChange, options, placeholder = 'All', style }: FilterDropdownProps) {
  return (
    <select
      className="form-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: 'auto', minWidth: 130, ...style }}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}

// Confirm Dialog
interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'danger', onConfirm, onCancel, loading,
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            className={`btn btn-${variant === 'danger' ? 'danger' : 'primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
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
