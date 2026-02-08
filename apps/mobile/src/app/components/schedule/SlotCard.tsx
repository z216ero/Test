import { Button, Text, XStack, YStack } from 'tamagui';
import type { SlotDto } from '@generated/api';
import { t } from '@i18n';
import { formatTimeRangeRu } from '@utils/datetime';
import { AppIcon } from '@ui/AppIcon';
import { Avatar, useAuthorizedImageSource } from '@ui/components';
import {
  getClientAvatarUrl,
  getClientName,
  getSlotTimes,
  getUiSlotStatus,
  uiSlotStatusMeta,
} from './slotHelpers';

type SlotCardProps = {
  slot: SlotDto;
  nowTs: number;
  onPress?: () => void;
  variant?: 'default' | 'muted';
  highlight?: {
    color: 'success' | 'destructive';
    chipText: string;
  } | null;
};

export function SlotCard({
  slot,
  nowTs,
  onPress,
  variant = 'default',
  highlight = null,
}: SlotCardProps) {
  const statusType = getUiSlotStatus(slot, nowTs);
  const status = uiSlotStatusMeta[statusType];
  const statusLabel = t(status.labelKey);
  const times = getSlotTimes(slot);
  const timeLabel = times ? formatTimeRangeRu(times.start, times.end) : '';
  const clientName = statusType !== 'available' ? getClientName(slot) : null;
  const avatarUrl = statusType !== 'available' ? getClientAvatarUrl(slot) : null;
  const avatarSource = useAuthorizedImageSource(avatarUrl);

  const isMuted = variant === 'muted';
  const isNeedsAttention = statusType === 'needs_attention';
  const resolvedHighlight = isNeedsAttention ? null : highlight;
  const titleColor = isMuted ? '$muted' : '$text';
  const isGroup = (slot.slotType ?? '').toLowerCase() === 'group';
  const occupiedCount = slot.occupiedCount ?? 0;
  const capacityMax = slot.capacityMax ?? null;
  const statusColor = status.dotColor;
  const labelColor = status.labelColor;
  const baseBackground = isMuted ? '$surfaceMuted' : '$background';
  const cardBackground = isNeedsAttention && status.backgroundColor
    ? status.backgroundColor
    : baseBackground;
  const borderColor = isNeedsAttention && status.borderColor
    ? status.borderColor
    : '$border';
  const borderWidth = isNeedsAttention ? 2 : 1;
  const highlightBorderColor = resolvedHighlight
    ? resolvedHighlight.color === 'success'
      ? '$accent'
      : '$danger'
    : borderColor;
  const highlightBorderWidth = resolvedHighlight ? 2 : borderWidth;
  const highlightChipColor = resolvedHighlight
    ? resolvedHighlight.color === 'success'
      ? '$accent'
      : '$danger'
    : '$accent';

  return (
    <Button
      onPress={onPress}
      disabled={!onPress}
      unstyled
      backgroundColor={cardBackground}
      borderRadius="$5"
      borderWidth={highlightBorderWidth}
      borderColor={highlightBorderColor}
      padding="$4"
      alignItems="stretch"
      justifyContent="flex-start"
      minHeight="$11"
      width="100%"
      position="relative"
    >
      <YStack gap="$3">
        <XStack alignItems="center" justifyContent="space-between" width="100%">
          <Text fontSize="$4" fontWeight="700" color={titleColor}>
            {timeLabel || t('common.empty')}
          </Text>
          <XStack alignItems="center" gap="$2">
            <AppIcon name={isGroup ? 'users' : 'user'} size={14} color="$muted" />
            {isGroup && capacityMax ? (
              <Text fontSize="$2" color={labelColor}>
                {`${occupiedCount}/${capacityMax}`}
              </Text>
            ) : null}
            {resolvedHighlight ? (
              <XStack
                paddingHorizontal="$2"
                paddingVertical="$1"
                borderRadius="$3"
                borderWidth={1}
                borderColor={highlightChipColor}
                backgroundColor="$surfaceMuted"
              >
                <Text fontSize="$2" fontWeight="700" color={highlightChipColor}>
                  {resolvedHighlight.chipText}
                </Text>
              </XStack>
            ) : null}
            <YStack
              width="$1"
              height="$1"
              borderRadius="$6"
              backgroundColor={statusColor}
            />
            {isNeedsAttention ? (
              <AppIcon name="alertCircle" size={12} color={statusColor} />
            ) : null}
            <Text fontSize="$2" color={labelColor}>
              {statusLabel}
            </Text>
          </XStack>
        </XStack>
        {clientName ? (
          <XStack alignItems="center" gap="$3" minHeight="$9">
            <Avatar
              name={clientName}
              source={avatarSource}
              size="$9"
              borderRadius="$6"
              textSize="$4"
            />
            <YStack gap="$1" flex={1}>
              <Text fontSize="$4" fontWeight="700" color={isMuted ? '$muted' : '$text'}>
                {clientName}
              </Text>
            </YStack>
          </XStack>
        ) : null}
      </YStack>
    </Button>
  );
}


