import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Button, Text, XStack, YStack } from 'tamagui';
import { cancelBooking, type ClientBooking } from '@api/bookingsApi';
import { ApiError } from '@api/core';
import { presentApiError, type PresentedError } from '@api/ApiErrorPresenter';
import { t } from '@i18n';
import { onBookingCancelled } from '@notifications/orchestrator';
import { useAppMutation } from '@query/hooks';
import { keys } from '@query/keys';
import { useToast } from '@ui/feedback/useToast';
import { Banner } from '@ui/feedback/Banner';
import { AppIcon } from '@ui/AppIcon';
import { TabScrollView } from '@ui/layout/TabScrollView';
import { formatDateWithWeekdayRu, formatTimeRangeRu } from '@utils/datetime';
import { useQueryClient } from '@tanstack/react-query';
import {
  bookingStatusMeta,
  canCancelBooking,
  getBookingStatusType,
  getSlotTimes,
} from '@app/components/bookings/bookingUtils';
import { TrainerAvatar } from '@app/components/bookings/TrainerAvatar';
import type { BookingsStackParamList } from '@app/navigation/types';

type Props = NativeStackScreenProps<BookingsStackParamList, 'BookingDetails'>;

type CancelContext = {
  upcomingSnapshot?: ClientBooking[];
  historySnapshot?: ClientBooking[];
};

const NOW_REFRESH_INTERVAL_MS = 60 * 1000;

export function BookingDetailsScreen({ navigation, route }: Props) {
  const { slot, trainerName, trainerSpecialization, trainerAvatarUrl } = route.params;
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [networkError, setNetworkError] = useState<PresentedError | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  useFocusEffect(
    useCallback(() => {
      setNowTs(Date.now());
      const intervalId = setInterval(() => {
        setNowTs(Date.now());
      }, NOW_REFRESH_INTERVAL_MS);
      return () => clearInterval(intervalId);
    }, [])
  );

  const times = useMemo(() => getSlotTimes(slot), [slot]);
  const dateLabel = times ? formatDateWithWeekdayRu(times.start) : t('common.empty');
  const timeLabel = times ? formatTimeRangeRu(times.start, times.end) : t('common.empty');
  const statusType = getBookingStatusType(slot);
  const statusMeta = bookingStatusMeta[statusType];
  const statusLabel = t(statusMeta.labelKey);

  const canCancel = Boolean(slot.id) && canCancelBooking(slot, nowTs);

  const cancelMutation = useAppMutation<void, unknown, string, CancelContext>({
    mutationFn: (slotId: string) => cancelBooking(slotId),
    onMutate: async (slotId) => {
      setNetworkError(null);
      await queryClient.cancelQueries({ queryKey: keys.bookings.upcoming() });
      await queryClient.cancelQueries({ queryKey: keys.bookings.history() });

      const upcomingSnapshot = queryClient.getQueryData<ClientBooking[]>(keys.bookings.upcoming());
      const historySnapshot = queryClient.getQueryData<ClientBooking[]>(keys.bookings.history());

      queryClient.setQueryData<ClientBooking[]>(
        keys.bookings.upcoming(),
        (current) => current?.filter((item) => item.slot.id !== slotId)
      );

      return { upcomingSnapshot, historySnapshot };
    },
    onSuccess: async (_data, slotId) => {
      if (slot.startsAtUtc) {
        await onBookingCancelled({
          bookingId: slotId,
          startAtUtcIso: slot.startsAtUtc,
        });
      }

      queryClient.invalidateQueries({ queryKey: keys.bookings.upcoming() });
      queryClient.invalidateQueries({ queryKey: keys.bookings.history() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Client') });

      showToast({ type: 'success', title: t('bookings.detailsCancelled') });
      navigation.goBack();
    },
    onError: (err, _slotId, context) => {
      if (context?.upcomingSnapshot) {
        queryClient.setQueryData(keys.bookings.upcoming(), context.upcomingSnapshot);
      }
      if (context?.historySnapshot) {
        queryClient.setQueryData(keys.bookings.history(), context.historySnapshot);
      }

      const presented = presentApiError(err);
      if (presented.kind === 'network' || presented.kind === 'timeout') {
        setNetworkError(presented);
        return;
      }

      const message = err instanceof ApiError ? err.message : presented.message;
      showToast({
        type: 'error',
        title: presented.title,
        message,
      });

      queryClient.invalidateQueries({ queryKey: keys.bookings.upcoming() });
      queryClient.invalidateQueries({ queryKey: keys.bookings.history() });
    },
  });

  const handleCancel = () => {
    if (!slot.id || cancelMutation.isPending) {
      return;
    }
    cancelMutation.mutate(slot.id);
  };

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <TabScrollView>
        <YStack gap="$4" padding="$6">
          <Button unstyled onPress={() => navigation.goBack()}>
            <XStack alignItems="center" gap="$2">
              <AppIcon name="chevronLeft" size={18} color="$muted" />
              <Text fontSize="$3" color="$muted">
                {t('bookingConfirm.back')}
              </Text>
            </XStack>
          </Button>
          <Text fontSize="$8" fontWeight="700" color="$text">
            {t('bookings.detailsTitle')}
          </Text>
          {networkError ? (
            <Banner
              type="error"
              title={networkError.title}
              message={networkError.message}
              actionLabel={t('common.retry')}
              onAction={handleCancel}
            />
          ) : null}
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
                {timeLabel}
              </Text>
              <XStack alignItems="center" gap="$2">
                <YStack
                  width="$1"
                  height="$1"
                  borderRadius="$6"
                  backgroundColor={statusMeta.color}
                />
                <Text fontSize="$2" color={statusMeta.color}>
                  {statusLabel}
                </Text>
              </XStack>
            </XStack>
            <Text fontSize="$3" color="$muted">
              {dateLabel}
            </Text>
            <XStack alignItems="center" gap="$3">
              <TrainerAvatar
                name={trainerName}
                avatarUrl={trainerAvatarUrl}
                size="$10"
              />
              <YStack gap="$1" flex={1}>
                <Text fontSize="$4" fontWeight="700" color="$text">
                  {trainerName?.trim() || t('common.empty')}
                </Text>
                {trainerSpecialization ? (
                  <Text fontSize="$3" color="$muted">
                    {trainerSpecialization}
                  </Text>
                ) : null}
              </YStack>
            </XStack>
          </YStack>
          {canCancel ? (
            <Button
              backgroundColor="$background"
              borderRadius="$4"
              borderWidth={1}
              borderColor="$border"
              minHeight="$9"
              paddingHorizontal="$4"
              onPress={handleCancel}
              disabled={cancelMutation.isPending}
            >
              <Text color="$danger">
                {cancelMutation.isPending ? t('common.loading') : t('bookings.detailsCancel')}
              </Text>
            </Button>
          ) : null}
        </YStack>
      </TabScrollView>
    </YStack>
  );
}



