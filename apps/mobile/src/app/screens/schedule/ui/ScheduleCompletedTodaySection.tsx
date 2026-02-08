import type { SlotDto } from '@generated/api';
import { t } from '@i18n';
import { AppIcon } from '@ui/AppIcon';
import { SlotCard } from '@app/components/schedule/SlotCard';
import { Button, Text, XStack, YStack } from 'tamagui';

type ScheduleCompletedTodaySectionProps = {
  open: boolean;
  count: number;
  slots: SlotDto[];
  nowTs: number;
  onToggle: () => void;
  getHighlight?: (slot: SlotDto) => { color: 'success' | 'destructive'; chipText: string } | null;
};

export function ScheduleCompletedTodaySection({
  open,
  count,
  slots,
  nowTs,
  onToggle,
  getHighlight,
}: ScheduleCompletedTodaySectionProps) {
  if (count === 0) {
    return null;
  }

  return (
    <YStack gap="$3">
      <Button
        unstyled
        backgroundColor="$surfaceMuted"
        borderWidth={1}
        borderColor="$border"
        borderRadius="$4"
        padding="$3"
        onPress={onToggle}
      >
        <XStack alignItems="center" justifyContent="space-between">
          <Text fontSize="$3" fontWeight="600" color="$text">
            {t('schedule.completedTodayTitle', { count })}
          </Text>
          <YStack
            style={{
              transform: [{ rotate: open ? '90deg' : '0deg' }],
            }}
          >
            <AppIcon name="chevronRight" size={18} color="$muted" />
          </YStack>
        </XStack>
      </Button>
      {open ? (
        <YStack gap="$3">
          {slots.map((slot) => (
            <SlotCard
              key={slot.id ?? `${slot.startsAtUtc ?? 'slot'}`}
              slot={slot}
              nowTs={nowTs}
              onPress={undefined}
              variant="muted"
              highlight={getHighlight ? getHighlight(slot) : null}
            />
          ))}
        </YStack>
      ) : null}
    </YStack>
  );
}
