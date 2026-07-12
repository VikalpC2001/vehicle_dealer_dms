import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider } from '@/context/AuthContext'
import { PasswordResetProvider } from '@/context/PasswordResetContext'
import { Toaster } from '@/components/ui/toaster'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})

export function StoryProviders({ children, initialRoute = '/' }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <PasswordResetProvider>
            <MemoryRouter initialEntries={[initialRoute]}>
              {children}
              <Toaster />
            </MemoryRouter>
          </PasswordResetProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export const withProviders = (Story, context) => (
  <StoryProviders initialRoute={context.parameters?.route ?? '/'}>
    <Story />
  </StoryProviders>
)

export const withFullWidth = (Story) => (
  <div className="w-full min-w-[320px] max-w-6xl p-4">
    <Story />
  </div>
)
