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
  canCancelBookedSlot,
  canCancelSlot,
  canMarkCompleted,
  canMarkNoShow,
  getClientAvatarUrl,
  getClientName,
  getUiSlotStatus,
  getSlotTimes,
  getSlotStartTimestamp,
  isFreeSlotPast,
  isUiSlotStatusFinal,
  uiSlotStatusMeta,
} from './slotHelpers';

type SlotActionsSheetProps = {
  open: boolean;
  slot: SlotDto | null;
  nowTs: number;
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
  nowTs,
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
  const statusType = slot ? getUiSlotStatus(slot, nowTs) : null;
  const statusMeta = statusType ? uiSlotStatusMeta[statusType] : null;
  const statusLabel = statusMeta ? t(statusMeta.labelKey) : null;
  const showStatusIcon = statusType === 'needs_attention';
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

  const canMarkAttendance =
    !!slot?.id
    && showAttendanceActions
    && (statusType === 'booked' || statusType === 'needs_attention');
  const canShowNoShow = !!slot && canMarkAttendance && canMarkNoShow(slot, nowTs);
  const canShowComplete = !!slot && canMarkAttendance && canMarkCompleted(slot, nowTs);
  const canCancelAvailable = !!slot && canCancelSlot(slot, nowTs);
  const canCancelBooked = !!slot && canCancelBookedSlot(slot, nowTs);
  const isPastFreeSlot = !!slot && isFreeSlotPast(slot, nowTs);
  const isFinalAttendance = !!slot && statusType ? isUiSlotStatusFinal(statusType) : false;
  const startTs = slot ? getSlotStartTimestamp(slot) : null;
  const isBeforeStart = startTs !== null && nowTs < startTs;

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
                {statusLabel ? (
                  <XStack alignItems="center" gap="$2">
                    <YStack
                      width="$1"
                      height="$1"
                      borderRadius="$6"
                      backgroundColor={statusMeta?.dotColor}
                    />
                    {showStatusIcon ? (
                      <AppIcon name="alertCircle" size={12} color={statusMeta?.dotColor} />
                    ) : null}
                    <Text fontSize="$3" color={statusMeta?.labelColor ?? '$muted'}>
                      {statusLabel}
                    </Text>
                  </XStack>
                ) : null}
              </YStack>
            </XStack>

            {statusType === 'available' ? (
              <YStack gap="$3">
                {canCancelAvailable ? (
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
                ) : (
                  <XStack
                    padding="$4"
                    borderRadius="$4"
                    backgroundColor="$surfaceMuted"
                    borderWidth={1}
                    borderColor="$border"
                  >
                    <Text fontSize="$3" color="$muted">
                      {isPastFreeSlot
                        ? t('schedule.sheet.pastFreeInfo')
                        : t('schedule.sheet.cancelUnavailable')}
                    </Text>
                  </XStack>
                )}
              </YStack>
            ) : null}

            {statusType === 'booked' || statusType === 'needs_attention' ? (
              <YStack gap="$3">
                {canShowComplete && onMarkCompleted ? (
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
                {canMarkAttendance && !isFinalAttendance && isBeforeStart ? (
                  <XStack
                    padding="$4"
                    borderRadius="$4"
                    backgroundColor="$surfaceMuted"
                    borderWidth={1}
                    borderColor="$border"
                  >
                    <Text fontSize="$3" color="$muted">
                      {t('schedule.sheet.completeAfterStart')}
                    </Text>
                  </XStack>
                ) : null}
                {canShowNoShow && onMarkNoShow ? (
                  <Button
                    backgroundColor="$background"
                    borderWidth={1}
                    borderColor="$danger"
                    borderRadius="$4"
                    height="$10"
                    onPress={() => onMarkNoShow(slot)}
                    disabled={isActionPending}
                  >
                    <XStack alignItems="center" gap="$2">
                      <AppIcon name="alertCircle" size={18} color="$danger" />
                      <Text color="$danger">
                        {isMarkingNoShow
                          ? t('common.loading')
                          : t('slotDetails.markNoShow')}
                      </Text>
                    </XStack>
                  </Button>
                ) : null}
                {!canMarkAttendance ? (
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
                {canCancelBooked ? (
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
                          : t('schedule.actions.cancelTraining')}
                      </Text>
                    </XStack>
                  </Button>
                ) : null}
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
