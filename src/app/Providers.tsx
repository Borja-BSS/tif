'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider }                      from '@/context/AuthContext'
import { GuestProvider }                     from '@/context/GuestContext'
import { PostHogProvider }                   from '@/components/PostHogProvider'
import { useState }                          from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <PostHogProvider>
      <AuthProvider>
        <GuestProvider>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </GuestProvider>
      </AuthProvider>
    </PostHogProvider>
  )
}
