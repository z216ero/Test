import { Button, Text, XStack, YStack } from 'tamagui';

const upcomingSession = {
  date: 'Ср, 24 апреля',
  time: '11:00–12:00',
  trainer: 'Марк Джонсон',
  specialization: 'Кроссфит',
  status: 'Записано',
  initials: 'МД',
};

const actionCards = [
  {
    id: 'find-slots',
    title: 'Найти слоты',
    subtitle: 'Доступные окна',
    icon: '🔎',
  },
  {
    id: 'my-bookings',
    title: 'Мои записи',
    subtitle: 'Ближайшие тренировки',
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
              Client Home
            </Text>
            <Text fontSize="$8" fontWeight="700" color="$text">
              Доброе утро, Алекс!
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
              Ближайшая тренировка
            </Text>
            <XStack
              paddingHorizontal="$3"
              paddingVertical="$1"
              backgroundColor="$accent"
              borderRadius="$3"
            >
              <Text fontSize="$2" color="$accentText">
                {upcomingSession.status}
              </Text>
            </XStack>
          </XStack>
          <Text fontSize="$3" color="$muted">
            {upcomingSession.date}
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
                {upcomingSession.trainer}
              </Text>
              <Text fontSize="$3" color="$muted">
                {upcomingSession.specialization}
              </Text>
              <Text fontSize="$3" color="$muted">
                {upcomingSession.time}
              </Text>
            </YStack>
          </XStack>
          <XStack justifyContent="flex-end">
            <Text fontSize="$3" fontWeight="700" color="$muted" onPress={() => {}}>
              Детали →
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
                    {card.title}
                  </Text>
                  <Text fontSize="$3" color="$muted">
                    {card.subtitle}
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
