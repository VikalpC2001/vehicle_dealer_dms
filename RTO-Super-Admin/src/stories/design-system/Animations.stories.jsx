import { motion } from 'framer-motion'

const meta = {
  title: 'Design System/Animations',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Framer Motion for page transitions, staggered lists, card hover (scale 1.02). CSS transitions: 200–500ms.',
      },
    },
  },
}
export default meta

export const CardHover = {
  render: () => (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="rounded-xl border border-border bg-card p-6 shadow-sm w-48 cursor-pointer"
    >
      <p className="font-bold text-sm">whileHover scale 1.02</p>
    </motion.div>
  ),
}

export const FadeInUp = {
  render: () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-border bg-card p-6 w-64"
    >
      <p className="font-bold text-sm">Fade In + Slide Up</p>
      <p className="text-xs text-muted-foreground mt-1">opacity 0→1, y 20→0</p>
    </motion.div>
  ),
}

export const StaggeredList = {
  render: () => (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="rounded-lg border border-border bg-card p-3 text-sm font-medium"
        >
          List item {i + 1} — delay {i * 0.1}s
        </motion.div>
      ))}
    </div>
  ),
}

export const TransitionDurations = {
  render: () => (
    <table className="text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left p-2 text-muted-foreground">Element</th>
          <th className="text-left p-2 text-muted-foreground">Duration</th>
        </tr>
      </thead>
      <tbody>
        {[
          ['Buttons', '200ms'],
          ['Theme switch', '300ms'],
          ['Page transition', '300ms'],
          ['Progress bar', '500ms'],
          ['Card hover', 'default + scale'],
        ].map(([el, dur]) => (
          <tr key={el} className="border-b border-border">
            <td className="p-2 font-medium">{el}</td>
            <td className="p-2 text-muted-foreground">{dur}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
}
