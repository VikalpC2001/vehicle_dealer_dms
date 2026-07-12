import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const meta = { title: 'UI/Tabs', component: Tabs, tags: ['autodocs'], parameters: { layout: 'padded' } }
export default meta

export const Default = {
  render: () => (
    <Tabs defaultValue="all" className="w-96">
      <TabsList>
        <TabsTrigger value="all">All Users</TabsTrigger>
        <TabsTrigger value="dealers">Dealers</TabsTrigger>
        <TabsTrigger value="agents">Agents</TabsTrigger>
      </TabsList>
      <TabsContent value="all"><p className="text-sm text-muted-foreground p-4">All users content</p></TabsContent>
      <TabsContent value="dealers"><p className="text-sm text-muted-foreground p-4">Dealers content</p></TabsContent>
      <TabsContent value="agents"><p className="text-sm text-muted-foreground p-4">Agents content</p></TabsContent>
    </Tabs>
  ),
}
