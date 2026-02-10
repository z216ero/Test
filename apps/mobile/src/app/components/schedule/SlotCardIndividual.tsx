import { Text, XStack, YStack } from 'tamagui';
import { t } from '@i18n';
import { AppIcon } from '@ui/AppIcon';
import { Avatar, useAuthorizedImageSource } from '@ui/components';

type Highlight = {
  color: 'success' | 'destructive';
  chipText: string;
};

type SlotCardIndividualProps = {
  timeLabel: string;
  titleColor: string;
  statusColor: string;
  labelColor: string;
  statusLabel: string;
  isNeedsAttention: boolean;
  isMuted: boolean;
  clientName: string | null;
  avatarUrl: string | null;
  highlight: Highlight | null;
};

export function SlotCardIndividual({
  timeLabel,
  titleColor,
  statusColor,
  labelColor,
  statusLabel,
  isNeedsAttention,
  isMuted,
  clientName,
  avatarUrl,
  highlight,
}: SlotCardIndividualProps) {
  const avatarSource = useAuthorizedImageSource(avatarUrl);
  const highlightChipColor = highlight
    ? highlight.color === 'success'
      ? '$accent'
      : '$danger'
    : '$accent';

  return (
    <YStack gap="$3">
      <XStack alignItems="center" justifyContent="space-between" width="100%" gap="$3">
        <Text fontSize="$4" fontWeight="700" color={titleColor}>
          {timeLabel || t('common.empty')}
        </Text>
        <XStack alignItems="center" gap="$2" flexShrink={1} minWidth={0}>
          {highlight ? (
            <XStack
              paddingHorizontal="$2"
              paddingVertical="$1"
              borderRadius="$3"
              borderWidth={1}
              borderColor={highlightChipColor}
              backgroundColor="$surfaceMuted"
            >
              <Text fontSize="$2" fontWeight="700" color={highlightChipColor}>
                {highlight.chipText}
              </Text>
            </XStack>
          ) : null}
          <YStack width="$1" height="$1" borderRadius="$6" backgroundColor={statusColor} />
          {isNeedsAttention ? (
            <AppIcon name="alertCircle" size={12} color={statusColor} />
          ) : null}
          <Text fontSize="$2" color={labelColor} numberOfLines={1} ellipsizeMode="tail" flexShrink={1}>
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
  );
}
