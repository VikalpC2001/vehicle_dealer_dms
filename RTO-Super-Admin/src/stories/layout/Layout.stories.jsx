import { AuthLayout } from '@/components/layout/AuthLayout'
import { LoginForm } from '@/components/forms/LoginForm'
import { Sidebar } from '@/components/layout/Sidebar'
import { withProviders, withFullWidth } from '../helpers/StoryProviders'

const meta = {
  title: 'Layout/App Shell',
  tags: ['autodocs'],
  decorators: [withProviders],
}
export default meta

export const AuthSplitScreen = {
  render: () => (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  ),
  parameters: { layout: 'fullscreen' },
  decorators: [withProviders],
}

export const SidebarDesktop = {
  render: () => (
    <div className="h-screen bg-background">
      <Sidebar collapsed={false} />
    </div>
  ),
  parameters: { layout: 'fullscreen' },
  decorators: [withProviders, withFullWidth],
}
