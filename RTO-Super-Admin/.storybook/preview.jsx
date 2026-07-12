import React, { useEffect } from 'react'
import '../src/index.css'
import { withThemeByClassName } from '@storybook/addon-themes'

/** @type { import('@storybook/react-vite').Preview } */
const preview = {
  parameters: {
    layout: 'centered',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo',
    },
    docs: {
      toc: true,
    },
    options: {
      storySort: {
        order: [
          'Introduction',
          'Design System',
          ['Colors', 'Typography', 'Spacing', 'Border Radius', 'Shadows', 'Animations'],
          'UI',
          'Common',
          'Dashboard',
          'Charts',
          'Tables',
          'Modals',
          'Forms',
          'Layout',
        ],
      },
    },
  },
  decorators: [
    withThemeByClassName({
      themes: {
        light: 'light',
        dark: 'dark',
      },
      defaultTheme: 'light',
    }),
    (Story) => (
      <div className="font-sans antialiased">
        <Story />
      </div>
    ),
  ],
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Light or dark mode',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
}

export default preview
