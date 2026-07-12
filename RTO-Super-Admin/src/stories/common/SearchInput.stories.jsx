import { useState } from 'react'
import { SearchInput } from '@/components/common/SearchInput'

const meta = { title: 'Common/SearchInput', component: SearchInput, tags: ['autodocs'], parameters: { layout: 'padded' } }
export default meta

export const Default = {
  render: function Render() {
    const [value, setValue] = useState('')
    return <SearchInput value={value} onChange={setValue} placeholder="Search users..." className="w-72" />
  },
}
