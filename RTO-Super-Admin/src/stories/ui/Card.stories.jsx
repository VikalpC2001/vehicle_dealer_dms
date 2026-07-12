import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const meta = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}
export default meta

export const Default = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Supporting description text</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">Card content goes here.</p>
      </CardContent>
      <CardFooter>
        <Button>Action</Button>
      </CardFooter>
    </Card>
  ),
}

export const HoverElevated = {
  render: () => (
    <Card className="w-72 transition-shadow hover:shadow-md cursor-pointer">
      <CardContent className="p-6">
        <p className="font-bold">Interactive Card</p>
        <p className="text-sm text-muted-foreground mt-1">hover:shadow-md</p>
      </CardContent>
    </Card>
  ),
}
