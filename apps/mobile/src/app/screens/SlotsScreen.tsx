import { Button, Text, XStack, YStack } from 'tamagui';

const mockSlots = [
  {
    id: 'slot-1',
    trainer: 'Sarah Kim',
    specialization: 'Yoga',
    time: '5:00 PM - 6:00 PM',
    price: '2000 RUB',
    initials: 'SK',
  },
  {
    id: 'slot-2',
    trainer: 'Rene Ivanov',
    specialization: 'Functional',
    time: '6:30 PM - 7:30 PM',
    price: '1800 RUB',
    initials: 'RI',
  },
  {
    id: 'slot-3',
    trainer: 'Evan Turner',
    specialization: 'Boxing',
    time: '7:00 PM - 8:00 PM',
    price: '2500 RUB',
    initials: 'ET',
  },
];

export function SlotsScreen() {
  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <YStack flex={1} padding="$6" gap="$6">
        <YStack gap="$2">
          <Text fontSize="$8" fontWeight="700" color="$text">
            Available Slots
          </Text>
          <Text fontSize="$4" color="$muted">
            Choose a time that fits your schedule.
          </Text>
        </YStack>
        <XStack gap="$2">
          <Button
            flex={1}
            backgroundColor="$background"
            borderRadius="$4"
            borderWidth={1}
            borderColor="$border"
            minHeight="$9"
            paddingVertical="$2"
            onPress={() => {}}
          >
            <XStack alignItems="center" gap="$2">
              <Text fontSize="$4">D</Text>
              <Text fontSize="$3" color="$text">
                Today, Apr 24
              </Text>
            </XStack>
          </Button>
          <Button
            backgroundColor="$background"
            borderRadius="$4"
            borderWidth={1}
            borderColor="$border"
            minHeight="$9"
            paddingHorizontal="$4"
            onPress={() => {}}
          >
            <Text fontSize="$3" color="$text">
              Filters
            </Text>
          </Button>
        </XStack>
        <YStack gap="$4">
          {mockSlots.map((slot) => (
            <YStack
              key={slot.id}
              gap="$3"
              padding="$4"
              backgroundColor="$background"
              borderRadius="$5"
              borderWidth={1}
              borderColor="$border"
            >
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
                    {slot.initials}
                  </Text>
                </YStack>
                <YStack flex={1} gap="$1">
                  <XStack justifyContent="space-between" alignItems="center">
                    <Text fontSize="$4" fontWeight="700" color="$text">
                      {slot.trainer}
                    </Text>
                    <Text fontSize="$3" color="$text">
                      {slot.price}
                    </Text>
                  </XStack>
                  <Text fontSize="$3" color="$muted">
                    {slot.specialization}
                  </Text>
                  <Text fontSize="$3" color="$muted">
                    {slot.time}
                  </Text>
                </YStack>
              </XStack>
              <XStack justifyContent="flex-end">
                <Button
                  backgroundColor="$accent"
                  color="$accentText"
                  borderRadius="$4"
                  minHeight="$9"
                  paddingHorizontal="$4"
                  paddingVertical="$2"
                  onPress={() => {}}
                >
                  Book Slot
                </Button>
              </XStack>
            </YStack>
          ))}
        </YStack>
      </YStack>
    </YStack>
  );
}
