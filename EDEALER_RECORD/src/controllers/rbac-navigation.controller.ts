import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import {
  syncModules,
  syncPages,
  syncPageActions,
  getCatalog,
} from '../services/rbac-navigation.service';
import { sendSuccess } from '../utils/api-response';
import type {
  SyncModulesBody,
  SyncPagesBody,
  SyncPageActionsBody,
  GetRbacCatalogQuery,
} from '../validations/rbac-navigation.validation';

/**
 * POST /rbac/modules/sync
 * Replaces all modules for the given module type (create / update / delete missing).
 */
export async function syncModulesHandler(req: Request, res: Response): Promise<void> {
  const { moduleType, modules } = req.body as SyncModulesBody;
  const result = await syncModules({ moduleType, modules });
  sendSuccess(res, 'Modules synced', result, StatusCodes.OK);
}

/**
 * POST /rbac/pages/sync
 * Replaces all pages under a module.
 */
export async function syncPagesHandler(req: Request, res: Response): Promise<void> {
  const { moduleId, pages } = req.body as SyncPagesBody;
  const result = await syncPages({ moduleId, pages });
  sendSuccess(res, 'Pages synced', result, StatusCodes.OK);
}

/**
 * POST /rbac/page-actions/sync
 * Replaces all actions under a page.
 */
export async function syncPageActionsHandler(req: Request, res: Response): Promise<void> {
  const { pageId, actions } = req.body as SyncPageActionsBody;
  const result = await syncPageActions({ pageId, actions });
  sendSuccess(res, 'Page actions synced', result, StatusCodes.OK);
}

/**
 * GET /rbac/catalog?moduleType=DEALER|AGENT
 * Returns modules with nested pages and actions ordered by sortOrder.
 */
export async function getRbacCatalogHandler(req: Request, res: Response): Promise<void> {
  const { moduleType } = req.query as unknown as GetRbacCatalogQuery;
  const catalog = await getCatalog(moduleType);
  sendSuccess(res, 'RBAC catalog retrieved', catalog);
}
