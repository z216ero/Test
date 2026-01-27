import { Button, Text, XStack, YStack } from 'tamagui';
import { t } from '../../i18n';
import type { TranslationKey } from '../../i18n';

const mockSlots: Array<{
  id: string;
  trainerKey: TranslationKey;
  specializationKey: TranslationKey;
  timeKey: TranslationKey;
  priceKey: TranslationKey;
  initials: string;
}> = [
  {
    id: 'slot-1',
    trainerKey: 'slots.mock.trainer1',
    specializationKey: 'slots.mock.specialization1',
    timeKey: 'slots.mock.time1',
    priceKey: 'slots.mock.price1',
    initials: 'СК',
  },
  {
    id: 'slot-2',
    trainerKey: 'slots.mock.trainer2',
    specializationKey: 'slots.mock.specialization2',
    timeKey: 'slots.mock.time2',
    priceKey: 'slots.mock.price2',
    initials: 'РИ',
  },
  {
    id: 'slot-3',
    trainerKey: 'slots.mock.trainer3',
    specializationKey: 'slots.mock.specialization3',
    timeKey: 'slots.mock.time3',
    priceKey: 'slots.mock.price3',
    initials: 'ИТ',
  },
];

export function SlotsScreen() {
  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <YStack flex={1} padding="$6" gap="$6">
        <YStack gap="$2">
          <Text fontSize="$8" fontWeight="700" color="$text">
            {t('slots.title')}
          </Text>
          <Text fontSize="$4" color="$muted">
            {t('slots.subtitle')}
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
                {t('slots.filters.date')}
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
              {t('slots.filters.button')}
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
                      {t(slot.trainerKey)}
                    </Text>
                    <Text fontSize="$3" color="$text">
                      {t(slot.priceKey)}
                    </Text>
                  </XStack>
                  <Text fontSize="$3" color="$muted">
                    {t(slot.specializationKey)}
                  </Text>
                  <Text fontSize="$3" color="$muted">
                    {t(slot.timeKey)}
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
                  {t('slots.card.book')}
                </Button>
              </XStack>
            </YStack>
          ))}
        </YStack>
      </YStack>
    </YStack>
  );
}
