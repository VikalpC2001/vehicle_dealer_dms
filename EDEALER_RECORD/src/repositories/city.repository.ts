import { prisma } from '../config/prisma';
import type { City } from '@prisma/client';

export type CityDropdownItem = Pick<City, 'cityId' | 'cityName' | 'stateId'>;

export interface CreateCityData {
  stateId: string;
  cityName: string;
}

export interface UpdateCityData {
  cityName: string;
}

export async function createCity(data: CreateCityData): Promise<City> {
  return prisma.city.create({ data });
}

export async function listCities(
  skip: number,
  take: number,
  stateId?: string,
): Promise<{ items: City[]; total: number }> {
  const where = stateId ? { stateId } : {};
  const [items, total] = await Promise.all([
    prisma.city.findMany({
      where,
      skip,
      take,
      orderBy: { cityName: 'asc' },
    }),
    prisma.city.count({ where }),
  ]);
  return { items, total };
}

export async function listCitiesForDropdown(stateId: string): Promise<CityDropdownItem[]> {
  return prisma.city.findMany({
    where: { stateId },
    select: { cityId: true, cityName: true, stateId: true },
    orderBy: { cityName: 'asc' },
  });
}

export async function findCityById(cityId: string): Promise<City | null> {
  return prisma.city.findUnique({ where: { cityId } });
}

export async function findCityByStateAndName(
  stateId: string,
  cityName: string,
  excludeCityId?: string,
): Promise<City | null> {
  return prisma.city.findFirst({
    where: {
      stateId,
      cityName,
      ...(excludeCityId && { cityId: { not: excludeCityId } }),
    },
  });
}

export async function updateCity(cityId: string, data: UpdateCityData): Promise<City> {
  return prisma.city.update({ where: { cityId }, data });
}

export async function deleteCity(cityId: string): Promise<City> {
  return prisma.city.delete({ where: { cityId } });
}

