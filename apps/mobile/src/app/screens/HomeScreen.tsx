import { Button, Text, XStack, YStack } from 'tamagui';
import { t } from '../../i18n';
import type { TranslationKey } from '../../i18n';

const upcomingSession: {
  dateKey: TranslationKey;
  timeKey: TranslationKey;
  trainerKey: TranslationKey;
  specializationKey: TranslationKey;
  statusKey: TranslationKey;
  initials: string;
} = {
  dateKey: 'home.upcoming.date',
  timeKey: 'home.upcoming.time',
  trainerKey: 'home.upcoming.trainer',
  specializationKey: 'home.upcoming.specialization',
  statusKey: 'home.upcoming.statusBooked',
  initials: 'МД',
};

const actionCards: Array<{
  id: string;
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  icon: string;
}> = [
  {
    id: 'find-slots',
    titleKey: 'home.actions.findSlots',
    subtitleKey: 'home.actions.findSlotsSubtitle',
    icon: '🔎',
  },
  {
    id: 'my-bookings',
    titleKey: 'home.actions.myBookings',
    subtitleKey: 'home.actions.myBookingsSubtitle',
    icon: '📅',
  },
];

export function HomeScreen() {
  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <YStack flex={1} padding="$6" gap="$6">
        <XStack alignItems="center" justifyContent="space-between">
          <YStack gap="$2">
            <Text fontSize="$3" color="$muted">
              {t('home.label')}
            </Text>
            <Text fontSize="$8" fontWeight="700" color="$text">
              {t('home.greeting', { name: 'Алекс' })}
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
                {t(upcomingSession.statusKey)}
              </Text>
            </XStack>
          </XStack>
          <Text fontSize="$3" color="$muted">
            {t(upcomingSession.dateKey)}
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
                {upcomingSession.initials}
              </Text>
            </YStack>
            <YStack gap="$1">
              <Text fontSize="$4" fontWeight="700" color="$text">
                {t(upcomingSession.trainerKey)}
              </Text>
              <Text fontSize="$3" color="$muted">
                {t(upcomingSession.specializationKey)}
              </Text>
              <Text fontSize="$3" color="$muted">
                {t(upcomingSession.timeKey)}
              </Text>
            </YStack>
          </XStack>
          <XStack justifyContent="flex-end">
            <Text fontSize="$3" fontWeight="700" color="$muted" onPress={() => {}}>
              {t('home.upcoming.details')}
            </Text>
          </XStack>
        </YStack>

        <YStack gap="$3">
          {actionCards.map((card) => (
            <Button
              key={card.id}
              backgroundColor="$background"
              borderRadius="$5"
              borderWidth={1}
              borderColor="$border"
              padding="$4"
              minHeight="$11"
              justifyContent="flex-start"
              onPress={() => {}}
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
                    {t(card.titleKey)}
                  </Text>
                  <Text fontSize="$3" color="$muted">
                    {t(card.subtitleKey)}
                  </Text>
                </YStack>
                <Text fontSize="$4" color="$muted">
                  →
                </Text>
              </XStack>
            </Button>
          ))}
        </YStack>
      </YStack>
    </YStack>
  );
}
