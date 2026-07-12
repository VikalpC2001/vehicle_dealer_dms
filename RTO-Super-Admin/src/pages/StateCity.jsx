import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { StatesTab } from '@/components/locations/StatesTab'
import { CitiesTab } from '@/components/locations/CitiesTab'

export default function StateCity() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-bg shrink-0">
            <MapPin className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">State & City</h1>
            <p className="text-muted-foreground mt-1">Manage states and cities for dealer registration and address data</p>
          </div>
        </div>
      </motion.div>

      <Tabs defaultValue="states" className="space-y-4">
        <TabsList>
          <TabsTrigger value="states">States</TabsTrigger>
          <TabsTrigger value="cities">Cities</TabsTrigger>
        </TabsList>

        <TabsContent value="states">
          <Card>
            <CardContent className="p-6">
              <StatesTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cities">
          <Card>
            <CardContent className="p-6">
              <CitiesTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
