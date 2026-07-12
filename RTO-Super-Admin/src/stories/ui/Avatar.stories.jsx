import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const meta = { title: 'UI/Avatar', component: Avatar, tags: ['autodocs'] }
export default meta

export const Fallback = {
  render: () => (
    <Avatar>
      <AvatarFallback className="gradient-bg text-white">SA</AvatarFallback>
    </Avatar>
  ),
}

export const WithImage = {
  render: () => (
    <Avatar>
      <AvatarImage src="https://api.dicebear.com/7.x/initials/svg?seed=Admin" alt="Admin" />
      <AvatarFallback>SA</AvatarFallback>
    </Avatar>
  ),
}

export const Sizes = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar className="h-9 w-9"><AvatarFallback className="gradient-bg text-white text-xs">SA</AvatarFallback></Avatar>
      <Avatar className="h-10 w-10"><AvatarFallback className="gradient-bg text-white text-sm">SA</AvatarFallback></Avatar>
      <Avatar className="h-20 w-20"><AvatarFallback className="gradient-bg text-white text-2xl">SA</AvatarFallback></Avatar>
    </div>
  ),
}
