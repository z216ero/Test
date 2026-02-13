import { useCallback, useEffect, useMemo } from 'react';
import { RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Text, XStack, YStack } from 'tamagui';
import { getClientUpcomingBookings, type ClientBooking } from '@api/bookingsApi';
import { t } from '@i18n';
import { useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { Banner } from '@ui/feedback/Banner';
import { TabScrollView } from '@ui/layout/TabScrollView';
import { TrainerAvatar } from '@app/components/bookings/TrainerAvatar';
import {
  getBookingStatusType,
  getSlotStartTimestamp,
  getSlotTimes,
} from '@app/components/bookings/bookingUtils';
import { formatTimeRangeRu } from '@utils/datetime';
import type { HomeMeState, HomeNavigation, HomeUser } from './types';
import type { AvailableSlotTrainerDto } from '@generated/api';

const MAX_UPCOMING = 5;
const LIVE_REFRESH_INTERVAL_MS = 15 * 1000;

const formatWeekdayDateRu = (value?: string | Date): string => {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const raw = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);

  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '';
};

const sortByStart = (left: ClientBooking, right: ClientBooking) => {
  const leftTs = getSlotStartTimestamp(left.slot) ?? Number.MAX_SAFE_INTEGER;
  const rightTs = getSlotStartTimestamp(right.slot) ?? Number.MAX_SAFE_INTEGER;
  return leftTs - rightTs;
};

const pickUpcomingBookings = (items: ClientBooking[], nowTs: number): ClientBooking[] => {
  if (items.length === 0) {
    return [];
  }

  return items
    .filter((booking) => {
      const startTs = getSlotStartTimestamp(booking.slot);
      if (startTs === null || startTs <= nowTs) {
        return false;
      }
      return getBookingStatusType(booking.slot) === 'booked';
    })
    .slice()
    .sort(sortByStart)
    .slice(0, MAX_UPCOMING);
};

const UpcomingListSkeleton = () => (
  <YStack gap="$3">
    <YStack height={18} width="60%" backgroundColor="$surfaceMuted" borderRadius="$3" />
    {Array.from({ length: 2 }).map((_, index) => (
      <YStack
        key={`skeleton-${index}`}
        gap="$3"
        padding="$4"
        backgroundColor="$background"
        borderRadius="$5"
        borderWidth={1}
        borderColor="$border"
      >
        <XStack gap="$3" alignItems="center">
          <YStack width="$10" height="$10" borderRadius="$6" backgroundColor="$surfaceMuted" />
          <YStack gap="$2" flex={1}>
            <YStack height={16} width="60%" backgroundColor="$surfaceMuted" borderRadius="$3" />
            <YStack height={12} width="70%" backgroundColor="$surfaceMuted" borderRadius="$3" />
          </YStack>
          <YStack height={12} width={60} backgroundColor="$surfaceMuted" borderRadius="$3" />
        </XStack>
        <XStack justifyContent="flex-end">
          <YStack height={28} width={110} backgroundColor="$surfaceMuted" borderRadius="$4" />
        </XStack>
      </YStack>
    ))}
  </YStack>
);

type ClientHomeScreenProps = {
  navigation: HomeNavigation;
  me: HomeUser;
  meState: HomeMeState;
};

export function ClientHomeScreen({ navigation, me, meState }: ClientHomeScreenProps) {
  const queryClient = useQueryClient();
  const {
    isLoading: isMeLoading,
    isFetching: isMeFetching,
    refetch: refetchMe,
  } = meState;

  const upcomingQuery = useAppQuery({
    queryKey: keys.bookings.upcoming(),
    enabled: Boolean(me),
    queryFn: ({ signal }) => getClientUpcomingBookings({ signal }),
    refetchInterval: LIVE_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
  const { refetch: refetchUpcoming } = upcomingQuery;

  const nowTs = useMemo(() => Date.now(), []);
  const upcomingBookings = useMemo(
    () => pickUpcomingBookings(upcomingQuery.data ?? [], nowTs),
    [upcomingQuery.data, nowTs]
  );

  useEffect(() => {
    queryClient.setQueryData(keys.home.upcoming('Client'), upcomingBookings[0] ?? null);
  }, [queryClient, upcomingBookings]);

  useFocusEffect(
    useCallback(() => {
      refetchMe();
      refetchUpcoming();
    }, [refetchMe, refetchUpcoming])
  );

  const onRefresh = () => {
    refetchMe();
    upcomingQuery.refetch();
  };

  const isRefreshing = useMemo(
    () => isMeFetching || upcomingQuery.isFetching,
    [isMeFetching, upcomingQuery.isFetching]
  );

  const showSkeleton =
    (isMeLoading || upcomingQuery.isLoading) && !upcomingQuery.data;
  const hasUpcoming = upcomingBookings.length > 0;

  const greetingName = me?.name?.trim() || t('common.unknownUser');

  const handleFindSlots = () => {
    navigation.navigate('Slots', { screen: 'SlotsList' });
  };

  const handleBookings = () => {
    navigation.navigate('Bookings', { screen: 'BookingsHome' });
  };

  const handleDetails = (booking: ClientBooking) => {
    navigation.navigate('Bookings', {
      screen: 'BookingDetails',
      params: {
        slot: booking.slot,
        trainerName: booking.trainerName,
        trainerPhoneNumber: booking.trainerPhoneNumber,
        trainerGender: booking.trainerGender,
        trainerWorksWithGender: booking.trainerWorksWithGender,
        trainerRating: booking.trainerRating,
        trainerSpecializations: booking.trainerSpecializations,
        trainerTrainingTypes: booking.trainerTrainingTypes,
        trainerCityName: booking.trainerCityName,
        trainerDistrictName: booking.trainerDistrictName,
        trainerAvatarUrl: booking.trainerAvatarUrl,
      },
    });
  };

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <TabScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
          />
        }
      >
        <YStack padding="$6" gap="$6">
          <YStack gap="$3">
            <YStack gap="$1">
              <Text fontSize="$7" fontWeight="700" color="$text">
                {t('home.greeting', { name: greetingName })}
              </Text>
              <Text fontSize="$3" color="$muted">
                {t('home.client.subtitle')}
              </Text>
            </YStack>
            <XStack gap="$3">
              <Button
                flex={1}
                backgroundColor="$accent"
                color="$accentText"
                borderRadius="$4"
                minHeight="$9"
                paddingHorizontal="$4"
                onPress={handleFindSlots}
              >
                {t('home.actions.findSlots')}
              </Button>
              <Button
                flex={1}
                backgroundColor="$background"
                borderRadius="$4"
                borderWidth={1}
                borderColor="$border"
                minHeight="$9"
                paddingHorizontal="$4"
                onPress={handleBookings}
              >
                <Text color="$text">
                  {t('home.actions.myBookings')}
                </Text>
              </Button>
            </XStack>
          </YStack>

          {upcomingQuery.error ? (
            <Banner
              type="error"
              title={t('home.client.errorTitle')}
              actionLabel={t('common.retry')}
              onAction={onRefresh}
            />
          ) : null}

          {showSkeleton ? <UpcomingListSkeleton /> : null}

          {!showSkeleton && hasUpcoming ? (
            <YStack gap="$3">
              <Text fontSize="$5" fontWeight="700" color="$text">
                {t('home.client.upcomingTitle')}
              </Text>
              <YStack gap="$4">
                {upcomingBookings.map((booking) => {
                  const times = getSlotTimes(booking.slot);
                  const timeLabel = times ? formatTimeRangeRu(times.start, times.end) : t('common.empty');
                  const dateLabel = times ? formatWeekdayDateRu(times.start) : t('common.empty');
                  const isBooked = getBookingStatusType(booking.slot) === 'booked';
                  const trainerName = booking.trainerName?.trim() || t('common.empty');
                  const trainerProfile: AvailableSlotTrainerDto = {
                    id: booking.slot.trainerId,
                    name: booking.trainerName,
                    phoneNumber: booking.trainerPhoneNumber,
                    avatarUrl: booking.trainerAvatarUrl,
                    worksWithGender: booking.trainerWorksWithGender,
                    gender: booking.trainerGender,
                    rating: booking.trainerRating,
                    cityName: booking.trainerCityName,
                    districtName: booking.trainerDistrictName,
                    trainingTypes: booking.trainerTrainingTypes ?? null,
                  };
                  const key = booking.slot.id ?? booking.slot.startsAtUtc ?? trainerName;

                  return (
                    <Button key={key} unstyled onPress={() => handleDetails(booking)} borderRadius="$5">
                      <YStack
                        gap="$3"
                        padding="$4"
                        backgroundColor="$background"
                        borderRadius="$5"
                        borderWidth={1}
                        borderColor="$border"
                      >
                        <XStack alignItems="center" justifyContent="space-between" gap="$3">
                          <XStack alignItems="center" gap="$3" flex={1}>
                            <TrainerAvatar
                              name={booking.trainerName}
                              avatarUrl={booking.trainerAvatarUrl}
                              size="$9"
                              trainerProfile={trainerProfile}
                            />
                            <YStack gap="$1" flex={1}>
                              <Text fontSize="$4" fontWeight="700" color="$text">
                                {trainerName}
                              </Text>
                              <Text fontSize="$3" color="$muted">
                                {dateLabel}
                              </Text>
                            </YStack>
                          </XStack>
                          <XStack alignItems="center" gap="$2">
                            <Text fontSize="$3" color="$muted">
                              {timeLabel}
                            </Text>
                            {isBooked ? (
                              <YStack
                                width="$1"
                                height="$1"
                                borderRadius="$6"
                                backgroundColor="$accent"
                              />
                            ) : null}
                          </XStack>
                        </XStack>
                        <XStack justifyContent="flex-end">
                          <XStack
                            paddingHorizontal="$4"
                            paddingVertical="$2"
                            backgroundColor="$accent"
                            borderRadius="$4"
                          >
                            <Text fontSize="$3" fontWeight="600" color="$accentText">
                              {t('home.client.details')}
                            </Text>
                          </XStack>
                        </XStack>
                      </YStack>
                    </Button>
                  );
                })}
              </YStack>
            </YStack>
          ) : null}

          {!showSkeleton && !hasUpcoming ? (
            <YStack
              padding="$5"
              backgroundColor="$background"
              borderRadius="$5"
              borderWidth={1}
              borderColor="$border"
              alignItems="center"
              gap="$3"
            >
              <Text fontSize="$5" fontWeight="700" color="$text" textAlign="center">
                {t('home.client.emptyTitle')}
              </Text>
            </YStack>
          ) : null}
        </YStack>
      </TabScrollView>
    </YStack>
  );
}
