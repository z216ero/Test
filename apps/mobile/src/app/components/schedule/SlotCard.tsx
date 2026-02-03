import { useEffect, useMemo, useState } from 'react';
import { Image } from 'react-native';
import { Button, Text, XStack, YStack } from 'tamagui';
import type { SlotDto } from '@generated/api';
import { t } from '@i18n';
import { formatTimeRangeRu } from '@utils/datetime';
import { buildAbsoluteUrl } from '@utils/url';
import { getAccessToken } from '@auth/tokenStorage';
import { AppIcon } from '@ui/AppIcon';
import {
  getClientAvatarUrl,
  getClientName,
  getSlotTimes,
  getUiSlotStatus,
  uiSlotStatusMeta,
} from './slotHelpers';

const getInitials = (name?: string | null) => {
  const value = name?.trim();
  if (!value) {
    return t('common.initialsPlaceholder');
  }
  const parts = value.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return value.slice(0, 2).toUpperCase();
};

type SlotCardProps = {
  slot: SlotDto;
  nowTs: number;
  onPress?: () => void;
  variant?: 'default' | 'muted';
};

export function SlotCard({ slot, nowTs, onPress, variant = 'default' }: SlotCardProps) {
  const [avatarToken, setAvatarToken] = useState<string | null>(null);
  const statusType = getUiSlotStatus(slot, nowTs);
  const status = uiSlotStatusMeta[statusType];
  const statusLabel = t(status.labelKey);
  const times = getSlotTimes(slot);
  const timeLabel = times ? formatTimeRangeRu(times.start, times.end) : '';
  const clientName = statusType !== 'available' ? getClientName(slot) : null;
  const avatarUrl = statusType !== 'available' ? getClientAvatarUrl(slot) : null;
  const resolvedAvatar = avatarUrl ? buildAbsoluteUrl(avatarUrl) : null;
  const avatarSource = useMemo(() => {
    if (!resolvedAvatar || !avatarToken) {
      return null;
    }
    return {
      uri: resolvedAvatar,
      headers: { Authorization: `Bearer ${avatarToken}` },
    };
  }, [avatarToken, resolvedAvatar]);

  useEffect(() => {
    let cancelled = false;
    getAccessToken().then((token) => {
      if (!cancelled) {
        setAvatarToken(token);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isMuted = variant === 'muted';
  const isNeedsAttention = statusType === 'needs_attention';
  const titleColor = isMuted ? '$muted' : '$text';
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

  return (
    <Button
      onPress={onPress}
      disabled={!onPress}
      unstyled
      backgroundColor={cardBackground}
      borderRadius="$5"
      borderWidth={borderWidth}
      borderColor={borderColor}
      padding="$4"
      alignItems="stretch"
      justifyContent="flex-start"
      minHeight="$11"
      width="100%"
    >
      <YStack gap="$3">
        <XStack alignItems="center" justifyContent="space-between" width="100%">
          <Text fontSize="$4" fontWeight="700" color={titleColor}>
            {timeLabel || t('common.empty')}
          </Text>
          <XStack alignItems="center" gap="$2">
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
            <YStack
              width="$9"
              height="$9"
              borderRadius="$6"
              backgroundColor="$surfaceMuted"
              borderWidth={1}
              borderColor="$border"
              alignItems="center"
              justifyContent="center"
              overflow="hidden"
            >
              {avatarSource ? (
                <Image
                  source={avatarSource}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <Text fontSize="$4" color="$muted">
                  {getInitials(clientName)}
                </Text>
              )}
            </YStack>
            <YStack gap="$1" flex={1}>
              <Text fontSize="$4" fontWeight="700" color={isMuted ? '$muted' : '$text'}>
                {clientName}
              </Text>
              <Text fontSize="$3" color="$muted">
                {statusLabel}
              </Text>
            </YStack>
          </XStack>
        ) : null}
      </YStack>
    </Button>
  );
}


