'use client'

import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface AccessDeniedProps {
  title?: string
  message?: string
  showBack?: boolean
}

export function AccessDenied({
  title = 'Access Denied',
  message = 'You do not have permission to access this feature.',
  showBack = true,
}: AccessDeniedProps) {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center"
      style={{ minHeight: '50vh' }}
    >
      <div className="flex size-16 items-center justify-center rounded-full mb-4"
        style={{ background: 'var(--danger-muted)' }}
      >
        <ShieldAlert size={28} style={{ color: 'var(--danger)' }} />
      </div>
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{message}</p>
      {showBack && (
        <Button variant="outline" onClick={() => router.push('/admin/dashboard')}>
          Go to Dashboard
        </Button>
      )}
    </div>
  )
}
