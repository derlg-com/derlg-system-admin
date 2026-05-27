# Frontend Bug Fixes Log

> **Date:** 2026-05-18
> **Scope:** `frontend_admin/` — Admin Panel UI

---

## Fix 1: SearchInput Icon Overlapping Placeholder Text

**File:** `frontend_admin/components/shared/SearchInput.tsx`

**Problem:** The Lucide Search icon was transparent, causing placeholder text to show through and overlap with the icon.

**Solution:**
- Removed wrapper `<div>` elements with inline `background` and `zIndex` hacks
- Used pure Tailwind utility classes with `absolute left-3.5 top-1/2 -translate-y-1/2`
- Added `pointer-events-none select-none` to the icon so it doesn't block clicks or text selection
- Input uses `pl-[45px]` to reserve space for the icon
- Clear button positioned absolutely on the right

**Key Changes:**
```tsx
// Before: wrapper divs with inline styles
<div style={{ background: 'var(--bg-surface)', zIndex: 1 }}>
  <Search className="size-4" />
</div>

// After: clean Tailwind only
<Search className="search-icon absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none select-none" aria-hidden="true" />
```

---

## Fix 2: SelectItem Empty String Value Crash

**Files:**
- `frontend_admin/components/admin/drivers/DriverForm.tsx`
- `frontend_admin/components/admin/audit/AuditLogViewer.tsx`

**Problem:** Radix UI `<SelectItem>` rejects `value=""` (empty string), throwing: *"A Select.Item must have a value prop that is not an empty string."*

**Root Cause:** The placeholder/clear option used `value=""` which Radix UI treats as invalid.

**Solution:** Use sentinel values (`__none__`, `__all__`) for empty/clear options, then translate back in `onValueChange`:

```tsx
// Before
<SelectItem value="">None</SelectItem>

// After
<SelectItem value="__none__">None</SelectItem>
<Select
  onValueChange={(val) => field.onChange(val === '__none__' ? '' : val)}
  value={field.value || '__none__'}
>
```

**Affected Fields:**
| File | Field | Sentinel |
|------|-------|----------|
| DriverForm.tsx | `vehicle_id` | `__none__` |
| DriverForm.tsx | `admin_role` | `__none__` |
| AuditLogViewer.tsx | `actionFilter` | `__all__` |

---

## Fix 3: Audit Log CSV Export Failing

**File:** `frontend_admin/components/admin/audit/AuditLogViewer.tsx`

**Problem:** Export CSV button called `auditLogsApi.export()` which hits a backend endpoint that doesn't exist yet (backend is scaffold-only). This caused a generic "Failed to export audit logs" toast.

**Solution:** Generate CSV client-side from the already-loaded `logs` array:

```tsx
const handleExport = () => {
  if (logs.length === 0) { toast.error('No audit logs to export'); return }
  const headers = ['Timestamp', 'Admin', 'Action', 'Resource', 'Resource ID']
  const rows = logs.map((log) => [...])
  const csv = [headers.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n')
  // Blob download...
}
```

**Features:**
- Proper CSV escaping for commas, quotes, and newlines
- Shows "No audit logs to export" if table is empty
- No backend dependency

---

## Fix 4: Checkbox Infinite Loop (VehicleForm)

**File:** `frontend_admin/components/admin/vehicles/VehicleForm.tsx`

**Problem:** Clicking a feature checkbox caused *"Maximum update depth exceeded"* error.

**Root Cause:** Radix UI's `Checkbox` renders a hidden `CheckboxBubbleInput` that dispatches a **synthetic `click` event** whenever the `checked` prop changes. This event bubbles up to the parent `<div onClick={...}>`, which called `toggleFeature()` again, toggling the feature back off, which changed `checked`, which dispatched another click event — infinite loop.

**Solution:**
- Removed `onClick` from the parent `<div>`
- Changed `<div>` to `<label>` for native click-through behavior
- Updated `onCheckedChange` to use the `checked` parameter directly instead of toggle logic
- Removed unused `toggleFeature` function

```tsx
// Before
<div onClick={() => toggleFeature(feature)}>
  <Checkbox checked={...} onCheckedChange={() => toggleFeature(feature)} />
</div>

// After
<label className="...cursor-pointer">
  <Checkbox
    checked={isSelected}
    onCheckedChange={(checked) => {
      const current = form.getValues('features') || []
      if (checked === true) form.setValue('features', [...current, feature])
      else form.setValue('features', current.filter((f) => f !== feature))
    }}
  />
</label>
```

---

## Fix 5: Checkbox Infinite Loop (HotelForm)

**File:** `frontend_admin/components/admin/hotels/HotelForm.tsx`

**Problem:** Same infinite loop as Fix 4, but in the hotel amenities section.

**Solution:** Same fix pattern — replaced `<div onClick={...}>` with `<label>` and fixed `onCheckedChange` handler. Also removed unused `Controller` import and unused `toggleAmenity` function.

---

## Fix 6: Checkbox Infinite Loop (RoomForm)

**File:** `frontend_admin/components/admin/hotels/RoomForm.tsx`

**Problem:** Same infinite loop as Fix 4/5, in the room amenities section.

**Solution:** Same fix pattern — replaced `<div onClick={...}>` with `<label>` and fixed `onCheckedChange` handler. Also removed unused `toggleAmenity` function.

---

## Backend Compatibility Notes

All fixes maintain backward compatibility with the planned backend API:

- **DriverForm**: Vehicle ID and admin role still submit as empty string / undefined when cleared
- **AuditLogViewer**: CSV export format matches the API response schema (same column structure)
- **VehicleForm / HotelForm / RoomForm**: Form submission payload unchanged — `features`/`amenities` arrays still sent as `string[]`
- **All Select components**: Backend receives the same enum/string values as before

---

## Summary of Files Changed

| File | Fix |
|------|-----|
| `components/shared/SearchInput.tsx` | Icon overlap, clean CSS structure |
| `components/admin/drivers/DriverForm.tsx` | SelectItem empty value, checkbox loop |
| `components/admin/audit/AuditLogViewer.tsx` | CSV export client-side, SelectItem empty value |
| `components/admin/vehicles/VehicleForm.tsx` | Checkbox infinite loop |
| `components/admin/hotels/HotelForm.tsx` | Checkbox infinite loop, unused imports |
| `components/admin/hotels/RoomForm.tsx` | Checkbox infinite loop |
| `components/admin/guides/GuideForm.tsx` | Checkbox infinite loop (3 sections), unused toggle functions |
| `components/admin/vehicles/VehicleForm.tsx` | Select dropdown z-index (2 fields) |
| `components/admin/drivers/DriverForm.tsx` | Select dropdown z-index (2 fields) |
| `components/admin/users/AdminUserForm.tsx` | Select dropdown z-index |
| `components/admin/discounts/DiscountCodeForm.tsx` | Select dropdown z-index |

---

## Fix 8: Select Dropdowns Hidden Behind Modal Overlay

**Date:** 2026-05-18
**Files:**
- `frontend_admin/components/admin/vehicles/VehicleForm.tsx`
- `frontend_admin/components/admin/drivers/DriverForm.tsx`
- `frontend_admin/components/admin/users/AdminUserForm.tsx`
- `frontend_admin/components/admin/discounts/DiscountCodeForm.tsx`

**Problem:** shadcn/ui `<SelectContent>` renders in a Radix UI Portal at the document body level with `z-index: 50` (`z-50`). The custom Modal overlay has `z-index: 1000`. Since both are in the root stacking context, the dropdown appears *behind* the modal — invisible and unclickable.

**Solution:**
- Added `className="z-[1100]"` to all `<SelectContent>` components inside modals to ensure they render above the modal overlay
- Added `className="w-full h-10"` to `<SelectTrigger>` so the dropdown fills the grid cell and matches FilterDropdown height
- Added `className="min-w-[200px]"` to `<SelectContent>` for wider, easier-to-click options
- Added `placeholder` prop to `<SelectValue>` for better UX when no value is selected

**Key Changes:**
```tsx
// Before
<SelectContent>
  <SelectTrigger style={S}><SelectValue /></SelectTrigger>
</SelectContent>

// After
<SelectContent className="z-[1100] min-w-[200px]">
  <SelectTrigger style={S} className="w-full h-10"><SelectValue placeholder="Select category" /></SelectTrigger>
</SelectContent>
```

**Affected Forms:**
| File | Select Field |
|------|-------------|
| VehicleForm.tsx | Category (`vehicle_type`) |
| VehicleForm.tsx | Pricing Model (`pricing_model`) |
| DriverForm.tsx | Assigned Vehicle (`vehicle_id`) |
| DriverForm.tsx | Admin Role (`admin_role`) |
| AdminUserForm.tsx | Admin Role (`admin_role`) |
| DiscountCodeForm.tsx | Discount Type (`discount_type`) |

---

## Fix 7: DriverForm UI — Dark Blue Theme + Backend Field Mapping

**Date:** 2026-05-18
**Files:**
- `frontend_admin/components/admin/drivers/DriverForm.tsx`
- `frontend_admin/components/admin/drivers/DriverList.tsx`

**Problem 1 — UI:** DriverForm inputs used default shadcn `Input` styling (white/transparent background), inconsistent with the dark blue admin theme.

**Problem 2 — Backend mismatch:** Form submitted snake_case fields (`driver_name`, `driver_id`, `telegram_id`, `vehicle_id`) but backend `CreateDriverDto` expects camelCase (`driverName`, `driverId`, `telegramId`, `vehicleId`).

**Solution:**
- All `Input` and `SelectTrigger` components now use `style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}`
- Telegram section uses `var(--bg-overlay)` (slightly lighter) to visually separate it
- `handleFormSubmit` in `DriverList` now maps snake_case → camelCase before calling the API
- Mutation typed as `any` to accept the transformed payload

```ts
// DriverList.tsx — field mapping
const handleFormSubmit = (formData: DriverFormData) => {
  const payload = {
    driverName: formData.driver_name,
    driverId: formData.driver_id,
    phone: formData.phone,
    telegramId: formData.telegram_id || undefined,
    vehicleId: formData.vehicle_id || undefined,
  }
  mutation.mutate(payload)
}
```

**TypeScript:** `npx tsc --noEmit` passes with 0 errors.

---

## Fix 8: Global UI Improvements (Search, Filters, Sidebar, Tables)

**Date:** 2026-05-18

### SearchInput (`components/shared/SearchInput.tsx`)
- Changed `pl-[45px]` Tailwind class to `style={{ paddingLeft: 38 }}` — Tailwind class was being overridden by shadcn `Input`'s base `px-3`
- Background changed from `bg-background` (white) to `var(--bg-elevated)` with `var(--border-strong)` border

### FilterDropdown (`components/shared/FilterDropdown.tsx`)
- Replaced nested `<Button>` inside `<Button>` (invalid HTML) with `<span role="button">` for the clear X
- Added `e.preventDefault()` + `setOpen(false)` to `handleClear` so dropdown closes on clear
- Trigger button background changed to `var(--bg-elevated)` to match search bar
- Added "All" reset option to vehicle category, tier, driver status, and telegram status filters

### Dropdown Menu (`components/ui/dropdown-menu.tsx`)
- `DropdownMenuContent`: replaced `bg-popover text-popover-foreground` with `var(--bg-overlay)` + `var(--border-strong)` + `var(--text-primary)` — was nearly invisible on dark background
- `DropdownMenuCheckboxItem`: added `text-[var(--text-primary)] focus:bg-[var(--bg-hover)]`
- `DropdownMenuLabel`: added `text-[var(--text-secondary)]`

### DataTable (`components/shared/DataTable.tsx`)
- Skeleton rows: added `borderBottom: '1px solid var(--border-strong)'`
- Data rows: added `borderBottom: '1px solid var(--border-default)'`
- Empty state + data container: added `animation: 'fadeIn 0.4s ease'` for smooth skeleton → content transition

### AdminSidebar (`components/admin/AdminSidebar.tsx`)
- Logo container height: `64px` → `80px`, left padding `28px`
- Logo "D" square: added `hover:scale-105` + blue glow shadow
- Nav container: symmetric `padding: '12px 10px'`
- Nav links: `px-4` → `px-5`, added `w-full`
- Nav items: `onMouseEnter/Leave` for `var(--bg-hover)` background on inactive items

### Sidebar width (`app/globals.css`)
- `--sidebar-width`: `264px` → `280px`

### Tour Guides Filter (`components/admin/guides/GuideList.tsx`)
- Language/specialty filter buttons: `bg-transparent text-muted-foreground` → `var(--bg-elevated) text-primary` with `var(--border-strong)` border
- Active language: `var(--brand-primary)`, active specialty: `var(--brand-secondary)`
- Active filter tags in filter row: solid filled pills (blue/purple) instead of faint `bg-primary/10`
- Button padding: `px-5 py-2`, gap: `gap-3`

### Audit Log (`components/admin/audit/AuditLogViewer.tsx`)
- Filter inputs replaced with dark blue styled `<input>` matching search bar
- `SelectTrigger` styled with `var(--bg-elevated)`
- Table header: `var(--bg-elevated)` background + `var(--border-strong)` bottom border
- Skeleton rows: `var(--border-strong)` dividers
- Data rows: `var(--border-default)` dividers + `var(--bg-hover)` on hover


---

## Fix 9: 5 Forms — Dark Blue Theme + Backend Field Mapping

**Date:** 2026-05-18
**Files changed:**
- `components/admin/vehicles/VehicleForm.tsx` + `VehicleList.tsx`
- `components/admin/hotels/HotelForm.tsx` + `HotelList.tsx`
- `components/admin/guides/GuideForm.tsx` + `GuideList.tsx`
- `components/admin/discounts/DiscountCodeForm.tsx` + `DiscountCodeList.tsx`
- `components/admin/users/AdminUserForm.tsx` + `AdminUserList.tsx`

### Theme Changes (all 5 forms)
All `Input`, `SelectTrigger`, `textarea`, and button components now use:
- `background: var(--bg-elevated)` — dark blue surface
- `border: 1px solid var(--border-strong)` — visible border
- `color: var(--text-primary)` — white text
- Checkbox labels use `var(--bg-elevated)` with `var(--brand-primary)` border when checked
- Cancel button: `var(--bg-elevated)` style; Submit button: `var(--brand-primary)` blue

### Backend Field Mapping Fixes

| Form | Old field | New field (matches backend DTO) |
|------|-----------|----------------------------------|
| VehicleForm | `category` | `vehicle_type` |
| VehicleForm | `tier` | `pricing_model` (PER_DAY/PER_KM/FIXED) |
| VehicleForm | `price_per_day` | `price_usd` |
| VehicleForm | — | Added `province` (required), `license_plate` |
| HotelForm | `location.lat/lng` | `latitude`, `longitude` (flat fields) |
| HotelForm | `rating` | `star_rating` |
| GuideForm | `name`, `price_per_day` | Replaced with `user_id`, `province`, `price_per_day_usd` |
| DiscountCodeForm | `discount_percentage` | `value` |
| DiscountCodeForm | `max_usage` | `max_uses` |
| DiscountCodeForm | — | Added `discount_type` (PERCENTAGE/FIXED) |
| AdminUserForm | `name` | `full_name` |

### List Component Updates
All corresponding list components updated to pass correct field names in `defaultValues` when editing, and updated `interface` types to match backend response shape.

**TypeScript:** `npx tsc --noEmit` passes with 0 errors.


---

## Fix 10: HotelForm + GuideForm — DriverForm-style Section Layout

**Date:** 2026-05-18
**Files:**
- `components/admin/hotels/HotelForm.tsx`
- `components/admin/guides/GuideForm.tsx`

**Problem:** Both forms had flat unstyled fields with no visual grouping, inconsistent with the DriverForm sectioned layout.

**Solution:** Wrapped logical groups in `var(--bg-elevated)` cards with `var(--border-strong)` border and bold section titles, matching DriverForm exactly. Fields inside each card use `var(--bg-overlay)` so they stand out from the card background.

**HotelForm sections:**
- Basic Information (name, description, check-in/out times, star rating, cancellation policy)
- Location (LocationPicker map)
- Amenities (checkbox grid)
- Images (upload + preview)

**GuideForm sections:**
- Basic Information (user_id, province, price, experience, bio)
- Languages (checkbox grid, blue highlight)
- Specialties (checkbox grid, purple highlight)
- Certifications (checkbox grid)
- Profile Picture (upload + preview)

**TypeScript:** `npx tsc --noEmit` passes with 0 errors.


---

## Fix 11: Select Dropdown — Readable Dark Theme

**Date:** 2026-05-22
**File:** `components/ui/select.tsx`

**Problem:** Select dropdown options (e.g. Discount Type "Percentage" / "Fixed Amount") were nearly invisible — `bg-popover` and `text-popover-foreground` resolved to colors that blended with the dark background. Hover/focus state used `bg-accent` which was also barely visible.

**Solution:**
- `SelectContent`: replaced `bg-popover text-popover-foreground` with inline styles `var(--bg-overlay)` background + `var(--border-strong)` border + `var(--text-primary)` text — same pattern used for `DropdownMenuContent` (Fix 8)
- `SelectItem`:
  - Padding increased: `py-1.5 pl-2` → `py-2 pl-3` for easier clicking
  - `cursor-default` → `cursor-pointer`
  - Text: `var(--text-primary)` (white)
  - Hover/focus: `var(--bg-hover)` background highlight
  - Selected (checked): `var(--brand-primary-muted)` background + `var(--brand-primary)` blue text

**Affected:** every `<Select>` in the app — Discount form (discount_type), Vehicle form (vehicle_type, pricing_model), Driver form (vehicle_id, admin_role), Admin User form (admin_role), Audit log (action_type filter), Booking modification, Maintenance scheduler.

**TypeScript:** `npx tsc --noEmit` passes with 0 errors.
