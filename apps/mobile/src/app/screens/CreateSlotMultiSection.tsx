import { Button, Switch, Text, XStack, YStack } from 'tamagui';
import { t } from '@i18n';
import { SLOT_DURATION_MINUTES } from '@utils/slotTimeGrid';
import { MULTI_COUNTS } from './useCreateSlotFormState';

type CreateSlotMultiSectionProps = {
  multiEnabled: boolean;
  onToggle: (value: boolean) => void;
  multiCount: number;
  onSelectCount: (value: number) => void;
};

export function CreateSlotMultiSection({
  multiEnabled,
  onToggle,
  multiCount,
  onSelectCount,
}: CreateSlotMultiSectionProps) {
  return (
    <YStack gap="$3">
      <XStack alignItems="center" justifyContent="space-between">
        <YStack flex={1} gap="$1">
          <Text fontSize="$5" fontWeight="700" color="$text">
            {t('createSlot.multiLabel')}
          </Text>
          <Text fontSize="$3" color="$muted">
            {t('createSlot.multiHint', { minutes: SLOT_DURATION_MINUTES })}
          </Text>
        </YStack>
        <Switch
          size="$7"
          checked={multiEnabled}
          onCheckedChange={onToggle}
          backgroundColor={multiEnabled ? '$accent' : '$surfaceMuted'}
        >
          <Switch.Thumb
            backgroundColor="$background"
            borderWidth={1}
            borderColor="$border"
          />
        </Switch>
      </XStack>
      {multiEnabled ? (
        <YStack gap="$2">
          <Text fontSize="$4" color="$text">
            {t('createSlot.multiCountLabel')}
          </Text>
          <XStack gap="$2">
            {MULTI_COUNTS.map((count) => {
              const isActive = count === multiCount;
              return (
                <Button
                  key={count}
                  flex={1}
                  backgroundColor={isActive ? '$accent' : '$background'}
                  borderRadius="$4"
                  borderWidth={1}
                  borderColor={isActive ? '$accent' : '$border'}
                  onPress={() => onSelectCount(count)}
                  minHeight="$10"
                >
                  <Text color={isActive ? '$accentText' : '$text'}>
                    {count}
                  </Text>
                </Button>
              );
            })}
          </XStack>
        </YStack>
      ) : null}
    </YStack>
  );
}


