import { Construction } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

/**
 * Placeholder page for dealer features whose backend isn't built yet
 * (Agents + RTO assignment, Khata/Ledger). Replaced when the API lands.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.description]
 */
export default function ComingSoon({ title = 'Coming soon', description }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Construction className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold">Coming soon</h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              {description || 'This feature is on the roadmap and will be available in a future update.'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
