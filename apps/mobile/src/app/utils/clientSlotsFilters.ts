import AsyncStorage from '@react-native-async-storage/async-storage';

export type ClientGenderFilter = 'Men' | 'Women' | 'All';

export type ClientSlotsFilters = {
  specializations: string[];
  gender: ClientGenderFilter;
};

export const CLIENT_SLOTS_SPECIALIZATIONS = [
  'Силовой тренинг',
  'Функциональный тренинг',
  'Набор мышечной массы',
  'Похудение',
  'Реабилитация/ЛФК',
  'Стретчинг',
  'Кроссфит',
  'Йога',
  'Пилатес',
  'Подготовка к соревнованиям',
] as const;

const SPECIALIZATION_ALIASES: Record<string, string[]> = {
  'Силовой тренинг': ['Силовая тренировка'],
  'Функциональный тренинг': ['Функциональная тренировка'],
  'Набор мышечной массы': ['Набор массы'],
  'Реабилитация/ЛФК': ['Реабилитация'],
  'Стретчинг': ['Растяжка / Mobility'],
};

const STORAGE_KEY = 'clientSlots.filters.v1';

export const DEFAULT_CLIENT_SLOTS_FILTERS: ClientSlotsFilters = {
  specializations: [],
  gender: 'All',
};

const normalizeGender = (value?: string | null): ClientGenderFilter => {
  if (value === 'Men' || value === 'Women' || value === 'All') {
    return value;
  }
  return 'All';
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
      gender: normalizeGender(parsed.gender ?? null),
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

export const expandSpecializationsForApi = (values: string[]): string[] => {
  const expanded = values.flatMap((value) => [
    value,
    ...(SPECIALIZATION_ALIASES[value] ?? []),
  ]);

  return Array.from(new Set(expanded));
};
