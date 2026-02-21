import { Sheet } from '@tamagui/sheet';
import { Button, Input, Switch, Text, XStack, YStack } from 'tamagui';
import { t } from '@i18n';

type CreateSlotGroupSettingsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupCapacityMin: number;
  onGroupCapacityMinChange: (value: number) => void;
  groupCapacityMax: number;
  onGroupCapacityMaxChange: (value: number) => void;
  groupAutoCancelIfMinNotReached: boolean;
  onGroupAutoCancelIfMinNotReachedChange: (value: boolean) => void;
};

export function CreateSlotGroupSettingsSheet({
  open,
  onOpenChange,
  groupCapacityMin,
  onGroupCapacityMinChange,
  groupCapacityMax,
  onGroupCapacityMaxChange,
  groupAutoCancelIfMinNotReached,
  onGroupAutoCancelIfMinNotReachedChange,
}: CreateSlotGroupSettingsSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      modal
      dismissOnSnapToBottom
      snapPoints={[50]}
    >
      <Sheet.Overlay
        animation="fast"
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
        backgroundColor="rgba(15, 23, 42, 0.2)"
      />
      <Sheet.Frame padding="$5" gap="$4" backgroundColor="$backgroundSoft">
        <Sheet.Handle />
        <Text fontSize="$5" fontWeight="700" color="$text">
          {t('createSlot.groupSettingsTitle')}
        </Text>
        <YStack gap="$2">
          <Text fontSize="$3" color="$text">{t('createSlot.groupCapacityMinLabel')}</Text>
          <Input
            height="50"
            keyboardType="numeric"
            value={String(groupCapacityMin)}
            onChangeText={(value: string) => {
              const parsed = Number(value.replace(/\D/g, ''));
              onGroupCapacityMinChange(Number.isNaN(parsed) ? 2 : parsed);
            }}
          />
        </YStack>
        <YStack gap="$2">
          <Text fontSize="$3" color="$text">{t('createSlot.groupCapacityMaxLabel')}</Text>
          <Input
            height="50"
            keyboardType="numeric"
            value={String(groupCapacityMax)}
            onChangeText={(value: string) => {
              const parsed = Number(value.replace(/\D/g, ''));
              onGroupCapacityMaxChange(Number.isNaN(parsed) ? 10 : parsed);
            }}
          />
        </YStack>
        <XStack alignItems="center" justifyContent="space-between" gap="$3">
          <YStack flex={1} gap="$1">
            <Text fontSize="$3" color="$text">
              {t('createSlot.groupAutoCancelToggle')}
            </Text>
            <Text fontSize="$2" color="$muted">
              {t('createSlot.groupAutoCancelHint', { minutes: 40 })}
            </Text>
          </YStack>
          <Switch
            size="$6"
            checked={groupAutoCancelIfMinNotReached}
            onCheckedChange={onGroupAutoCancelIfMinNotReachedChange}
            backgroundColor={groupAutoCancelIfMinNotReached ? '$accent' : '$surfaceMuted'}
          >
            <Switch.Thumb
              backgroundColor="$background"
              borderWidth={1}
              borderColor="$border"
            />
          </Switch>
        </XStack>
        <Button
          height="50"
          onPress={() => onOpenChange(false)}
          disabled={groupCapacityMin < 2 || groupCapacityMax > 100 || groupCapacityMin > groupCapacityMax}
        >
          {t('common.close')}
        </Button>
      </Sheet.Frame>
    </Sheet>
  );
}

