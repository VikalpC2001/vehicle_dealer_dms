import { Prisma } from '@prisma/client';
import type { Module, Page, PageAction, RoleType } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';

import * as rbacNavigationRepository from '../repositories/rbac-navigation.repository';
import type { ModuleWithPagesAndActions } from '../repositories/rbac-navigation.repository';
import { AppError } from '../utils/app-error';

/** Payload item for module sync. */
export interface ModuleSyncItem {
  moduleId?: string;
  moduleName: string;
  description?: string | null;
}

/** Payload item for page sync. */
export interface PageSyncItem {
  pageId?: string;
  pageName: string;
  slug: string;
  description?: string | null;
}

/** Payload item for page action sync. */
export interface PageActionSyncItem {
  actionId?: string;
  actionName: string;
  label?: string | null;
}

/**
 * Syncs modules for a `moduleType`: create (no id), update (with id), delete missing.
 * `sortOrder` is assigned from array order (0-based).
 */
export async function syncModules(input: {
  moduleType: RoleType;
  modules: ModuleSyncItem[];
}): Promise<Module[]> {
  if (input.modules.length === 0) {
    throw new AppError(
      'At least one module is required',
      StatusCodes.UNPROCESSABLE_ENTITY,
      4221,
    );
  }

  const names = input.modules.map((m) => m.moduleName.trim());
  if (new Set(names).size !== names.length) {
    throw new AppError(
      'Duplicate moduleName in payload for this module type',
      StatusCodes.UNPROCESSABLE_ENTITY,
      4222,
    );
  }

  const normalized = input.modules.map((m) => ({
    ...m,
    moduleName: m.moduleName.trim(),
  }));

  try {
    return await rbacNavigationRepository.syncModulesForModuleType(
      input.moduleType,
      normalized,
    );
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(
        'A module with this name already exists for this module type',
        StatusCodes.CONFLICT,
        4092,
      );
    }
    throw err;
  }
}

/**
 * Syncs pages under a module: create, update, delete missing.
 */
export async function syncPages(input: {
  moduleId: string;
  pages: PageSyncItem[];
}): Promise<Page[]> {
  const slugs = input.pages.map((p) => p.slug.trim());
  if (new Set(slugs).size !== slugs.length) {
    throw new AppError(
      'Duplicate slug in payload for this module',
      StatusCodes.UNPROCESSABLE_ENTITY,
      4223,
    );
  }

  const normalized = input.pages.map((p) => ({
    ...p,
    pageName: p.pageName.trim(),
    slug: p.slug.trim(),
  }));

  try {
    return await rbacNavigationRepository.syncPagesForModule(input.moduleId, normalized);
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(
        'A page with this slug already exists in this module',
        StatusCodes.CONFLICT,
        4093,
      );
    }
    throw err;
  }
}

/**
 * Syncs actions under a page: create, update, delete missing.
 */
export async function syncPageActions(input: {
  pageId: string;
  actions: PageActionSyncItem[];
}): Promise<PageAction[]> {
  const keys = input.actions.map((a) => a.actionName.trim().toUpperCase());
  if (new Set(keys).size !== keys.length) {
    throw new AppError(
      'Duplicate actionName in payload for this page',
      StatusCodes.UNPROCESSABLE_ENTITY,
      4224,
    );
  }

  const normalized = input.actions.map((a) => ({
    ...a,
    actionName: a.actionName.trim(),
  }));

  try {
    return await rbacNavigationRepository.syncPageActionsForPage(input.pageId, normalized);
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(
        'An action with this name already exists on this page',
        StatusCodes.CONFLICT,
        4094,
      );
    }
    throw err;
  }
}

/**
 * Returns the module → page → action tree for a module type, ordered by `sortOrder`.
 */
export async function getCatalog(moduleType: RoleType): Promise<ModuleWithPagesAndActions[]> {
  return rbacNavigationRepository.findCatalogByModuleType(moduleType);
}
