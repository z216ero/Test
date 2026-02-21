import { Button } from 'tamagui';
import type { SlotDto } from '@generated/api';
import { t } from '@i18n';
import { formatTimeRangeRu } from '@utils/datetime';
import { useAppTheme } from '../../theme/AppThemeContext';
import {
  getClientAvatarUrl,
  getClientName,
  getSlotTimes,
  getUiSlotStatus,
  uiSlotStatusMeta,
  type UiSlotStatus,
} from './slotHelpers';
import { SlotCardIndividual } from './SlotCardIndividual';
import { SlotCardGroup } from './SlotCardGroup';

type SlotCardProps = {
  slot: SlotDto;
  nowTs: number;
  onPress?: () => void;
  variant?: 'default' | 'muted';
  highlight?: {
    color: 'success' | 'destructive';
    chipText: string;
  } | null;
  statusOverride?: UiSlotStatus;
};

export function SlotCard({
  slot,
  nowTs,
  onPress,
  variant = 'default',
  highlight = null,
  statusOverride,
}: SlotCardProps) {
  const { isDark } = useAppTheme();
  const statusType = statusOverride ?? getUiSlotStatus(slot, nowTs);
  const status = uiSlotStatusMeta[statusType];
  const statusLabel = t(status.labelKey);
  const times = getSlotTimes(slot);
  const timeLabel = times ? formatTimeRangeRu(times.start, times.end) : '';
  const isGroup = (slot.slotType ?? '').toLowerCase() === 'group';
  const clientName = !isGroup && statusType !== 'available' ? getClientName(slot) : null;
  const avatarUrl = !isGroup && statusType !== 'available' ? getClientAvatarUrl(slot) : null;

  const isMuted = variant === 'muted';
  const isNeedsAttention = statusType === 'needs_attention';
  const resolvedHighlight = !isGroup && !isNeedsAttention ? highlight : null;
  const titleColor = isMuted ? '$muted' : '$text';
  const occupiedCount = slot.occupiedCount ?? 0;
  const capacityMax = slot.capacityMax ?? null;
  const darkWarningColor = '#CDA15A';
  const darkWarningTint = '#1F1B13';
  const statusColor = isNeedsAttention && isDark ? darkWarningColor : status.dotColor;
  const labelColor = isNeedsAttention && isDark ? darkWarningColor : status.labelColor;
  const baseBackground = isMuted ? '$surfaceMuted' : '$background';
  const cardBackground = isNeedsAttention && status.backgroundColor
    ? isDark ? darkWarningTint : status.backgroundColor
    : baseBackground;
  const borderColor = isNeedsAttention && status.borderColor
    ? isDark ? darkWarningColor : status.borderColor
    : '$border';
  const borderWidth = isNeedsAttention ? 2 : 1;
  const isGroupFull = isGroup && capacityMax !== null && occupiedCount >= capacityMax;
  const highlightBorderColor = resolvedHighlight
    ? resolvedHighlight.color === 'success'
      ? '$accent'
      : '$danger'
    : isGroupFull
      ? '$accent'
      : borderColor;
  const highlightBorderWidth = resolvedHighlight || isGroupFull ? 2 : borderWidth;
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
      {isGroup ? (
        <SlotCardGroup
          timeLabel={timeLabel}
          titleColor={titleColor}
          statusColor={statusColor}
          labelColor={labelColor}
          statusLabel={statusLabel}
          occupiedCount={occupiedCount}
          capacityMax={capacityMax}
          isNeedsAttention={isNeedsAttention}
          isFull={isGroupFull}
        />
      ) : (
        <SlotCardIndividual
          timeLabel={timeLabel}
          titleColor={titleColor}
          statusColor={statusColor}
          labelColor={labelColor}
          statusLabel={statusLabel}
          isNeedsAttention={isNeedsAttention}
          isMuted={isMuted}
          clientName={clientName}
          avatarUrl={avatarUrl}
          highlight={resolvedHighlight}
        />
      )}
    </Button>
  );
}


