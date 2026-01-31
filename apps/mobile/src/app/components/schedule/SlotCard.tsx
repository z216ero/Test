import { useEffect, useMemo, useState } from 'react';
import { Image } from 'react-native';
import { Button, Text, XStack, YStack } from 'tamagui';
import type { SlotDto } from '../../../generated/api';
import { t } from '../../../i18n';
import { formatTimeRangeRu } from '../../../utils/datetime';
import { buildAbsoluteUrl } from '../../../utils/url';
import { getAccessToken } from '../../../auth/tokenStorage';
import {
  getClientAvatarUrl,
  getClientName,
  getSlotStatusType,
  getSlotTimes,
  type SlotStatusType,
} from './slotHelpers';

const statusMeta: Record<SlotStatusType, { label: string; color: string; textColor: string }> = {
  available: {
    label: t('schedule.status.available'),
    color: '$accent',
    textColor: '$text',
  },
  booked: {
    label: t('schedule.status.booked'),
    color: '$primary',
    textColor: '$text',
  },
  cancelled: {
    label: t('schedule.status.cancelled'),
    color: '$muted',
    textColor: '$muted',
  },
};

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
  onPress?: () => void;
};

export function SlotCard({ slot, onPress }: SlotCardProps) {
  const [avatarToken, setAvatarToken] = useState<string | null>(null);
  const statusType = getSlotStatusType(slot);
  const status = statusMeta[statusType];
  const times = getSlotTimes(slot);
  const timeLabel = times ? formatTimeRangeRu(times.start, times.end) : '';
  const clientName = statusType === 'booked' ? getClientName(slot) : null;
  const avatarUrl = statusType === 'booked' ? getClientAvatarUrl(slot) : null;
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

  return (
    <Button
      onPress={onPress}
      disabled={!onPress}
      unstyled
      backgroundColor="$background"
      borderRadius="$5"
      borderWidth={1}
      borderColor="$border"
      padding="$4"
      alignItems="stretch"
      justifyContent="flex-start"
      minHeight="$11"
      width="100%"
    >
      <YStack gap="$3">
        <XStack alignItems="center" justifyContent="space-between" width="100%">
          <Text fontSize="$4" fontWeight="700" color={status.textColor}>
            {timeLabel || t('common.empty')}
          </Text>
          <XStack alignItems="center" gap="$2">
            <YStack
              width="$1"
              height="$1"
              borderRadius="$6"
              backgroundColor={status.color}
            />
            <Text fontSize="$2" color="$muted">
              {status.label}
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
              <Text fontSize="$4" fontWeight="700" color="$text">
                {clientName}
              </Text>
              <Text fontSize="$3" color="$muted">
                {status.label}
              </Text>
            </YStack>
          </XStack>
        ) : null}
      </YStack>
    </Button>
  );
}
