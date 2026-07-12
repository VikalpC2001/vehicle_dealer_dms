import { addons } from 'storybook/manager-api'
import { create } from 'storybook/theming/create'

addons.setConfig({
  theme: create({
    base: 'light',
    brandTitle: 'RTO Super Admin',
    brandUrl: '/',
    fontBase: '"Inter", sans-serif',
    colorPrimary: '#2563EB',
    colorSecondary: '#3B82F6',
  }),
})
