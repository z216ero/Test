import AsyncStorage from '@react-native-async-storage/async-storage';

export type ClientGenderFilter = string;

export type ClientSlotsFilters = {
  specializations: string[];
  gender: ClientGenderFilter;
  districtOnly: boolean;
};

const STORAGE_KEY = 'clientSlots.filters.v3';

export const DEFAULT_CLIENT_SLOTS_FILTERS: ClientSlotsFilters = {
  specializations: [],
  gender: '',
  districtOnly: false,
};

const normalizeSpecializations = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const cleaned = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return Array.from(new Set(cleaned));
};

export const loadClientSlotsFilters = async (): Promise<ClientSlotsFilters> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_CLIENT_SLOTS_FILTERS;
    }

    const parsed = JSON.parse(raw) as Partial<ClientSlotsFilters> | null;
    if (!parsed) {
      return DEFAULT_CLIENT_SLOTS_FILTERS;
    }

    return {
      specializations: normalizeSpecializations(parsed.specializations),
      gender: typeof parsed.gender === 'string' ? parsed.gender : '',
      districtOnly: typeof parsed.districtOnly === 'boolean' ? parsed.districtOnly : false,
    };
  } catch {
    return DEFAULT_CLIENT_SLOTS_FILTERS;
  }
};

export const saveClientSlotsFilters = async (
  filters: ClientSlotsFilters
): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
};

export const clearClientSlotsFilters = async (): Promise<void> => {
  await AsyncStorage.removeItem(STORAGE_KEY);
};
