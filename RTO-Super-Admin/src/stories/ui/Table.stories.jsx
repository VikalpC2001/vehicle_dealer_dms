import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

const meta = { title: 'UI/Table', tags: ['autodocs'], parameters: { layout: 'padded' } }
export default meta

export const Default = {
  render: () => (
    <div className="rounded-xl border border-border bg-card overflow-hidden w-full max-w-2xl">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-semibold">Rajesh Kumar</TableCell>
            <TableCell><Badge variant="secondary">dealer</Badge></TableCell>
            <TableCell>active</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-semibold">Priya Sharma</TableCell>
            <TableCell><Badge variant="secondary">agent</Badge></TableCell>
            <TableCell>active</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  ),
}
