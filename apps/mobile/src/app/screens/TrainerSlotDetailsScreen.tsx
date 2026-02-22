import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { Button, Text, XStack, YStack } from 'tamagui';
import {
  attendanceActionsAvailable,
  cancelTrainerSlot,
  closeTrainerBooking,
  getGroupSlotAttendees,
  markGroupAttendeeCompleted,
  markGroupAttendeeNoShow,
} from '@api/trainerSlotsApi';
import {
  getBookingPayment,
  markBookingPaymentPaid,
  markBookingPaymentPending,
  type PaymentMethod as BookingPaymentMethod,
} from '@api/paymentsApi';
import { presentApiError, shouldShowErrorToast } from '@api/ApiErrorPresenter';
import {
  getSlotWorkoutType,
  getTrainerWorkoutTypes,
  setTrainerBookingWorkoutType,
  type WorkoutTypeSummary,
} from '@api/workoutTypesApi';
import type { PaymentDto } from '@generated/api';
import { t } from '@i18n';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { useToast } from '@ui/feedback/useToast';
import { formatDateRu, formatTimeRangeRu } from '@utils/datetime';
import type { ScheduleStackParamList } from '@app/navigation/types';
import { useQueryClient } from '@tanstack/react-query';
import { AppIcon } from '@ui/AppIcon';
import { WorkoutTypeChip } from '@app/components/workout/WorkoutTypeChip';
import {
  canCancelBookedSlot,
  canCancelSlot,
} from '@app/components/schedule/slotHelpers';
import { TrainerSlotGroupSection } from './slot-details/ui/TrainerSlotGroupSection';
import { TrainerSlotPaymentSection } from './slot-details/ui/TrainerSlotPaymentSection';
import { TrainerWorkoutTypePickerSheet } from './slot-details/ui/TrainerWorkoutTypePickerSheet';
import {
  getSlotTimes,
  getStatusLabel,
  isCancelledAttendee,
  isGroupSlot,
} from './slot-details/slotDetailsUtils';

type Props = NativeStackScreenProps<ScheduleStackParamList, 'SlotDetails'>;

const ATTENDEES_POLL_INTERVAL_MS = 10 * 1000;
const BOOKING_PAYMENT_METHODS: BookingPaymentMethod[] = ['Cash', 'Transfer', 'SBP', 'Other'];

export function TrainerSlotDetailsScreen({ route, navigation }: Props) {
  const { slot } = route.params;
  const [actionError, setActionError] = useState<string | null>(null);
  const [workoutTypePickerOpen, setWorkoutTypePickerOpen] = useState(false);
  const [selectedWorkoutType, setSelectedWorkoutType] = useState<WorkoutTypeSummary | null>(
    () => getSlotWorkoutType(slot)
  );
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<BookingPaymentMethod>('Cash');
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const group = isGroupSlot(slot);
  const times = getSlotTimes(slot);
  const dateLabel = times ? formatDateRu(times.start) : '';
  const timeLabel = times ? formatTimeRangeRu(times.start, times.end) : '';
  const slotStatus = slot.bookingStatus ?? slot.status ?? null;
  const statusLabel = getStatusLabel(slotStatus);
  const nowTs = Date.now();
  const startTs = times?.start.getTime() ?? null;
  const canCompleteNow = startTs !== null && nowTs >= startTs;
  const canNoShowNow = startTs !== null && nowTs >= startTs + 15 * 60 * 1000;
  const canEditWorkoutType =
    !group
    && Boolean(slot.bookingId)
    && startTs !== null
    && nowTs <= startTs + 15 * 60 * 1000;
  const occupiedCount = slot.occupiedCount ?? 0;
  const capacityMax = slot.capacityMax ?? null;

  const attendeesQuery = useAppQuery({
    queryKey: slot.id ? ['slots', 'attendees', slot.id] as const : ['slots', 'attendees', 'missing'] as const,
    enabled: group && Boolean(slot.id),
    queryFn: ({ signal }) => getGroupSlotAttendees(slot.id!, { signal }),
    refetchInterval: group ? ATTENDEES_POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  const paymentQuery = useAppQuery({
    queryKey: keys.payments.booking(slot.bookingId ?? 'missing'),
    enabled: !group && Boolean(slot.bookingId),
    queryFn: ({ signal }) => getBookingPayment(slot.bookingId!, { signal }),
  });

  const workoutTypesQuery = useAppQuery({
    queryKey: keys.trainerWorkoutTypes.list(false),
    enabled: !group && Boolean(slot.bookingId),
    queryFn: ({ signal }) => getTrainerWorkoutTypes(false, { signal }),
  });

  const invalidateTrainerData = () => {
    queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
    queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
    queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Client') });
    queryClient.invalidateQueries({ queryKey: keys.bookings.upcoming() });
    queryClient.invalidateQueries({ queryKey: keys.bookings.history() });
    queryClient.invalidateQueries({ queryKey: keys.reports.summary() });
    queryClient.invalidateQueries({ queryKey: keys.payments.all() });
    if (slot.bookingId) {
      queryClient.invalidateQueries({ queryKey: keys.payments.booking(slot.bookingId) });
    }
    if (slot.id) {
      queryClient.invalidateQueries({ queryKey: ['slots', 'attendees', slot.id] });
    }
  };

  const handleMutationError = useCallback((err: unknown) => {
    const presented = presentApiError(err);
    setActionError(presented.message);
    if (shouldShowErrorToast(presented)) {
      showToast({
        type: 'error',
        title: presented.title,
        message: presented.message,
      });
    }
  }, [showToast]);

  const completeMutation = useAppMutation({
    mutationFn: (payload: { bookingId: string }) =>
      closeTrainerBooking(payload.bookingId, 'Completed', { markPaid: false, method: null }),
    onSuccess: () => {
      invalidateTrainerData();
      navigation.goBack();
    },
    onError: handleMutationError,
  });

  const noShowMutation = useAppMutation({
    mutationFn: (payload: { bookingId: string }) =>
      closeTrainerBooking(payload.bookingId, 'NoShow', { markPaid: false, method: null }),
    onSuccess: () => {
      invalidateTrainerData();
      navigation.goBack();
    },
    onError: handleMutationError,
  });

  const cancelMutation = useAppMutation({
    mutationFn: (slotId: string) => cancelTrainerSlot(slotId),
    onSuccess: () => {
      invalidateTrainerData();
      navigation.goBack();
    },
    onError: handleMutationError,
  });

  const attendeeCompleteMutation = useAppMutation({
    mutationFn: (payload: { slotId: string; clientId: string }) =>
      markGroupAttendeeCompleted(payload.slotId, payload.clientId),
    onSuccess: () => {
      invalidateTrainerData();
    },
    onError: handleMutationError,
  });

  const attendeeNoShowMutation = useAppMutation({
    mutationFn: (payload: { slotId: string; clientId: string }) =>
      markGroupAttendeeNoShow(payload.slotId, payload.clientId),
    onSuccess: () => {
      invalidateTrainerData();
    },
    onError: handleMutationError,
  });

  const markPaidMutation = useAppMutation({
    mutationFn: (payload: { bookingId: string; method: BookingPaymentMethod }) =>
      markBookingPaymentPaid(payload.bookingId, payload.method),
    onSuccess: (payment) => {
      if (slot.bookingId) {
        queryClient.setQueryData<PaymentDto>(keys.payments.booking(slot.bookingId), payment);
      }
      invalidateTrainerData();
    },
    onError: handleMutationError,
  });

  const markPendingMutation = useAppMutation({
    mutationFn: (bookingId: string) => markBookingPaymentPending(bookingId),
    onSuccess: (payment) => {
      if (slot.bookingId) {
        queryClient.setQueryData<PaymentDto>(keys.payments.booking(slot.bookingId), payment);
      }
      invalidateTrainerData();
    },
    onError: handleMutationError,
  });

  const updateWorkoutTypeMutation = useAppMutation({
    mutationFn: (workoutTypeId: string | null) => {
      if (!slot.bookingId) {
        throw new Error('Booking id is required');
      }
      return setTrainerBookingWorkoutType(slot.bookingId, workoutTypeId);
    },
    onSuccess: (payload) => {
      setSelectedWorkoutType(payload.workoutType ?? null);
      setWorkoutTypePickerOpen(false);
      invalidateTrainerData();
    },
    onError: handleMutationError,
  });

  const canMarkIndividual =
    !group
    && attendanceActionsAvailable
    && slotStatus === 'Booked'
    && !!slot.id
    && !!slot.bookingId;
  const paymentStatusRaw = paymentQuery.data?.status ?? null;
  const paymentStatus = paymentStatusRaw?.toLowerCase() ?? '';
  const canTogglePayment = !group && Boolean(slot.bookingId);
  const isPaymentPending =
    markPaidMutation.isPending || markPendingMutation.isPending || paymentQuery.isFetching;

  const attendees = attendeesQuery.data ?? [];
  const hasAttendeesSnapshot = attendeesQuery.data !== undefined;
  const hasActiveAttendees = hasAttendeesSnapshot
    ? attendees.some((attendee) => !isCancelledAttendee(attendee))
    : occupiedCount > 0;
  const liveParticipantCount = group
    ? hasAttendeesSnapshot
      ? attendees.filter((attendee) => !isCancelledAttendee(attendee)).length
      : occupiedCount
    : occupiedCount;
  const canCancelAsAvailable = canCancelSlot(slot, nowTs);
  const canCancelAsBooked = canCancelBookedSlot(slot, nowTs) && startTs !== null && nowTs < startTs;
  const canCancelGroupSlot = Boolean(slot.id) && (hasActiveAttendees ? canCancelAsBooked : canCancelAsAvailable);
  const canMutateAttendee = useMemo(
    () => Boolean(slot.id) && !attendeeCompleteMutation.isPending && !attendeeNoShowMutation.isPending,
    [slot.id, attendeeCompleteMutation.isPending, attendeeNoShowMutation.isPending]
  );

  const handleMarkCompleted = () => {
    if (!slot.id || !slot.bookingId) {
      setActionError(t('errors.generic'));
      return;
    }
    setActionError(null);
    completeMutation.mutate({ bookingId: slot.bookingId! });
  };

  const handleMarkNoShow = () => {
    if (!slot.id || !slot.bookingId) {
      setActionError(t('errors.generic'));
      return;
    }
    setActionError(null);
    noShowMutation.mutate({ bookingId: slot.bookingId! });
  };

  const handleCancelGroupSlot = () => {
    if (!canCancelGroupSlot || !slot.id || cancelMutation.isPending) {
      return;
    }
    Alert.alert(
      t('schedule.actions.cancelSlotConfirmTitle'),
      t('schedule.actions.cancelSlotConfirmMessage'),
      [
        { text: t('profile.personal.cancel'), style: 'cancel' },
        {
          text: t('schedule.actions.cancelSlotConfirm'),
          style: 'destructive',
          onPress: () => {
            setActionError(null);
            cancelMutation.mutate(slot.id as string);
          },
        },
      ]
    );
  };

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <YStack flex={1} padding="$6" gap="30">
        <Text fontSize="$8" fontWeight="700" color="$text">
          {t('slotDetails.title')}
        </Text>
        <YStack
          gap="$3"
          padding="$5"
          backgroundColor="$background"
          borderRadius="$5"
          borderWidth={1}
          borderColor="$border"
        >
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize="$4" fontWeight="700" color="$text">
              {timeLabel || t('common.empty')}
            </Text>
            <XStack
              paddingHorizontal="$3"
              paddingVertical="$1"
              backgroundColor="$surfaceMuted"
              borderRadius="$3"
            >
              <Text fontSize="$2" color="$muted">
                {statusLabel}
              </Text>
            </XStack>
          </XStack>
          <Text fontSize="$3" color="$muted">
            {dateLabel || t('common.empty')}
          </Text>
          {group ? (
            <XStack alignItems="center" gap="$2">
              <AppIcon name="users" size={14} color="$muted" />
              <Text fontSize="$3" color="$muted">
                {capacityMax ? `${liveParticipantCount}/${capacityMax}` : `${liveParticipantCount}`}
              </Text>
            </XStack>
          ) : null}
        </YStack>

        {group ? (
          <TrainerSlotGroupSection
            attendees={attendees}
            isLoading={attendeesQuery.isLoading}
            canCompleteNow={canCompleteNow}
            canNoShowNow={canNoShowNow}
            canMutateAttendee={canMutateAttendee}
            onCompleteAttendee={(clientId) => {
              if (!slot.id) {
                return;
              }
              attendeeCompleteMutation.mutate({
                slotId: slot.id,
                clientId,
              });
            }}
            onNoShowAttendee={(clientId) => {
              if (!slot.id) {
                return;
              }
              attendeeNoShowMutation.mutate({
                slotId: slot.id,
                clientId,
              });
            }}
            canCancelGroupSlot={canCancelGroupSlot}
            onCancelGroupSlot={handleCancelGroupSlot}
            isCancelling={cancelMutation.isPending}
          />
        ) : null}

        {canMarkIndividual ? (
          <YStack gap="$3">
            <Button
              backgroundColor="$accent"
              color="$accentText"
              borderRadius="$4"
              minHeight="$9"
              paddingHorizontal="$4"
              onPress={handleMarkCompleted}
              disabled={completeMutation.isPending || noShowMutation.isPending}
            >
              {completeMutation.isPending
                ? t('common.loading')
                : t('slotDetails.markCompleted')}
            </Button>
            <Button
              backgroundColor="$background"
              borderRadius="$4"
              borderWidth={1}
              borderColor="$border"
              height="$9"
              paddingHorizontal="$4"
              onPress={handleMarkNoShow}
              disabled={completeMutation.isPending || noShowMutation.isPending}
            >
              <Text color="$text">
                {noShowMutation.isPending
                  ? t('common.loading')
                  : t('slotDetails.markNoShow')}
              </Text>
            </Button>
          </YStack>
        ) : null}

        {!group && slot.bookingId ? (
          <YStack
            gap="$2"
            padding="$4"
            backgroundColor="$background"
            borderRadius="$4"
            borderWidth={1}
            borderColor="$border"
          >
            <XStack alignItems="center" justifyContent="space-between" gap="$3">
              <YStack flex={1} minWidth={0}>
                <Text fontSize="$3" color="$muted">Тип тренировки</Text>
                <Text fontSize="$4" color="$text" numberOfLines={1}>
                  {selectedWorkoutType?.name ?? 'Не выбран'}
                </Text>
              </YStack>
              <Button
                unstyled
                onPress={() => setWorkoutTypePickerOpen(true)}
                disabled={!canEditWorkoutType || updateWorkoutTypeMutation.isPending}
                padding="$2"
              >
                <Text color={!canEditWorkoutType ? '$muted' : '$accent'}>
                  {canEditWorkoutType ? 'Изменить' : 'Недоступно'}
                </Text>
              </Button>
            </XStack>
            <WorkoutTypeChip
              label={selectedWorkoutType?.name}
              archived={Boolean(selectedWorkoutType?.isArchived)}
            />
            {!canEditWorkoutType ? (
              <Text fontSize="$2" color="$muted">
                Можно изменить до начала и 15 минут после
              </Text>
            ) : null}
          </YStack>
        ) : null}

        <TrainerSlotPaymentSection
          canTogglePayment={canTogglePayment}
          paymentStatus={paymentStatus}
          methods={BOOKING_PAYMENT_METHODS}
          selectedMethod={selectedPaymentMethod}
          onSelectMethod={setSelectedPaymentMethod}
          onMarkPaid={() => {
            if (!slot.bookingId || isPaymentPending) {
              return;
            }
            markPaidMutation.mutate({
              bookingId: slot.bookingId,
              method: selectedPaymentMethod,
            });
          }}
          onMarkPending={() => {
            if (!slot.bookingId || isPaymentPending) {
              return;
            }
            markPendingMutation.mutate(slot.bookingId);
          }}
          isPending={isPaymentPending}
        />

        {actionError ? (
          <Text fontSize="$3" color="$primary">
            {actionError}
          </Text>
        ) : null}
        <XStack justifyContent="center">
          <Button
            backgroundColor="$background"
            borderRadius="$4"
            borderWidth={1}
            borderColor="$border"
            height="$9"
            paddingHorizontal="$4"
            onPress={() => navigation.goBack()}
          >
            <Text color="$text">{t('bookingConfirm.back')}</Text>
          </Button>
        </XStack>
      </YStack>
      <TrainerWorkoutTypePickerSheet
        open={workoutTypePickerOpen}
        onOpenChange={setWorkoutTypePickerOpen}
        items={workoutTypesQuery.data ?? []}
        current={selectedWorkoutType}
        isLoading={workoutTypesQuery.isLoading}
        submitting={updateWorkoutTypeMutation.isPending}
        onSelect={(workoutTypeId) => {
          if (updateWorkoutTypeMutation.isPending) {
            return;
          }
          updateWorkoutTypeMutation.mutate(workoutTypeId);
        }}
      />
    </YStack>
  );
}
