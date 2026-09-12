/**
 * Shared source of truth for the dealer "Roles & Permissions" fixed-capability checklist.
 *
 * A dealer role (`DealerRole.capabilities`) is a subset of these capability KEYS. The catalog is
 * curated (not stored in DB) so the backend, the frontend checklist, and validation all agree on
 * the exact set of grantable capabilities. This is deliberately NOT the generic
 * Module/Page/PageAction RBAC tables — those stay dormant for the dealer app.
 *
 * Access model:
 * - The dealership OWNER (the account that registered) implicitly has ALL capabilities.
 * - An employee with an assigned `roleId` has exactly that role's `capabilities`.
 * - An employee with no role falls back to {@link READONLY_DEFAULT_CAPABILITIES}.
 */

/** A single grantable capability in the dealer checklist. */
export interface DealerCapability {
  /** Stable machine key stored in `DealerRole.capabilities` and checked by guards. */
  readonly key: string;
  /** Human-readable label shown next to the checkbox in the FE. */
  readonly label: string;
  /** UI grouping header the capability is listed under. */
  readonly group: string;
}

/**
 * The full capability catalog, in display order and grouped for the FE checklist. The `key`s here
 * are the ONLY valid values for a role's `capabilities[]`.
 */
export const CAPABILITIES = [
  { key: 'processes.view', label: 'View processes', group: 'Vehicle Processes' },
  {
    key: 'processes.manage',
    label: 'Create & edit processes/deal/persons/documents',
    group: 'Vehicle Processes',
  },
  {
    key: 'tasks.viewAll',
    label: 'See ALL tasks on the board (else only own)',
    group: 'Tasks & Board',
  },
  { key: 'tasks.manage', label: 'Create, edit, assign & move tasks', group: 'Tasks & Board' },
  { key: 'taskStatuses.manage', label: 'Manage task-board statuses', group: 'Configuration' },
  { key: 'jobTemplates.manage', label: 'Manage job templates', group: 'Configuration' },
  { key: 'references.manage', label: 'Manage references', group: 'Configuration' },
  { key: 'documents.manage', label: 'Manage document/upload config', group: 'Configuration' },
  { key: 'employees.manage', label: 'Add & remove employees', group: 'People' },
  { key: 'roles.manage', label: 'Manage roles & permissions', group: 'People' },
  { key: 'agents.manage', label: 'Manage agents', group: 'Agents & Money' },
  { key: 'ledger.view', label: 'View khata/ledger', group: 'Agents & Money' },
] as const satisfies readonly DealerCapability[];

/** Union of every valid capability key. */
export type CapabilityKey = (typeof CAPABILITIES)[number]['key'];

/** Flat list of every valid capability key (owner/super-admin get all of these). */
export const ALL_CAPABILITY_KEYS: CapabilityKey[] = CAPABILITIES.map((c) => c.key);

/** Capabilities granted to a dealer employee who has no role assigned (read-only default). */
export const READONLY_DEFAULT_CAPABILITIES: CapabilityKey[] = ['processes.view'];

/** Fast membership set for validation. */
const CAPABILITY_KEY_SET: ReadonlySet<string> = new Set<string>(ALL_CAPABILITY_KEYS);

/**
 * Type guard: whether `key` is a known capability in the catalog.
 *
 * @param key - Candidate capability key.
 */
export function isCapabilityKey(key: string): key is CapabilityKey {
  return CAPABILITY_KEY_SET.has(key);
}

/**
 * Returns the keys in `keys` that are NOT in the catalog (empty when all are valid). Used to reject
 * unknown capability keys when creating/updating a role.
 *
 * @param keys - Capability keys to check.
 */
export function findUnknownCapabilities(keys: readonly string[]): string[] {
  return keys.filter((k) => !CAPABILITY_KEY_SET.has(k));
}
