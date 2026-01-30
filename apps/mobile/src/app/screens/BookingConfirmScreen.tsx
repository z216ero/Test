import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Button, Text, XStack, YStack } from 'tamagui';
import {
  BookingConflictError,
  BookingNotFoundError,
  createBooking,
} from '../../api/bookingsApi';
import { presentApiError } from '../../api/ApiErrorPresenter';
import { t } from '../../i18n';
import { useAppMutation } from '../../query/hooks';
import { keys } from '../../query/keys';
import { useToast } from '../../ui/feedback/useToast';
import { formatDateRu, formatTimeRangeRu } from '../../utils/datetime';
import { onBookingCreated } from '../../notifications/orchestrator';
import type { SlotsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<SlotsStackParamList, 'BookingConfirm'>;

type ErrorKind = 'conflict' | 'notFound' | 'generic' | null;

const getSlotTimes = (startsAtUtc?: string, durationMinutes?: number) => {
  if (!startsAtUtc) {
    return null;
  }
  const start = new Date(startsAtUtc);
  if (Number.isNaN(start.getTime())) {
    return null;
  }
  const duration = durationMinutes ?? 0;
  const end = duration
    ? new Date(start.getTime() + duration * 60 * 1000)
    : start;
  return { start, end };
};

export function BookingConfirmScreen({ navigation, route }: Props) {
  const { slot, trainerName, trainerSpecialization } = route.params;
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const times = getSlotTimes(slot.startsAtUtc, slot.durationMinutes);
  const dateLabel = times ? formatDateRu(times.start) : '';
  const timeLabel = times
    ? formatTimeRangeRu(times.start, times.end)
    : '';

  const bookingMutation = useAppMutation({
    mutationFn: (slotId: string) => createBooking(slotId),
    onSuccess: async (_data, slotId) => {
      const trainerId = slot.trainerId;
      if (trainerId) {
        queryClient.invalidateQueries({
          queryKey: keys.trainers.slots(trainerId),
        });
      }
      queryClient.invalidateQueries({ queryKey: keys.bookings.upcoming() });

      try {
        await onBookingCreated({
          bookingId: slotId,
          startAtUtcIso: slot.startsAtUtc ?? '',
          title: trainerName
            ? t('notifications.reminder.notificationTitleWithTrainer', {
                name: trainerName,
              })
            : t('notifications.reminder.notificationTitle'),
        });
      } catch (notificationError) {
        if (__DEV__) {
          console.warn('Failed to schedule booking notification', notificationError);
        }
      }

      showToast({ type: 'success', title: t('notifications.event.booked') });
      navigation.popToTop();
      navigation.getParent()?.navigate('Bookings');
    },
    onError: (err) => {
      const presented = presentApiError(err);
      showToast({
        type: 'error',
        title: presented.title,
        message: presented.message,
      });

      if (err instanceof BookingConflictError) {
        setError(err.message);
        setErrorKind('conflict');
      } else if (err instanceof BookingNotFoundError) {
        setError(err.message);
        setErrorKind('notFound');
      } else {
        setError(presented.message);
        setErrorKind('generic');
      }
    },
  });

  const handleConfirm = () => {
    if (!slot.id) {
      setError(t('errors.generic'));
      setErrorKind('generic');
      return;
    }

    setError(null);
    setErrorKind(null);
    bookingMutation.mutate(slot.id);
  };

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <YStack flex={1} padding="$6" gap="$4">
        <Text fontSize="$8" fontWeight="700" color="$text">
          {t('bookingConfirm.title')}
        </Text>
        <YStack
          gap="$3"
          padding="$5"
          backgroundColor="$background"
          borderRadius="$5"
          borderWidth={1}
          borderColor="$border"
        >
          <Text fontSize="$4" fontWeight="700" color="$text">
            {timeLabel || t('common.empty')}
          </Text>
          <Text fontSize="$3" color="$muted">
            {dateLabel || t('common.empty')}
          </Text>
          {trainerName ? (
            <YStack gap="$1">
              <Text fontSize="$4" fontWeight="700" color="$text">
                {trainerName}
              </Text>
              {trainerSpecialization ? (
                <Text fontSize="$3" color="$muted">
                  {trainerSpecialization}
                </Text>
              ) : null}
            </YStack>
          ) : null}
        </YStack>
        {error ? (
          <YStack gap="$2">
            <Text fontSize="$3" color="$primary">
              {error}
            </Text>
            {errorKind === 'conflict' ? (
              <Text fontSize="$3" color="$muted">
                {t('errors.slotTakenHint')}
              </Text>
            ) : null}
            {errorKind === 'notFound' ? (
              <Text fontSize="$3" color="$muted">
                {t('errors.slotNotFoundHint')}
              </Text>
            ) : null}
          </YStack>
        ) : null}
        <Button
          backgroundColor="$accent"
          color="$accentText"
          borderRadius="$4"
          minHeight="$9"
          paddingHorizontal="$4"
          onPress={handleConfirm}
          disabled={bookingMutation.isPending}
        >
          {bookingMutation.isPending
            ? t('common.loading')
            : t('bookingConfirm.confirm')}
        </Button>
        <XStack justifyContent="center">
          <Button
            backgroundColor="$background"
            borderRadius="$4"
            borderWidth={1}
            borderColor="$border"
            minHeight="$9"
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
