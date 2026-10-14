import { useId, useState } from 'react'
import { OtpInput } from '@/components/ui/otp-input'
import { Label } from '@/components/ui/label'
import { componentDocs } from '../helpers/storyMeta'

const meta = {
  title: 'UI/OtpInput',
  component: OtpInput,
  tags: ['autodocs'],
  parameters: componentDocs({
    description: 'One-time-code entry: one box per digit in two groups, backed by a single real input.',
    usage: 'Controlled: pass value + onChange. Set invalid after a wrong code and clear it when the value changes.',
    a11y: 'It is one text field to assistive tech — give it a Label via htmlFor/id (or aria-label).',
  }),
}
export default meta

function Demo(props) {
  const id = useId() // the docs page renders every story in one document
  const [value, setValue] = useState(props.value ?? '')
  return (
    <div className="w-80 space-y-2">
      <Label htmlFor={id}>Verification code</Label>
      <OtpInput id={id} {...props} value={value} onChange={setValue} />
    </div>
  )
}

export const Empty = { render: () => <Demo /> }
export const PartlyFilled = { render: () => <Demo value="482" /> }
export const Complete = { render: () => <Demo value="482913" /> }
export const Invalid = { render: () => <Demo value="482913" invalid /> }
export const Disabled = { render: () => <Demo value="482" disabled /> }
export const FourDigits = { render: () => <Demo length={4} /> }
