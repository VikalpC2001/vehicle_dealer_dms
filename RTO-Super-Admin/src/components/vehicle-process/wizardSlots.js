/**
 * Shared helpers for the upload "slots" in the create-process wizard. A category with
 * `bothSide` has two slots (front/back); otherwise a single slot. Keeping the key,
 * label, and payload-category logic here keeps the step and the wizard in sync.
 */

/** Sides to render for a category. */
export function sidesForCategory(category) {
  return category?.bothSide ? ['front', 'back'] : ['single']
}

/** Stable slot key: `${categoryId}:${side}`. */
export function slotKey(categoryId, side) {
  return `${categoryId}:${side}`
}

/** Visible label for an upload input. */
export function sideLabel(category, side) {
  const name = category?.categoryName ?? 'Document'
  if (side === 'single') return name
  return `${name} (${side === 'front' ? 'Front' : 'Back'})`
}

/** Category label stored on the process photo (e.g. "RC Front"), matching the API example. */
export function payloadCategory(category, side) {
  const name = category?.categoryName ?? 'Document'
  if (side === 'single') return name
  return `${name} ${side === 'front' ? 'Front' : 'Back'}`
}
