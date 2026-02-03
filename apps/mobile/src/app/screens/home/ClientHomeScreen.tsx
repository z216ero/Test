import { useMemo } from 'react';
import { RefreshControl } from 'react-native';
import { ScrollView } from '@tamagui/scroll-view';
import { Button, Text, XStack, YStack } from 'tamagui';
import { getUpcomingForClient } from '@api/homeApi';
import { t } from '@i18n';
import { useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { AppIcon } from '@ui/AppIcon';
import { TrainerAvatar } from '@app/components/bookings/TrainerAvatar';
import type { HomeMeState, HomeNavigation, HomeUser } from './types';

const formatDate = (utc: string | undefined) => {
  if (!utc) {
    return t('common.empty');
  }
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) {
    return t('common.empty');
  }
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
  const raw = formatter.format(date).replace('.', '');
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const formatTimeRange = (utc: string | undefined, durationMinutes?: number) => {
  if (!utc) {
    return t('common.empty');
  }
  const start = new Date(utc);
  if (Number.isNaN(start.getTime())) {
    return t('common.empty');
  }
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const startLabel = formatter.format(start);
  if (!durationMinutes) {
    return startLabel;
  }
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const endLabel = formatter.format(end);
  return `${startLabel}–${endLabel}`;
};

type ClientHomeScreenProps = {
  navigation: HomeNavigation;
  me: HomeUser;
  meState: HomeMeState;
};

export function ClientHomeScreen({ navigation, me, meState }: ClientHomeScreenProps) {
  const {
    isLoading: isMeLoading,
    isFetching: isMeFetching,
    error: meError,
    refetch: refetchMe,
  } = meState;

  const upcomingQuery = useAppQuery({
    queryKey: keys.home.upcoming('Client'),
    enabled: Boolean(me),
    queryFn: ({ signal }) => getUpcomingForClient({ signal }),
  });

  const onRefresh = () => {
    refetchMe();
    upcomingQuery.refetch();
  };

  const isRefreshing = useMemo(
    () => isMeFetching || upcomingQuery.isFetching,
    [isMeFetching, upcomingQuery.isFetching]
  );

  const renderUpcomingCard = () => {
    if (isMeLoading || upcomingQuery.isLoading) {
      return (
        <YStack
          gap="$3"
          padding="$5"
          backgroundColor="$background"
          borderRadius="$5"
          borderWidth={1}
          borderColor="$border"
        >
          <Text fontSize="$4" fontWeight="700" color="$text">
            {t('home.upcoming.title')}
          </Text>
          <YStack height="$8" backgroundColor="$surfaceMuted" borderRadius="$4" />
          <YStack height="$10" backgroundColor="$surfaceMuted" borderRadius="$4" />
        </YStack>
      );
    }

    if (meError || upcomingQuery.error) {
      return (
        <YStack
          gap="$3"
          padding="$5"
          backgroundColor="$background"
          borderRadius="$5"
          borderWidth={1}
          borderColor="$border"
        >
          <Text fontSize="$4" fontWeight="700" color="$text">
            {t('home.upcoming.title')}
          </Text>
          <Text fontSize="$3" color="$muted">
            {t('errors.generic')}
          </Text>
          <Button
            backgroundColor="$accent"
            color="$accentText"
            borderRadius="$4"
            minHeight="$9"
            paddingHorizontal="$4"
            onPress={onRefresh}
          >
            {t('common.retry')}
          </Button>
        </YStack>
      );
    }

    const upcoming = upcomingQuery.data ?? null;

    if (!upcoming) {
      return (
        <YStack
          gap="$3"
          padding="$5"
          backgroundColor="$background"
          borderRadius="$5"
          borderWidth={1}
          borderColor="$border"
        >
          <Text fontSize="$4" fontWeight="700" color="$text">
            {t('home.upcoming.title')}
          </Text>
          <Text fontSize="$3" color="$muted">
            {t('home.upcoming.emptyTitle')}
          </Text>
          <Button
            backgroundColor="$accent"
            color="$accentText"
            borderRadius="$4"
            minHeight="$9"
            paddingHorizontal="$4"
            onPress={() => navigation.navigate('Slots', { screen: 'SlotsList' })}
          >
            {t('home.upcoming.emptyAction')}
          </Button>
        </YStack>
      );
    }

    const slot = upcoming.slot;
    const statusLabel = slot.status === 'Booked'
      ? t('home.upcoming.statusBooked')
      : slot.status ?? t('home.upcoming.statusUnknown');

    const dateLabel = formatDate(slot.startsAtUtc);
    const timeLabel = formatTimeRange(slot.startsAtUtc, slot.durationMinutes);

    return (
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
            {t('home.upcoming.title')}
          </Text>
          <XStack
            paddingHorizontal="$3"
            paddingVertical="$1"
            backgroundColor="$accent"
            borderRadius="$3"
          >
            <Text fontSize="$2" color="$accentText">
              {statusLabel}
            </Text>
          </XStack>
        </XStack>
        <Text fontSize="$3" color="$muted">
          {dateLabel}
        </Text>
        <XStack gap="$3" alignItems="center">
          <TrainerAvatar
            name={upcoming.trainerName}
            avatarUrl={upcoming.trainerAvatarUrl}
            size="$10"
          />
          <YStack gap="$1">
            {upcoming.trainerName ? (
              <Text fontSize="$4" fontWeight="700" color="$text">
                {upcoming.trainerName}
              </Text>
            ) : null}
            {upcoming.specialization ? (
              <Text fontSize="$3" color="$muted">
                {upcoming.specialization}
              </Text>
            ) : null}
            <Text fontSize="$3" color="$muted">
              {timeLabel}
            </Text>
          </YStack>
        </XStack>
      </YStack>
    );
  };

  const greetingName = me?.name?.trim() || t('common.unknownUser');

  const actionCards = [
    {
      id: 'find-slots',
      title: t('home.actions.findSlots'),
      subtitle: t('home.actions.findSlotsSubtitle'),
      icon: 'calendar',
    },
    {
      id: 'my-bookings',
      title: t('home.actions.myBookings'),
      subtitle: t('home.actions.myBookingsSubtitle'),
      icon: 'history',
    },
  ] as const;

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
          />
        }
      >
        <YStack padding="$6" gap="$6">
          <YStack gap="$2">
            <Text fontSize="$3" color="$muted">
              {t('home.labelClient')}
            </Text>
            <Text fontSize="$8" fontWeight="700" color="$text">
              {t('home.greeting', { name: greetingName })}
            </Text>
          </YStack>

          {renderUpcomingCard()}

          <YStack gap="$3">
            {actionCards.map((card) => (
              <Button
                key={card.id}
                backgroundColor="$background"
                borderRadius="$5"
                borderWidth={1}
                borderColor="$border"
                padding="$4"
                minHeight="$10"
                justifyContent="flex-start"
                onPress={() => {
                  if (card.id === 'find-slots') {
                    navigation.navigate('Slots', { screen: 'SlotsList' });
                    return;
                  }
                  if (card.id === 'my-bookings') {
                    navigation.navigate('Bookings', { screen: 'BookingsHome' });
                  }
                }}
              >
                <XStack alignItems="center" gap="$3" flex={1}>
                  <YStack
                    width="$9"
                    height="$9"
                    borderRadius="$5"
                    backgroundColor="$surfaceMuted"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <AppIcon name={card.icon} size={20} color="$muted" />
                  </YStack>
                  <YStack gap="$1" flex={1}>
                    <Text fontSize="$4" fontWeight="700" color="$text">
                      {card.title}
                    </Text>
                    <Text fontSize="$3" color="$muted">
                      {card.subtitle}
                    </Text>
                  </YStack>
                  <AppIcon name="chevronRight" size={18} color="$muted" />
                </XStack>
              </Button>
            ))}
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  );
}



