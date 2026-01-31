import { Sheet } from '@tamagui/sheet';
import { useEffect, useMemo, useState } from 'react';
import { Image } from 'react-native';
import { Button, Text, XStack, YStack } from 'tamagui';
import type { SlotDto } from '../../../generated/api';
import { t } from '../../../i18n';
import { formatTimeRangeRu } from '../../../utils/datetime';
import { getAccessToken } from '../../../auth/tokenStorage';
import { AppIcon } from '../../../ui/AppIcon';
import { buildAbsoluteUrl } from '../../../utils/url';
import {
  getClientAvatarUrl,
  getClientName,
  getSlotStatusType,
  getSlotTimes,
  type SlotStatusType,
} from './slotHelpers';

const statusLabelMap: Record<SlotStatusType, string> = {
  available: t('schedule.status.available'),
  booked: t('schedule.status.booked'),
  cancelled: t('schedule.status.cancelled'),
};

type SlotActionsSheetProps = {
  open: boolean;
  slot: SlotDto | null;
  onOpenChange: (open: boolean) => void;
  onCancelSlot: (slot: SlotDto) => void;
  onMarkCompleted?: (slot: SlotDto) => void;
  onMarkNoShow?: (slot: SlotDto) => void;
  isCancelling?: boolean;
  isMarkingCompleted?: boolean;
  isMarkingNoShow?: boolean;
  showAttendanceActions?: boolean;
};

export function SlotActionsSheet({
  open,
  slot,
  onOpenChange,
  onCancelSlot,
  onMarkCompleted,
  onMarkNoShow,
  isCancelling,
  isMarkingCompleted,
  isMarkingNoShow,
  showAttendanceActions,
}: SlotActionsSheetProps) {
  const [avatarToken, setAvatarToken] = useState<string | null>(null);
  const statusType = slot ? getSlotStatusType(slot) : null;
  const times = slot ? getSlotTimes(slot) : null;
  const timeLabel = times ? formatTimeRangeRu(times.start, times.end) : '';
  const clientName = slot ? getClientName(slot) : null;
  const avatarUrl = slot ? getClientAvatarUrl(slot) : null;
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

  const canMark =
    !!slot?.id && showAttendanceActions && statusType === 'booked';

  const isActionPending =
    isCancelling || isMarkingCompleted || isMarkingNoShow;

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

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      dismissOnSnapToBottom
      snapPoints={[45]}
      dismissOnOverlayPress
    >
      <Sheet.Overlay
        animation="fast"
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
        backgroundColor="rgba(15, 23, 42, 0.2)"
      />
      <Sheet.Frame
        padding="$5"
        gap="$4"
        backgroundColor="$backgroundSoft"
        borderTopLeftRadius="$6"
        borderTopRightRadius="$6"
      >
        <Sheet.Handle />
        {slot ? (
          <YStack gap="$4">
            <XStack alignItems="center" gap="$3">
              <YStack
                width="$10"
                height="$10"
                borderRadius="$7"
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
                <Text fontSize="$5" fontWeight="700" color="$text">
                  {statusType === 'available'
                    ? t('schedule.sheet.availableTitle')
                    : statusType === 'cancelled'
                      ? t('schedule.sheet.cancelledTitle')
                      : clientName || t('schedule.sheet.bookingTitle')}
                </Text>
                <Text fontSize="$3" color="$muted">
                  {timeLabel || t('common.empty')}
                </Text>
                {statusType && statusType !== 'available' ? (
                  <Text fontSize="$3" color="$muted">
                    {statusLabelMap[statusType]}
                  </Text>
                ) : null}
              </YStack>
            </XStack>

            {statusType === 'available' ? (
              <YStack gap="$3">
                <Button
                  backgroundColor="$background"
                  borderWidth={1}
                  borderColor="$primary"
                  borderRadius="$4"
                  height="$10"
                  onPress={() => onCancelSlot(slot)}
                  disabled={isActionPending}
                >
                  <XStack alignItems="center" gap="$2">
                    <AppIcon name="trash" size={18} color="$primary" />
                    <Text color="$primary">
                    {isCancelling
                      ? t('common.loading')
                      : t('schedule.actions.cancelSlot')}
                    </Text>
                  </XStack>
                </Button>
              </YStack>
            ) : null}

            {statusType === 'booked' ? (
              <YStack gap="$3">
                {canMark && onMarkCompleted ? (
                  <Button
                    backgroundColor="$background"
                    borderWidth={1}
                    borderColor="$border"
                    borderRadius="$4"
                    height="$10"
                    onPress={() => onMarkCompleted(slot)}
                    disabled={isActionPending}
                  >
                    <XStack alignItems="center" gap="$2">
                      <AppIcon name="check" size={18} color="$accent" />
                      <Text color="$text">
                        {isMarkingCompleted
                          ? t('common.loading')
                          : t('slotDetails.markCompleted')}
                      </Text>
                    </XStack>
                  </Button>
                ) : null}
                {canMark && onMarkNoShow ? (
                  <Button
                    backgroundColor="$background"
                    borderWidth={1}
                    borderColor="$border"
                    borderRadius="$4"
                    height="$10"
                    onPress={() => onMarkNoShow(slot)}
                    disabled={isActionPending}
                  >
                    <XStack alignItems="center" gap="$2">
                      <AppIcon name="slash" size={18} color="$muted" />
                      <Text color="$text">
                        {isMarkingNoShow
                          ? t('common.loading')
                          : t('slotDetails.markNoShow')}
                      </Text>
                    </XStack>
                  </Button>
                ) : null}
                {!canMark ? (
                  <XStack
                    padding="$4"
                    borderRadius="$4"
                    backgroundColor="$surfaceMuted"
                    borderWidth={1}
                    borderColor="$border"
                  >
                    <Text fontSize="$3" color="$muted">
                      {t('schedule.sheet.bookedInfo')}
                    </Text>
                  </XStack>
                ) : null}
                <Button
                  backgroundColor="$background"
                  borderWidth={1}
                  borderColor="$primary"
                  borderRadius="$4"
                  height="$10"
                  onPress={() => onCancelSlot(slot)}
                  disabled={isActionPending}
                >
                  <XStack alignItems="center" gap="$2">
                    <AppIcon name="trash" size={18} color="$primary" />
                    <Text color="$primary">
                      {isCancelling
                        ? t('common.loading')
                        : t('schedule.actions.cancelSlot')}
                    </Text>
                  </XStack>
                </Button>
              </YStack>
            ) : null}

            {statusType === 'cancelled' ? (
              <XStack
                padding="$4"
                borderRadius="$4"
                backgroundColor="$surfaceMuted"
                borderWidth={1}
                borderColor="$border"
              >
                <Text fontSize="$3" color="$muted">
                  {t('schedule.sheet.cancelledInfo')}
                </Text>
              </XStack>
            ) : null}

            <Button
              backgroundColor="$surfaceMuted"
              borderWidth={1}
              borderColor="$border"
              borderRadius="$4"
              height="$10"
              onPress={() => onOpenChange(false)}
            >
              <Text color="$text">{t('profile.personal.cancel')}</Text>
            </Button>
          </YStack>
        ) : null}
      </Sheet.Frame>
    </Sheet>
  );
}
