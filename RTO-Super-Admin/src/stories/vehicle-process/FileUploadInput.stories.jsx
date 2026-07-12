import { FileUploadInput } from '@/components/vehicle-process/FileUploadInput'
import { componentDocs } from '../helpers/storyMeta'

const meta = {
  title: 'Vehicle Process/FileUploadInput',
  component: FileUploadInput,
  tags: ['autodocs'],
  parameters: componentDocs({
    description: 'Image upload slot with preview, per-file status (idle/uploading/uploaded/error) and retry. Validates type/size before upload.',
    usage: 'Used in the create-process wizard, one per document category (two when bothSide). Wire onSelect to the upload flow.',
    a11y: 'Label is associated via htmlFor/id; icon-only remove button has aria-label; error state sets aria-invalid.',
  }),
  args: { id: 'rc-front', label: 'Registration Certificate', required: true, onSelect: () => {} },
}
export default meta

export const Idle = { args: { status: 'idle' } }
export const Uploading = { args: { status: 'uploading' } }
export const Uploaded = { args: { status: 'uploaded', previewUrl: 'https://placehold.co/200x120' } }
export const ErrorState = { args: { status: 'error', error: 'File is too large (max 5 MB).', onRetry: () => {} } }
