import type { Module, Page, PageAction, Prisma, RoleType } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';

import { prisma } from '../config/prisma';
import { AppError } from '../utils/app-error';

/** Module with nested pages and actions (catalog view). */
export type ModuleWithPagesAndActions = Module & {
  pages: Array<
    Page & {
      actions: PageAction[];
    }
  >;
};

/**
 * Syncs all modules for a module type: update by id, create without id, delete missing.
 * `sortOrder` is set from the array index (0-based).
 */
export async function syncModulesForModuleType(
  moduleType: RoleType,
  items: Array<{ moduleId?: string; moduleName: string; description?: string | null }>,
): Promise<Module[]> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.module.findMany({
      where: { moduleType },
      orderBy: { sortOrder: 'asc' },
    });
    const existingById = new Map(existing.map((m) => [m.moduleId, m]));
    const incomingIds = new Set<string>();
    const results: Module[] = [];

    for (let index = 0; index < items.length; index += 1) {
      const { moduleId, moduleName, description } = items[index];
      const sortOrder = index;

      if (moduleId) {
        const row = existingById.get(moduleId);
        if (!row) {
          throw new AppError('Module not found', StatusCodes.NOT_FOUND, 4042);
        }
        if (row.moduleType !== moduleType) {
          throw new AppError(
            'Module does not belong to this module type',
            StatusCodes.BAD_REQUEST,
            4008,
          );
        }
        const updated = await tx.module.update({
          where: { moduleId },
          data: {
            moduleName,
            description: description === undefined ? undefined : description,
            sortOrder,
          },
        });
        incomingIds.add(moduleId);
        results.push(updated);
      } else {
        const created = await tx.module.create({
          data: {
            moduleType,
            moduleName,
            description: description ?? null,
            sortOrder,
          },
        });
        incomingIds.add(created.moduleId);
        results.push(created);
      }
    }

    const toDelete = existing.filter((m) => !incomingIds.has(m.moduleId));
    if (toDelete.length > 0) {
      await tx.module.deleteMany({
        where: {
          moduleId: { in: toDelete.map((m) => m.moduleId) },
        },
      });
    }

    return results;
  });
}

/**
 * Syncs all pages under a module. Deletes pages not listed (cascades actions / permissions).
 */
export async function syncPagesForModule(
  moduleId: string,
  items: Array<{
    pageId?: string;
    pageName: string;
    slug: string;
    description?: string | null;
  }>,
): Promise<Page[]> {
  return prisma.$transaction(async (tx) => {
    const moduleRow = await tx.module.findUnique({ where: { moduleId } });
    if (!moduleRow) {
      throw new AppError('Module not found', StatusCodes.NOT_FOUND, 4042);
    }

    const existing = await tx.page.findMany({
      where: { moduleId },
      orderBy: { sortOrder: 'asc' },
    });
    const existingById = new Map(existing.map((p) => [p.pageId, p]));
    const incomingIds = new Set<string>();
    const results: Page[] = [];

    for (let index = 0; index < items.length; index += 1) {
      const { pageId, pageName, slug, description } = items[index];
      const sortOrder = index;

      if (pageId) {
        const row = existingById.get(pageId);
        if (!row) {
          throw new AppError('Page not found', StatusCodes.NOT_FOUND, 4043);
        }
        if (row.moduleId !== moduleId) {
          throw new AppError('Page does not belong to this module', StatusCodes.BAD_REQUEST, 4009);
        }
        const updated = await tx.page.update({
          where: { pageId },
          data: {
            pageName,
            slug,
            description: description === undefined ? undefined : description,
            sortOrder,
          },
        });
        incomingIds.add(pageId);
        results.push(updated);
      } else {
        const created = await tx.page.create({
          data: {
            moduleId,
            pageName,
            slug,
            description: description ?? null,
            sortOrder,
          },
        });
        incomingIds.add(created.pageId);
        results.push(created);
      }
    }

    const toDelete = existing.filter((p) => !incomingIds.has(p.pageId));
    if (toDelete.length > 0) {
      await tx.page.deleteMany({
        where: { pageId: { in: toDelete.map((p) => p.pageId) } },
      });
    }

    return results;
  });
}

/**
 * Syncs all actions under a page. Deletes actions not listed.
 */
export async function syncPageActionsForPage(
  pageId: string,
  items: Array<{
    actionId?: string;
    actionName: string;
    label?: string | null;
  }>,
): Promise<PageAction[]> {
  return prisma.$transaction(async (tx) => {
    const pageRow = await tx.page.findUnique({ where: { pageId } });
    if (!pageRow) {
      throw new AppError('Page not found', StatusCodes.NOT_FOUND, 4043);
    }

    const existing = await tx.pageAction.findMany({
      where: { pageId },
      orderBy: { actionName: 'asc' },
    });
    const existingById = new Map(existing.map((a) => [a.actionId, a]));
    const incomingIds = new Set<string>();
    const results: PageAction[] = [];

    for (let index = 0; index < items.length; index += 1) {
      const { actionId, actionName, label } = items[index];
      const sortOrder = index;

      if (actionId) {
        const row = existingById.get(actionId);
        if (!row) {
          throw new AppError('Page action not found', StatusCodes.NOT_FOUND, 4044);
        }
        if (row.pageId !== pageId) {
          throw new AppError('Action does not belong to this page', StatusCodes.BAD_REQUEST, 4013);
        }
        const updated = await tx.pageAction.update({
          where: { actionId },
          data: {
            actionName,
            label: label === undefined ? undefined : label,
            sortOrder,
          } as unknown as Prisma.PageActionUncheckedUpdateInput,
        });
        incomingIds.add(actionId);
        results.push(updated);
      } else {
        const created = await tx.pageAction.create({
          data: {
            pageId,
            actionName,
            label: label ?? null,
            sortOrder,
          } as unknown as Prisma.PageActionUncheckedCreateInput,
        });
        incomingIds.add(created.actionId);
        results.push(created);
      }
    }

    const toDelete = existing.filter((a) => !incomingIds.has(a.actionId));
    if (toDelete.length > 0) {
      await tx.pageAction.deleteMany({
        where: { actionId: { in: toDelete.map((a) => a.actionId) } },
      });
    }

    return results;
  });
}

/**
 * Returns modules of a given type with pages and actions ordered by `sortOrder`.
 * Nested `actions` use `include: { actions: true }` and are sorted in memory by `sortOrder`
 * (avoids nested `orderBy: { sortOrder }` where some tooling surfaces stale Prisma types).
 */
export async function findCatalogByModuleType(
  moduleType: RoleType,
): Promise<ModuleWithPagesAndActions[]> {
  const rows = await prisma.module.findMany({
    where: { moduleType },
    orderBy: { sortOrder: 'asc' },
    include: {
      pages: {
        orderBy: { sortOrder: 'asc' },
        include: {
          actions: true,
        },
      },
    },
  });

  return rows.map((m) => ({
    ...m,
    pages: m.pages.map((p) => ({
      ...p,
      actions: [...p.actions].sort(
        (a, b) => getPageActionSortOrder(a) - getPageActionSortOrder(b),
      ),
    })),
  }));
}

/**
 * Reads `sortOrder` from a loaded PageAction row.
 * Uses a narrow cast so stale Prisma typings (without `sortOrder`) do not break the build.
 */
function getPageActionSortOrder(a: PageAction): number {
  return (a as unknown as { sortOrder: number }).sortOrder;
}
