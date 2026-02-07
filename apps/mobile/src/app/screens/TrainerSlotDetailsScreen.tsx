import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Button, Text, XStack, YStack } from 'tamagui';
import {
  attendanceActionsAvailable,
  getGroupSlotAttendees,
  markGroupAttendeeCompleted,
  markGroupAttendeeNoShow,
  markSlotCompleted,
  markSlotNoShow,
} from '@api/trainerSlotsApi';
import { presentApiError, shouldShowErrorToast } from '@api/ApiErrorPresenter';
import type { SlotAttendeeDto, SlotDto } from '@generated/api';
import { t } from '@i18n';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { useToast } from '@ui/feedback/useToast';
import { formatDateRu, formatTimeRangeRu } from '@utils/datetime';
import type { ScheduleStackParamList } from '@app/navigation/types';
import { useQueryClient } from '@tanstack/react-query';
import { AppIcon } from '@ui/AppIcon';

type Props = NativeStackScreenProps<ScheduleStackParamList, 'SlotDetails'>;

const getSlotTimes = (slot: SlotDto) => {
  if (!slot.startsAtUtc) {
    return null;
  }
  const start = new Date(slot.startsAtUtc);
  if (Number.isNaN(start.getTime())) {
    return null;
  }
  const duration = slot.durationMinutes ?? 0;
  const end = duration
    ? new Date(start.getTime() + duration * 60 * 1000)
    : start;
  return { start, end };
};

const getStatusLabel = (status?: string | null) => {
  if (!status) {
    return t('common.empty');
  }

  switch (status.toLowerCase()) {
    case 'open':
    case 'available':
      return t('status.open');
    case 'booked':
      return t('status.booked');
    case 'cancelled':
      return t('status.cancelled');
    case 'completed':
      return t('status.completed');
    case 'noshow':
    case 'no_show':
    case 'no-show':
      return t('status.noShow');
    default:
      return status;
  }
};

const normalize = (value?: string | null) => value?.toLowerCase().trim();
const isGroupSlot = (slot: SlotDto) => normalize(slot.slotType) === 'group';
const isBookedAttendee = (attendee: SlotAttendeeDto) => normalize(attendee.status) === 'booked';

export function TrainerSlotDetailsScreen({ route, navigation }: Props) {
  const { slot } = route.params;
  const [actionError, setActionError] = useState<string | null>(null);
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
  const occupiedCount = slot.occupiedCount ?? 0;
  const capacityMax = slot.capacityMax ?? null;

  const attendeesQuery = useAppQuery({
    queryKey: slot.id ? ['slots', 'attendees', slot.id] as const : ['slots', 'attendees', 'missing'] as const,
    enabled: group && Boolean(slot.id),
    queryFn: ({ signal }) => getGroupSlotAttendees(slot.id!, { signal }),
  });

  const invalidateTrainerData = () => {
    queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
    queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
    if (slot.id) {
      queryClient.invalidateQueries({ queryKey: ['slots', 'attendees', slot.id] });
    }
  };

  const completeMutation = useAppMutation({
    mutationFn: (slotId: string) => markSlotCompleted(slotId),
    onSuccess: () => {
      invalidateTrainerData();
      navigation.goBack();
    },
    onError: (err) => {
      const presented = presentApiError(err);
      setActionError(presented.message);
      if (shouldShowErrorToast(presented)) {
        showToast({
          type: 'error',
          title: presented.title,
          message: presented.message,
        });
      }
    },
  });

  const noShowMutation = useAppMutation({
    mutationFn: (slotId: string) => markSlotNoShow(slotId),
    onSuccess: () => {
      invalidateTrainerData();
      navigation.goBack();
    },
    onError: (err) => {
      const presented = presentApiError(err);
      setActionError(presented.message);
      if (shouldShowErrorToast(presented)) {
        showToast({
          type: 'error',
          title: presented.title,
          message: presented.message,
        });
      }
    },
  });

  const attendeeCompleteMutation = useAppMutation({
    mutationFn: (payload: { slotId: string; clientId: string }) =>
      markGroupAttendeeCompleted(payload.slotId, payload.clientId),
    onSuccess: () => {
      invalidateTrainerData();
    },
    onError: (err) => {
      const presented = presentApiError(err);
      setActionError(presented.message);
      if (shouldShowErrorToast(presented)) {
        showToast({
          type: 'error',
          title: presented.title,
          message: presented.message,
        });
      }
    },
  });

  const attendeeNoShowMutation = useAppMutation({
    mutationFn: (payload: { slotId: string; clientId: string }) =>
      markGroupAttendeeNoShow(payload.slotId, payload.clientId),
    onSuccess: () => {
      invalidateTrainerData();
    },
    onError: (err) => {
      const presented = presentApiError(err);
      setActionError(presented.message);
      if (shouldShowErrorToast(presented)) {
        showToast({
          type: 'error',
          title: presented.title,
          message: presented.message,
        });
      }
    },
  });

  const canMarkIndividual =
    !group && attendanceActionsAvailable && slotStatus === 'Booked' && !!slot.id;

  const attendees = attendeesQuery.data ?? [];
  const canMutateAttendee = useMemo(
    () => Boolean(slot.id) && !attendeeCompleteMutation.isPending && !attendeeNoShowMutation.isPending,
    [slot.id, attendeeCompleteMutation.isPending, attendeeNoShowMutation.isPending]
  );

  const handleMarkCompleted = () => {
    if (!slot.id) {
      setActionError(t('errors.generic'));
      return;
    }
    setActionError(null);
    completeMutation.mutate(slot.id);
  };

  const handleMarkNoShow = () => {
    if (!slot.id) {
      setActionError(t('errors.generic'));
      return;
    }
    setActionError(null);
    noShowMutation.mutate(slot.id);
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
                {capacityMax ? `${occupiedCount}/${capacityMax}` : `${occupiedCount}`}
              </Text>
            </XStack>
          ) : null}
        </YStack>

        {group ? (
          <YStack gap="$3">
            <Text fontSize="$4" fontWeight="700" color="$text">
              Участники
            </Text>
            {attendeesQuery.isLoading ? (
              <Text fontSize="$3" color="$muted">{t('common.loading')}</Text>
            ) : null}
            {attendees.map((attendee) => {
              const attendeeStatus = getStatusLabel(attendee.status);
              const showActions = isBookedAttendee(attendee);
              return (
                <YStack
                  key={attendee.clientId ?? `attendee-${attendee.clientName}`}
                  padding="$3"
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$4"
                  gap="$2"
                  backgroundColor="$background"
                >
                  <XStack justifyContent="space-between" alignItems="center">
                    <Text fontSize="$4" color="$text">
                      {attendee.clientName ?? t('common.empty')}
                    </Text>
                    <Text fontSize="$3" color="$muted">
                      {attendeeStatus}
                    </Text>
                  </XStack>
                  {showActions ? (
                    <XStack gap="$2">
                      <Button
                        flex={1}
                        backgroundColor="$accent"
                        color="$accentText"
                        borderRadius="$4"
                        minHeight="$9"
                        onPress={() => {
                          if (!slot.id || !attendee.clientId) {
                            return;
                          }
                          attendeeCompleteMutation.mutate({
                            slotId: slot.id,
                            clientId: attendee.clientId,
                          });
                        }}
                        disabled={!canMutateAttendee || !canCompleteNow}
                      >
                        Пришёл
                      </Button>
                      <Button
                        flex={1}
                        backgroundColor="$background"
                        borderRadius="$4"
                        borderWidth={1}
                        borderColor="$danger"
                        minHeight="$9"
                        onPress={() => {
                          if (!slot.id || !attendee.clientId) {
                            return;
                          }
                          attendeeNoShowMutation.mutate({
                            slotId: slot.id,
                            clientId: attendee.clientId,
                          });
                        }}
                        disabled={!canMutateAttendee || !canNoShowNow}
                      >
                        <Text color="$danger">Не пришёл</Text>
                      </Button>
                    </XStack>
                  ) : null}
                </YStack>
              );
            })}
          </YStack>
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
    </YStack>
  );
}
