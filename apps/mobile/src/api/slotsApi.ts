import type { AvailableSlotGroupDto, GetSlotsAvailableParams } from '@generated/api';
import { getSlotsAvailable } from '@generated/api';
import { t } from '@i18n';
import { unwrap } from './core';

export const getAvailableSlotsForClient = async (
  params?: GetSlotsAvailableParams,
  options?: RequestInit
): Promise<AvailableSlotGroupDto[]> => {
  const response = await getSlotsAvailable(params, options);
  return unwrap<AvailableSlotGroupDto[]>(response, t('errors.generic'));
};


