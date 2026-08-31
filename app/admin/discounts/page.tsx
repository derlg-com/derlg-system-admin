import type { Metadata } from 'next'
import { DiscountCodeList } from '@/components/admin/discounts/DiscountCodeList'

export const metadata: Metadata = {
  title: 'Discount Codes',
}

export default function DiscountsPage() {
  return <DiscountCodeList />
}
