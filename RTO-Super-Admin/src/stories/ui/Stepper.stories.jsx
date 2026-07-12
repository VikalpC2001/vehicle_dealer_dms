import { Stepper } from '@/components/ui/stepper'
import { componentDocs } from '../helpers/storyMeta'

const steps = [
  { label: 'Documents', description: 'Upload & scan' },
  { label: 'Verify', description: 'Confirm details' },
  { label: 'Review', description: 'Submit' },
]

const meta = {
  title: 'UI/Stepper',
  component: Stepper,
  tags: ['autodocs'],
  parameters: componentDocs({
    description: 'Horizontal step indicator for multi-step flows. Active/completed circles use gradient-bg; connectors fill with bg-primary as steps complete.',
    usage: 'Pass steps[], a 0-based current index, and optional completed[]. Provide onStepClick to allow back-navigation to visited steps.',
    a11y: 'The active step circle sets aria-current="step".',
  }),
}
export default meta

export const FirstStep = { args: { steps, current: 0 } }
export const MiddleStep = { args: { steps, current: 1, completed: [0] } }
export const LastStep = { args: { steps, current: 2, completed: [0, 1] } }
