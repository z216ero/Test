import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import {
  assignRegisteredClientToSlot,
  cancelTrainerSlot,
  closeTrainerBooking,
  type PaymentMethod,
} from '@api/trainerSlotsApi';
import { presentApiError, shouldShowErrorToast } from '@api/ApiErrorPresenter';
import type { SlotDto } from '@generated/api';
import { t } from '@i18n';
import { useAppMutation } from '@query/hooks';
import { keys } from '@query/keys';

type SlotsSnapshot = Array<[QueryKey, SlotDto[] | undefined]>;
type SlotsContext = { snapshot: SlotsSnapshot; activeSlot?: SlotDto | null };

type CloseBookingVariables = {
  slotId: string;
  bookingId: string;
  attendance: 'Completed' | 'NoShow';
  markPaid: boolean;
  method: PaymentMethod | null;
};

type UseScheduleSlotMutationsArgs = {
  activeSlot: SlotDto | null;
  setActiveSlot: Dispatch<SetStateAction<SlotDto | null>>;
  refetch: () => Promise<unknown> | unknown;
  closeSheet: () => void;
  closeReassignSheet: () => void;
  showToast: (payload: {
    type: 'success' | 'error';
    title: string;
    message?: string;
  }) => void;
};

export function useScheduleSlotMutations({
  activeSlot,
  setActiveSlot,
  refetch,
  closeSheet,
  closeReassignSheet,
  showToast,
}: UseScheduleSlotMutationsArgs) {
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

  const cancelMutation = useAppMutation<SlotDto, unknown, string, SlotsContext>({
    mutationFn: (slotId: string) => cancelTrainerSlot(slotId),
    onMutate: async (slotId) => {
      await queryClient.cancelQueries({ queryKey: keys.trainerSlots.mine() });
      const snapshot = queryClient.getQueriesData<SlotDto[]>({ queryKey: keys.trainerSlots.mine() });
      const activeSlotSnapshot = activeSlot;
      updateSlotsCache(slotId, (slot) => ({
        ...slot,
        status: 'Cancelled',
        bookingStatus: 'Cancelled',
      }));
      setActiveSlot((current) =>
        current && current.id === slotId
          ? { ...current, status: 'Cancelled', bookingStatus: 'Cancelled' }
          : current
      );
      return { snapshot, activeSlot: activeSlotSnapshot };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
      queryClient.invalidateQueries({ queryKey: keys.payments.all() });
      queryClient.invalidateQueries({ queryKey: keys.reports.summary() });
      refetch();
      closeSheet();
    },
    onError: (err, _variables, context) => {
      if (context?.snapshot) {
        rollbackSlotsCache(context.snapshot);
      }
      if (context?.activeSlot) {
        setActiveSlot(context.activeSlot);
      }
      const presented = presentApiError(err);
      const message =
        presented.kind === 'conflict' || presented.kind === 'notFound'
          ? t('schedule.errorChanged')
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

  const closeBookingMutation = useAppMutation<unknown, unknown, CloseBookingVariables, SlotsContext>({
    mutationFn: ({ bookingId, attendance, markPaid, method }: CloseBookingVariables) =>
      closeTrainerBooking(bookingId, attendance, { markPaid, method }),
    onMutate: async ({ slotId, attendance }) => {
      await queryClient.cancelQueries({ queryKey: keys.trainerSlots.mine() });
      const snapshot = queryClient.getQueriesData<SlotDto[]>({ queryKey: keys.trainerSlots.mine() });
      const activeSlotSnapshot = activeSlot;
      updateSlotsCache(slotId, (slot) => ({
        ...slot,
        bookingStatus: attendance,
      }));
      setActiveSlot((current) =>
        current && current.id === slotId
          ? { ...current, bookingStatus: attendance }
          : current
      );
      return { snapshot, activeSlot: activeSlotSnapshot };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
      queryClient.invalidateQueries({ queryKey: keys.reports.summary() });
      queryClient.invalidateQueries({ queryKey: keys.payments.all() });
      refetch();
      closeSheet();
    },
    onError: (err, _variables, context) => {
      if (context?.snapshot) {
        rollbackSlotsCache(context.snapshot);
      }
      if (context?.activeSlot) {
        setActiveSlot(context.activeSlot);
      }
      const presented = presentApiError(err);
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

  const assignAnotherClientMutation = useAppMutation({
    mutationFn: ({
      slotId,
      clientUserId,
    }: {
      slotId: string;
      clientUserId: string;
    }) => assignRegisteredClientToSlot(slotId, clientUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
      queryClient.invalidateQueries({ queryKey: keys.myClients() });
      closeReassignSheet();
      closeSheet();
      showToast({ type: 'success', title: t('schedule.actions.assignedAnotherClient') });
    },
    onError: (err) => {
      const presented = presentApiError(err);
      if (shouldShowErrorToast(presented)) {
        showToast({
          type: 'error',
          title: presented.title,
          message: presented.message,
        });
      }
    },
  });

  return {
    cancelMutation,
    closeBookingMutation,
    assignAnotherClientMutation,
  };
}
