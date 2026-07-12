/**
 * Shared Storybook meta defaults aligned with Global Design System.md
 */
export const a11yNote = {
  keyboard: 'All interactive elements must be keyboard accessible via Radix primitives.',
  focus: 'Focus rings use ring-2 ring-ring — never remove without replacement.',
  contrast: 'Use text-foreground for primary content; text-muted-foreground for secondary only.',
}

export function componentDocs({ description, usage, a11y }) {
  return {
    docs: {
      description: {
        component: [description, usage && `\n\n**Usage:** ${usage}`, a11y && `\n\n**Accessibility:** ${a11y}`]
          .filter(Boolean)
          .join(''),
      },
    },
  }
}
