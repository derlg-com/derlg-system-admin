'use client'

import { DiscountCodeList } from '@/components/admin/discounts/DiscountCodeList'
import { StudentVerificationQueue } from '@/components/admin/discounts/StudentVerificationQueue'
import { useState } from 'react'

export default function DiscountsPage() {
  const [tab, setTab] = useState<'codes' | 'students'>('codes')
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">Discounts & Verifications</h1>
      </div>
      <div className="tabs" style={{ marginBottom: 20, display: 'inline-flex' }}>
        <button className={`tab ${tab === 'codes' ? 'active' : ''}`} onClick={() => setTab('codes')}>Discount Codes</button>
        <button className={`tab ${tab === 'students' ? 'active' : ''}`} onClick={() => setTab('students')}>Student Verifications</button>
      </div>
      {tab === 'codes' ? <DiscountCodeList /> : <StudentVerificationQueue />}
    </div>
  )
}
