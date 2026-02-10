import { Text, XStack, YStack } from 'tamagui';
import { t } from '@i18n';
import { AppIcon } from '@ui/AppIcon';

type SlotCardGroupProps = {
  timeLabel: string;
  titleColor: string;
  statusColor: string;
  labelColor: string;
  statusLabel: string;
  occupiedCount: number;
  capacityMax: number | null;
  isNeedsAttention: boolean;
  isFull: boolean;
};

export function SlotCardGroup({
  timeLabel,
  titleColor,
  statusColor,
  labelColor,
  statusLabel,
  occupiedCount,
  capacityMax,
  isNeedsAttention,
  isFull,
}: SlotCardGroupProps) {
  const occupancyColor = isFull ? '$accent' : labelColor;

  return (
    <YStack gap="$3">
      <XStack alignItems="center" justifyContent="space-between" width="100%">
        <Text fontSize="$4" fontWeight="700" color={titleColor}>
          {timeLabel || t('common.empty')}
        </Text>
        <XStack alignItems="center" gap="$2" flexShrink={1} minWidth={0}>
          <YStack width="$1" height="$1" borderRadius="$6" backgroundColor={statusColor} />
          {isNeedsAttention ? (
            <AppIcon name="alertCircle" size={12} color={statusColor} />
          ) : null}
          <Text fontSize="$2" color={labelColor} numberOfLines={1} ellipsizeMode="tail" flexShrink={1}>
            {statusLabel}
          </Text>
        </XStack>
      </XStack>

      <XStack alignItems="center" gap="$2">
        <AppIcon name="users" size={14} color="$muted" />
        <Text fontSize="$2" color={occupancyColor} fontWeight={isFull ? '700' : '500'}>
          {capacityMax ? `${occupiedCount}/${capacityMax}` : `${occupiedCount}`}
        </Text>
      </XStack>
    </YStack>
  );
}
