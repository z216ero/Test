import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Button, Text, XStack, YStack } from 'tamagui';
import {
  attendanceActionsAvailable,
  markSlotCompleted,
  markSlotNoShow,
} from '../../api/trainerSlotsApi';
import { presentApiError } from '../../api/ApiErrorPresenter';
import type { SlotDto } from '../../generated/api';
import { t } from '../../i18n';
import { useAppMutation } from '../../query/hooks';
import { keys } from '../../query/keys';
import { useToast } from '../../ui/feedback/useToast';
import { formatDateRu, formatTimeRangeRu } from '../../utils/datetime';
import type { ScheduleStackParamList } from '../navigation/types';
import { useQueryClient } from '@tanstack/react-query';

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

const getClientName = (slot: SlotDto): string | null => {
  const candidate = (slot as SlotDto & { clientName?: string | null }).clientName;
  return candidate ? candidate : null;
};

const getSlotStatus = (slot: SlotDto): string | null => {
  return slot.bookingStatus ?? slot.status ?? null;
};

const getPriceLabel = (slot: SlotDto): string | null => {
  const candidate = (slot as SlotDto & { price?: string | number | null }).price;
  if (candidate === null || candidate === undefined) {
    return null;
  }
  if (typeof candidate === 'number') {
    return `${candidate}`;
  }
  const trimmed = String(candidate).trim();
  return trimmed.length > 0 ? trimmed : null;
};

export function TrainerSlotDetailsScreen({ route, navigation }: Props) {
  const { slot } = route.params;
  const [actionError, setActionError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const times = getSlotTimes(slot);
  const dateLabel = times ? formatDateRu(times.start) : '';
  const timeLabel = times
    ? formatTimeRangeRu(times.start, times.end)
    : '';
  const slotStatus = getSlotStatus(slot);
  const statusLabel = getStatusLabel(slotStatus);
  const clientName = getClientName(slot);
  const priceLabel = getPriceLabel(slot);

  const canMark =
    attendanceActionsAvailable && slotStatus === 'Booked' && !!slot.id;

  const completeMutation = useAppMutation({
    mutationFn: (slotId: string) => markSlotCompleted(slotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
      showToast({ type: 'success', title: t('status.completed') });
      navigation.goBack();
    },
    onError: (err) => {
      const presented = presentApiError(err);
      setActionError(presented.message);
      showToast({
        type: 'error',
        title: presented.title,
        message: presented.message,
      });
    },
  });

  const noShowMutation = useAppMutation({
    mutationFn: (slotId: string) => markSlotNoShow(slotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
      showToast({ type: 'success', title: t('status.noShow') });
      navigation.goBack();
    },
    onError: (err) => {
      const presented = presentApiError(err);
      setActionError(presented.message);
      showToast({
        type: 'error',
        title: presented.title,
        message: presented.message,
      });
    },
  });

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
          {clientName ? (
            <Text fontSize="$4" color="$text">
              {clientName}
            </Text>
          ) : null}
          {priceLabel ? (
            <Text fontSize="$3" color="$muted">
              {priceLabel}
            </Text>
          ) : null}
        </YStack>
        {canMark ? (
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
