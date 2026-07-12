import { StatusCodes } from 'http-status-codes';
import type { City } from '@prisma/client';
import * as cityRepository from '../repositories/city.repository';
import * as stateRepository from '../repositories/state.repository';
import { AppError } from '../utils/app-error';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import type { PaginationQuery, PaginatedResult } from '../types';
import type { CityDropdownItem } from '../repositories/city.repository';

export interface CreateCityInput {
  stateId: string;
  cityName: string;
}

export interface UpdateCityInput {
  cityName: string;
}

export async function createCity(input: CreateCityInput): Promise<City> {
  const state = await stateRepository.findStateById(input.stateId);
  if (!state) {
    throw new AppError('State not found', StatusCodes.NOT_FOUND, 4048);
  }

  const existing = await cityRepository.findCityByStateAndName(input.stateId, input.cityName);
  if (existing) {
    throw new AppError('City name already exists for this state', StatusCodes.CONFLICT, 4104);
  }

  return cityRepository.createCity({ stateId: input.stateId, cityName: input.cityName });
}

export async function listCities(
  query: PaginationQuery & { stateId?: string },
): Promise<PaginatedResult<City>> {
  const { skip, take } = parsePagination(query);
  const { items, total } = await cityRepository.listCities(skip, take, query.stateId);
  const meta = buildPaginationMeta(total, query);
  return { data: items, meta };
}

export async function listCitiesForDropdown(stateId: string): Promise<CityDropdownItem[]> {
  const state = await stateRepository.findStateById(stateId);
  if (!state) {
    throw new AppError('State not found', StatusCodes.NOT_FOUND, 4048);
  }
  return cityRepository.listCitiesForDropdown(stateId);
}

export async function getCityById(cityId: string): Promise<City> {
  const city = await cityRepository.findCityById(cityId);
  if (!city) {
    throw new AppError('City not found', StatusCodes.NOT_FOUND, 4049);
  }
  return city;
}

export async function updateCity(cityId: string, input: UpdateCityInput): Promise<City> {
  const current = await getCityById(cityId);
  const existing = await cityRepository.findCityByStateAndName(current.stateId, input.cityName, cityId);
  if (existing) {
    throw new AppError('City name already exists for this state', StatusCodes.CONFLICT, 4104);
  }
  return cityRepository.updateCity(cityId, { cityName: input.cityName });
}

export async function deleteCity(cityId: string): Promise<void> {
  await getCityById(cityId);
  await cityRepository.deleteCity(cityId);
}

