import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { createCity, listCities, listCitiesForDropdown, getCityById, updateCity, deleteCity } from '../services/city.service';
import { sendSuccess } from '../utils/api-response';
import type { PaginationQuery } from '../types';
import type { CreateCityBody, UpdateCityBody, CityIdParams, CityDropdownByStateParams } from '../validations/city.validation';

export async function createCityHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateCityBody;
  const city = await createCity(body);
  sendSuccess(res, 'City created', city, StatusCodes.CREATED);
}

export async function listCitiesHandler(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as PaginationQuery & { stateId?: string };
  const result = await listCities(query);
  sendSuccess(res, 'Cities retrieved', result);
}

export async function listCitiesForDropdownByStateHandler(req: Request, res: Response): Promise<void> {
  const { stateId } = req.params as unknown as CityDropdownByStateParams;
  const items = await listCitiesForDropdown(stateId);
  sendSuccess(res, 'Cities retrieved', items);
}

export async function getCityByIdHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as CityIdParams;
  const city = await getCityById(id);
  sendSuccess(res, 'City retrieved', city);
}

export async function updateCityHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as CityIdParams;
  const body = req.body as UpdateCityBody;
  const city = await updateCity(id, body);
  sendSuccess(res, 'City updated', city);
}

export async function deleteCityHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as CityIdParams;
  await deleteCity(id);
  sendSuccess(res, 'City deleted', {});
}

