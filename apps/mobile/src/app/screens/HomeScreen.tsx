import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useMemo } from 'react';
import { RefreshControl } from 'react-native';
import { ScrollView } from '@tamagui/scroll-view';
import { Button, Text, XStack, YStack } from 'tamagui';
import { getMe, getUpcomingForClient, getUpcomingForTrainer } from '../../api/homeApi';
import { t } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { useAppQuery } from '../../query/hooks';
import { keys } from '../../query/keys';
import type { AppTabsParamList } from '../navigation/types';

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

type Props = BottomTabScreenProps<AppTabsParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const meQuery = useAppQuery({
    queryKey: keys.auth.me(),
    queryFn: ({ signal }) => getMe({ signal }),
  });

  const me = meQuery.data ?? null;
  const role = me?.role === 'Trainer' ? 'Trainer' : 'Client';
  const specialization = me?.specialization ?? null;

  const upcomingQuery = useAppQuery({
    queryKey: keys.home.upcoming(role),
    enabled: Boolean(me),
    queryFn: ({ signal }) =>
      role === 'Trainer'
        ? getUpcomingForTrainer(specialization, { signal })
        : getUpcomingForClient({ signal }),
  });

  const upcoming = upcomingQuery.data ?? null;

  const onRefresh = () => {
    meQuery.refetch();
    upcomingQuery.refetch();
  };
  const labelKey: TranslationKey =
    role === 'Trainer' ? 'home.labelTrainer' : 'home.labelClient';
  const greetingName = me?.name?.trim() || t('common.unknownUser');

  const actionCards = role === 'Trainer'
    ? [
        {
          id: 'find-slots',
          title: t('home.actions.findSlots'),
          subtitle: t('home.actions.findSlotsSubtitle'),
          icon: '🔎',
        },
        {
          id: 'my-schedule',
          title: t('home.actions.mySchedule'),
          subtitle: t('home.actions.myScheduleSubtitle'),
          icon: '📅',
        },
      ]
    : [
        {
          id: 'find-slots',
          title: t('home.actions.findSlots'),
          subtitle: t('home.actions.findSlotsSubtitle'),
          icon: '🔎',
        },
        {
          id: 'my-bookings',
          title: t('home.actions.myBookings'),
          subtitle: t('home.actions.myBookingsSubtitle'),
          icon: '📅',
        },
      ];

  const goToPrimaryTab = () => {
    if (role === 'Trainer') {
      navigation.navigate('Schedule', { screen: 'ScheduleHome' });
      return;
    }
    navigation.navigate('Slots', { screen: 'SlotsList' });
  };

  const renderUpcomingCard = () => {
    if (meQuery.isLoading || upcomingQuery.isLoading) {
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

    if (meQuery.error || upcomingQuery.error) {
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
            onPress={goToPrimaryTab}
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
          <YStack
            width="$10"
            height="$10"
            borderRadius="$6"
            backgroundColor="$surfaceMuted"
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize="$4" color="$muted">
              {upcoming.trainerName?.slice(0, 2).toUpperCase()
                ?? t('common.initialsPlaceholder')}
            </Text>
          </YStack>
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
        <XStack justifyContent="flex-end">
          <Text fontSize="$3" fontWeight="700" color="$muted" onPress={() => {}}>
            {t('home.upcoming.details')}
          </Text>
        </XStack>
      </YStack>
    );
  };

  const isRefreshing = useMemo(
    () => meQuery.isFetching || upcomingQuery.isFetching,
    [meQuery.isFetching, upcomingQuery.isFetching]
  );

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
          <XStack alignItems="center" justifyContent="space-between">
            <YStack gap="$2">
              <Text fontSize="$3" color="$muted">
                {t(labelKey)}
              </Text>
              <Text fontSize="$8" fontWeight="700" color="$text">
                {t('home.greeting', { name: greetingName })}
              </Text>
            </YStack>
            <Button
              width="$10"
              height="$10"
              borderRadius="$6"
              backgroundColor="$background"
              borderWidth={1}
              borderColor="$border"
              onPress={() => {}}
            >
              <Text fontSize="$4">🔔</Text>
            </Button>
          </XStack>

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
                    goToPrimaryTab();
                    return;
                  }
                  if (card.id === 'my-bookings') {
                    navigation.navigate('Bookings');
                    return;
                  }
                  if (card.id === 'my-schedule') {
                    navigation.navigate('Schedule', { screen: 'ScheduleHome' });
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
                    <Text fontSize="$4">{card.icon}</Text>
                  </YStack>
                  <YStack gap="$1" flex={1}>
                    <Text fontSize="$4" fontWeight="700" color="$text">
                      {card.title}
                    </Text>
                    <Text fontSize="$3" color="$muted">
                      {card.subtitle}
                    </Text>
                  </YStack>
                <Text fontSize="$4" color="$muted">
                  {t('common.arrow')}
                </Text>
                </XStack>
              </Button>
            ))}
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  );
}
