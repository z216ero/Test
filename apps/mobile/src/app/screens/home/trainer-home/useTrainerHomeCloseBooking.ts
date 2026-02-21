import { useCallback } from 'react';
import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { closeTrainerBooking, type PaymentMethod } from '@api/trainerSlotsApi';
import { presentApiError, shouldShowErrorToast } from '@api/ApiErrorPresenter';
import type { SlotDto } from '@generated/api';
import { t } from '@i18n';
import { useAppMutation } from '@query/hooks';
import { keys } from '@query/keys';

type SlotsSnapshot = Array<[QueryKey, SlotDto[] | undefined]>;

type CloseBookingVariables = {
  slotId: string;
  bookingId: string;
  attendance: 'Completed' | 'NoShow';
  markPaid: boolean;
  method: PaymentMethod | null;
};

type UseTrainerHomeCloseBookingArgs = {
  closeSheet: () => void;
  showToast: (payload: {
    type: 'error';
    title: string;
    message?: string;
  }) => void;
};

export function useTrainerHomeCloseBooking({
  closeSheet,
  showToast,
}: UseTrainerHomeCloseBookingArgs) {
  const queryClient = useQueryClient();

  const updateSlotsCache = useCallback((slotId: string, updater: (slot: SlotDto) => SlotDto) => {
    queryClient.setQueriesData<SlotDto[]>(
      { queryKey: keys.trainerSlots.mine() },
      (current) => {
        if (!current) {
          return current;
        }
        let changed = false;
        const next = current.map((slot) => {
          if (slot.id !== slotId) {
            return slot;
          }
          changed = true;
          return updater(slot);
        });
        return changed ? next : current;
      }
    );
  }, [queryClient]);

  const rollbackSlotsCache = useCallback((snapshot: SlotsSnapshot) => {
    snapshot.forEach(([key, data]) => {
      queryClient.setQueryData(key, data);
    });
  }, [queryClient]);

  const closeBookingMutation = useAppMutation<unknown, unknown, CloseBookingVariables, { snapshot: SlotsSnapshot }>({
    mutationFn: ({ bookingId, attendance, markPaid, method }: CloseBookingVariables) =>
      closeTrainerBooking(bookingId, attendance, { markPaid, method }),
    onMutate: async ({ slotId, attendance }) => {
      await queryClient.cancelQueries({ queryKey: keys.trainerSlots.mine() });
      const snapshot = queryClient.getQueriesData<SlotDto[]>({ queryKey: keys.trainerSlots.mine() });
      updateSlotsCache(slotId, (slot) => ({
        ...slot,
        bookingStatus: attendance,
      }));
      return { snapshot };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
      queryClient.invalidateQueries({ queryKey: keys.payments.all() });
      closeSheet();
    },
    onError: (error, _variables, context) => {
      if (context?.snapshot) {
        rollbackSlotsCache(context.snapshot);
      }
      const presented = presentApiError(error);
      const message = presented.kind === 'conflict'
        ? t('schedule.close.errorConflict')
        : presented.kind === 'notFound'
          ? t('schedule.close.errorNotFound')
          : presented.kind === 'network' || presented.kind === 'timeout'
            ? t('schedule.errorNetwork')
            : presented.message;
      if (shouldShowErrorToast(presented)) {
        showToast({
          type: 'error',
          title: presented.title,
          message,
        });
      }
    },
  });

  return { closeBookingMutation };
}

