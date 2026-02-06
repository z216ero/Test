import { getLocale } from '@i18n';
import { unwrap } from './core';
import { customFetch } from './custom-fetch';

export type LookupItem = {
  code: string;
  label: string;
  isDefault?: boolean;
  isAny?: boolean;
  isTrainerRole?: boolean | null;
  isClientRole?: boolean | null;
};

export type LookupResponse = {
  items?: LookupItem[];
};

export type CityDto = {
  id?: number;
  name?: string | null;
};

export type DistrictDto = {
  id?: number;
  cityId?: number;
  name?: string | null;
};

const buildLookupUrl = (path: string): string => {
  const locale = getLocale();
  return `/lookups/${path}?lang=${encodeURIComponent(locale)}`;
};

const fetchLookup = async (path: string, options?: RequestInit): Promise<LookupItem[]> => {
  const response = await customFetch(buildLookupUrl(path), options);
  const data = unwrap<LookupResponse>(response, 'Unable to load lookups.');
  return data.items ?? [];
};

export const getRoleLookups = async (options?: RequestInit): Promise<LookupItem[]> => (
  fetchLookup('roles', options)
);

export const getGenderLookups = async (options?: RequestInit): Promise<LookupItem[]> => (
  fetchLookup('genders', options)
);

export const getLevelLookups = async (options?: RequestInit): Promise<LookupItem[]> => (
  fetchLookup('levels', options)
);

export const getGoalLookups = async (options?: RequestInit): Promise<LookupItem[]> => (
  fetchLookup('goals', options)
);

export const getSpecializationLookups = async (options?: RequestInit): Promise<LookupItem[]> => (
  fetchLookup('specializations', options)
);

export const getTrainingTypeLookups = async (options?: RequestInit): Promise<LookupItem[]> => (
  fetchLookup('training-types', options)
);

export const getSlotStatusLookups = async (options?: RequestInit): Promise<LookupItem[]> => (
  fetchLookup('slot-statuses', options)
);

export const getBookingStatusLookups = async (options?: RequestInit): Promise<LookupItem[]> => (
  fetchLookup('booking-statuses', options)
);

export const getPaymentStatusLookups = async (options?: RequestInit): Promise<LookupItem[]> => (
  fetchLookup('payment-statuses', options)
);

export const getPaymentMethodLookups = async (options?: RequestInit): Promise<LookupItem[]> => (
  fetchLookup('payment-methods', options)
);

export const getDateFilterLookups = async (options?: RequestInit): Promise<LookupItem[]> => (
  fetchLookup('date-filters', options)
);

export const getSortOptionLookups = async (options?: RequestInit): Promise<LookupItem[]> => (
  fetchLookup('sort-options', options)
);

export const getCities = async (query?: string, options?: RequestInit): Promise<CityDto[]> => {
  const search = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
  const response = await customFetch(`/lookups/cities${search}`, options);
  return unwrap<CityDto[]>(response, 'Unable to load cities.');
};

export const getDistricts = async (
  cityId?: number,
  query?: string,
  options?: RequestInit
): Promise<DistrictDto[]> => {
  const params: string[] = [];
  if (typeof cityId === 'number') {
    params.push(`cityId=${encodeURIComponent(String(cityId))}`);
  }
  if (query?.trim()) {
    params.push(`q=${encodeURIComponent(query.trim())}`);
  }
  const search = params.length > 0 ? `?${params.join('&')}` : '';
  const response = await customFetch(`/lookups/districts${search}`, options);
  return unwrap<DistrictDto[]>(response, 'Unable to load districts.');
};
