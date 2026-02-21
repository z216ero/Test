import type { SlotDto } from '@generated/api';
import type { ClientSlotsFilters } from '@app/utils/clientSlotsFilters';

export const getDefaultCode = (items: { code: string; isDefault?: boolean }[]) =>
  items.find((item) => item.isDefault)?.code ?? items[0]?.code ?? '';

export const getAnyCode = (items: { code: string; isAny?: boolean }[]) =>
  items.find((item) => item.isAny)?.code ?? '';

const sortByOrder = (values: string[], order: Map<string, number>): string[] =>
  [...new Set(values)].sort((left, right) => {
    const leftIndex = order.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = order.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });

export const normalizeFilters = (
  filters: ClientSlotsFilters,
  specializationOrder: Map<string, number>,
  allowedSpecializations: Set<string>,
  defaultGender: string,
  canFilterDistrict: boolean
): ClientSlotsFilters => {
  const specializations = filters.specializations.filter((item) => allowedSpecializations.has(item));
  const gender = filters.gender || defaultGender;
  const districtOnly = canFilterDistrict ? filters.districtOnly : false;
  return {
    gender,
    specializations: sortByOrder(specializations, specializationOrder),
    districtOnly,
  };
};

export const sortSlotsByStart = (left: SlotDto, right: SlotDto) => {
  const leftTs = left.startsAtUtc ? new Date(left.startsAtUtc).getTime() : 0;
  const rightTs = right.startsAtUtc ? new Date(right.startsAtUtc).getTime() : 0;
  return leftTs - rightTs;
};

