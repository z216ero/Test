import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Button, Text, XStack, YStack } from 'tamagui';
import { cancelBooking, type ClientBooking } from '@api/bookingsApi';
import { ApiError } from '@api/core';
import {
  presentApiError,
  shouldShowErrorToast,
  type PresentedError,
} from '@api/ApiErrorPresenter';
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
import type { AvailableSlotTrainerDto } from '@generated/api';
import { getSlotWorkoutType } from '@api/workoutTypesApi';
import { WorkoutTypeChip } from '@app/components/workout/WorkoutTypeChip';

type Props = NativeStackScreenProps<BookingsStackParamList, 'BookingDetails'>;

type CancelContext = {
  upcomingSnapshot?: ClientBooking[];
  historySnapshot?: ClientBooking[];
};

const NOW_REFRESH_INTERVAL_MS = 60 * 1000;

export function BookingDetailsScreen({ navigation, route }: Props) {
  const {
    slot,
    trainerName,
    trainerPhoneNumber,
    trainerGender,
    trainerWorksWithGender,
    trainerRating,
    trainerCityName,
    trainerDistrictName,
    trainerAvatarUrl,
    paymentStatus,
  } = route.params;
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [networkError, setNetworkError] = useState<PresentedError | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const trainingTypeCode = slot.slotType ?? null;
  const isGroupTraining = trainingTypeCode === 'Group';
  const trainingTypeLabel = trainingTypeCode
    ? t(isGroupTraining ? 'bookings.trainingTypeGroup' : 'bookings.trainingTypeIndividual')
    : null;
  const trainingTypeIcon = isGroupTraining ? 'users' : 'user';
  const locationLabel = useMemo(() => {
    const parts = [trainerCityName, trainerDistrictName].filter(
      (value): value is string => !!value && value.trim().length > 0
    );
    return parts.length > 0 ? parts.join(', ') : null;
  }, [trainerCityName, trainerDistrictName]);
  const trainerProfile = useMemo<AvailableSlotTrainerDto>(() => ({
    id: slot.trainerId,
    name: trainerName,
    phoneNumber: trainerPhoneNumber,
    avatarUrl: trainerAvatarUrl,
    worksWithGender: trainerWorksWithGender,
    gender: trainerGender,
    rating: trainerRating,
    cityName: trainerCityName,
    districtName: trainerDistrictName,
    trainingTypes: route.params.trainerTrainingTypes ?? null,
  }), [
    slot.trainerId,
    trainerName,
    trainerPhoneNumber,
    trainerGender,
    trainerWorksWithGender,
    trainerRating,
    trainerAvatarUrl,
    trainerCityName,
    trainerDistrictName,
    route.params.trainerTrainingTypes,
  ]);

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
  const statusType = getBookingStatusType(slot, nowTs);
  const statusMeta = bookingStatusMeta[statusType];
  const statusLabel = t(statusMeta.labelKey);
  const normalizedPaymentStatus = (paymentStatus ?? '').trim().toLowerCase();
  const paymentLabel = normalizedPaymentStatus
    ? normalizedPaymentStatus === 'paid'
      ? t('bookings.payment.paid')
      : t('bookings.payment.unpaid')
    : null;

  const canCancel = Boolean(slot.id) && canCancelBooking(slot, nowTs);
  const workoutType = getSlotWorkoutType(slot);

  const handleBack = () => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('Bookings', { screen: 'BookingsHome' });
      return;
    }
    navigation.navigate('BookingsHome');
  };

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

      handleBack();
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
      if (shouldShowErrorToast(presented)) {
        showToast({
          type: 'error',
          title: presented.title,
          message,
        });
      }

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
          <Button unstyled onPress={handleBack}>
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
            {paymentLabel ? (
              <Text fontSize="$3" color="$muted">
                {t('bookings.payment.label')}: {paymentLabel}
              </Text>
            ) : null}
            <XStack alignItems="center" gap="$3">
              <TrainerAvatar
                name={trainerName}
                avatarUrl={trainerAvatarUrl}
                size="$10"
                trainerProfile={trainerProfile}
              />
              <YStack gap="$1" flex={1}>
                <Text fontSize="$4" fontWeight="700" color="$text">
                  {trainerName?.trim() || t('common.empty')}
                </Text>
                {locationLabel ? (
                  <Text fontSize="$3" color="$muted">
                    {locationLabel}
                  </Text>
                ) : null}
                {trainingTypeLabel ? (
                  <XStack alignItems="center" gap="$2">
                    <AppIcon name={trainingTypeIcon} size={14} color="$muted" />
                    <Text fontSize="$3" color="$muted">
                      {trainingTypeLabel}
                    </Text>
                  </XStack>
                ) : null}
                <WorkoutTypeChip
                  label={workoutType?.name}
                  archived={Boolean(workoutType?.isArchived)}
                />
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



