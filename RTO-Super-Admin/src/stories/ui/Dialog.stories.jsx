import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const meta = { title: 'UI/Dialog', component: Dialog, tags: ['autodocs'], parameters: { layout: 'centered' } }
export default meta

export const Default = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild><Button variant="outline">Open Dialog</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Action</DialogTitle>
          <DialogDescription>This action will be logged in the activity feed.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}
