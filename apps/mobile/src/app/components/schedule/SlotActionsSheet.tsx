import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '@tamagui/sheet';
import { Button, Switch, Text, XStack, YStack } from 'tamagui';
import type { SlotDto } from '@generated/api';
import { t } from '@i18n';
import { formatTimeRangeRu } from '@utils/datetime';
import { AppIcon } from '@ui/AppIcon';
import { Avatar, DualActionSelector, useAuthorizedImageSource } from '@ui/components';
import {
  CANCEL_FORBIDDEN_WITHIN_MS,
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
import type { PaymentMethod } from '@api/trainerSlotsApi';

type SlotActionsSheetProps = {
  open: boolean;
  slot: SlotDto | null;
  nowTs: number;
  onOpenChange: (open: boolean) => void;
  onCancelSlot?: (slot: SlotDto) => void;
  onMarkCompleted?: (slot: SlotDto) => void;
  onMarkNoShow?: (slot: SlotDto) => void;
  isCancelling?: boolean;
  isMarkingCompleted?: boolean;
  isMarkingNoShow?: boolean;
  isClosingBooking?: boolean;
  showAttendanceActions?: boolean;
  onCloseBooking?: (
    payload: {
      slot: SlotDto;
      attendance: 'Completed' | 'NoShow';
      markPaid: boolean;
      method: PaymentMethod | null;
    }
  ) => void;
};

const paymentMethods: PaymentMethod[] = ['Cash', 'Transfer', 'SBP'];

const paymentMethodLabel = (method: PaymentMethod): string => {
  if (method === 'Cash') {
    return t('payments.method.cash');
  }
  if (method === 'Transfer') {
    return t('payments.method.transfer');
  }
  return t('payments.method.sbp');
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
  isClosingBooking,
  showAttendanceActions,
  onCloseBooking,
}: SlotActionsSheetProps) {
  const statusType = slot ? getUiSlotStatus(slot, nowTs) : null;
  const statusMeta = statusType ? uiSlotStatusMeta[statusType] : null;
  const statusLabel = statusMeta ? t(statusMeta.labelKey) : null;
  const showStatusIcon = statusType === 'needs_attention';
  const times = slot ? getSlotTimes(slot) : null;
  const timeLabel = times ? formatTimeRangeRu(times.start, times.end) : '';
  const clientName = slot ? getClientName(slot) : null;
  const avatarUrl = slot ? getClientAvatarUrl(slot) : null;
  const avatarSource = useAuthorizedImageSource(avatarUrl);

  const canMarkAttendance =
    !!slot?.id
    && showAttendanceActions
    && (statusType === 'booked' || statusType === 'needs_attention');
  const canShowNoShow = !!slot && canMarkAttendance && canMarkNoShow(slot, nowTs);
  const canShowComplete = !!slot && canMarkAttendance && canMarkCompleted(slot, nowTs);
  const canCancelAvailable = !!slot && canCancelSlot(slot, nowTs);
  const startTs = slot ? getSlotStartTimestamp(slot) : null;
  const canCancelBooked =
    !!slot && statusType !== 'needs_attention' && canCancelBookedSlot(slot, nowTs);
  const showBookedCancelLockedByTime =
    !!slot
    && statusType === 'booked'
    && !canCancelBooked
    && startTs !== null
    && nowTs < startTs
    && nowTs >= startTs - CANCEL_FORBIDDEN_WITHIN_MS;
  const isPastFreeSlot = !!slot && isFreeSlotPast(slot, nowTs);
  const isFinalAttendance = !!slot && statusType ? isUiSlotStatusFinal(statusType) : false;
  const isBeforeStart = startTs !== null && nowTs < startTs;

  const isActionPending =
    isCancelling || isMarkingCompleted || isMarkingNoShow || isClosingBooking;
  const [selectedAttendance, setSelectedAttendance] = useState<'Completed' | 'NoShow'>('Completed');
  const [markPaid, setMarkPaid] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('Cash');
  const isNoShowSelected = selectedAttendance === 'NoShow';

  useEffect(() => {
    if (!open || !slot?.id) {
      return;
    }
    setSelectedAttendance(canShowNoShow && !canShowComplete ? 'NoShow' : 'Completed');
    setMarkPaid(false);
    setSelectedMethod('Cash');
  }, [open, slot?.id, canShowNoShow, canShowComplete]);

  useEffect(() => {
    if (isNoShowSelected && markPaid) {
      setMarkPaid(false);
    }
  }, [isNoShowSelected, markPaid]);

  const canUseCloseForm =
    !!slot?.bookingId
    && canMarkAttendance
    && !!onCloseBooking;
  const noShowAvailableAtTs = startTs !== null
    ? startTs + 15 * 60 * 1000
    : null;
  const noShowMinutesLeft = noShowAvailableAtTs !== null && nowTs < noShowAvailableAtTs
    ? Math.ceil((noShowAvailableAtTs - nowTs) / (60 * 1000))
    : 0;
  const showNoShowLockedHint =
    canUseCloseForm
    && !canShowNoShow
    && noShowMinutesLeft > 0;
  const canSaveClose = useMemo(() => {
    if (!canUseCloseForm || isActionPending) {
      return false;
    }
    if (selectedAttendance === 'Completed') {
      return canShowComplete;
    }
    return canShowNoShow;
  }, [canUseCloseForm, isActionPending, selectedAttendance, canShowComplete, canShowNoShow]);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      dismissOnSnapToBottom
      snapPoints={[72]}
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
        paddingBottom="$7"
        gap="$4"
        backgroundColor="$backgroundSoft"
        borderTopWidth={1}
        borderTopColor="$border"
        borderTopLeftRadius="$6"
        borderTopRightRadius="$6"
      >
        <Sheet.Handle />
        {slot ? (
          <YStack gap="$4">
            <XStack alignItems="center" gap="$3">
              <Avatar
                name={clientName}
                source={avatarSource}
                size="$10"
                borderRadius="$7"
                textSize="$4"
              />
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
                  onCancelSlot ? (
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
                  ) : null
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
                {canUseCloseForm && canShowComplete ? (
                  <YStack gap="$3">
                    <Text fontSize="$3" color="$muted">
                      {t('schedule.close.attendanceTitle')}
                    </Text>
                    <DualActionSelector
                      selectLabel={t('slotDetails.markCompleted')}
                      cancelLabel={t('slotDetails.markNoShow')}
                      selectedAction={selectedAttendance === 'Completed' ? 'select' : 'cancel'}
                      onSelect={() => setSelectedAttendance('Completed')}
                      onCancel={() => setSelectedAttendance('NoShow')}
                      selectDisabled={!canShowComplete}
                      cancelDisabled={!canShowNoShow}
                      disabled={isActionPending}
                    />
                    {showNoShowLockedHint ? (
                      <Text fontSize="$2" color="$muted">
                        {t('schedule.close.noShowAvailableIn', { minutes: noShowMinutesLeft })}
                      </Text>
                    ) : null}
                    <XStack
                      backgroundColor="$background"
                      borderRadius="$4"
                      borderWidth={1}
                      borderColor="$border"
                      padding="$3"
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Text fontSize="$3" color="$text">
                        {t('schedule.close.markPaid')}
                      </Text>
                      <Switch
                        size="$4"
                        checked={markPaid}
                        onCheckedChange={setMarkPaid}
                        disabled={isActionPending || isNoShowSelected}
                        backgroundColor={markPaid ? '$accent' : '$surfaceMuted'}
                        borderWidth={1}
                        borderColor="$border"
                      >
                        <Switch.Thumb
                          backgroundColor="$background"
                          borderWidth={1}
                          borderColor="$border"
                        />
                      </Switch>
                    </XStack>
                    {markPaid && !isNoShowSelected ? (
                      <XStack gap="$2">
                        {paymentMethods.map((method) => {
                          const selected = method === selectedMethod;
                          return (
                            <Button
                              key={method}
                              flex={1}
                              backgroundColor={selected ? '$background' : '$surfaceMuted'}
                              borderWidth={1}
                              borderColor={selected ? '$accent' : '$border'}
                              borderRadius="$4"
                              minHeight="$9"
                              onPress={() => setSelectedMethod(method)}
                              disabled={isActionPending}
                            >
                              <Text color="$text" fontWeight={selected ? '700' : '600'}>
                                {paymentMethodLabel(method)}
                              </Text>
                            </Button>
                          );
                        })}
                      </XStack>
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
                    {statusType === 'needs_attention' ? (
                      <XStack
                        padding="$4"
                        borderRadius="$4"
                        backgroundColor="$surfaceMuted"
                        borderWidth={1}
                        borderColor="$border"
                      >
                        <Text fontSize="$3" color="$muted">
                          {t('schedule.sheet.attendanceRequired')}
                        </Text>
                      </XStack>
                    ) : null}
                    <Button
                      unstyled
                      onPress={() => onCloseBooking({
                        slot,
                        attendance: selectedAttendance,
                        markPaid: !isNoShowSelected && markPaid,
                        method: !isNoShowSelected && markPaid ? selectedMethod : null,
                      })}
                      disabled={!canSaveClose}
                    >
                      <XStack
                        minHeight="$10"
                        borderRadius="$4"
                        backgroundColor="$accent"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Text color="$accentText" fontWeight="600">
                          {isClosingBooking ? t('common.loading') : t('schedule.close.save')}
                        </Text>
                      </XStack>
                    </Button>
                  </YStack>
                ) : !canUseCloseForm ? (
                  <>
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
                    {statusType === 'needs_attention' ? (
                      <XStack
                        padding="$4"
                        borderRadius="$4"
                        backgroundColor="$surfaceMuted"
                        borderWidth={1}
                        borderColor="$border"
                      >
                        <Text fontSize="$3" color="$muted">
                          {t('schedule.sheet.attendanceRequired')}
                        </Text>
                      </XStack>
                    ) : null}
                  </>
                ) : null}
                {canCancelBooked || showBookedCancelLockedByTime ? (
                  onCancelSlot ? (
                  <Button
                    backgroundColor="$background"
                    borderWidth={1}
                    borderColor="$primary"
                    borderRadius="$4"
                    height="$10"
                    onPress={() => onCancelSlot(slot)}
                    disabled={isActionPending || !canCancelBooked}
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
                  ) : null
                ) : null}
                {showBookedCancelLockedByTime ? (
                  <Text fontSize="$2" color="$muted">
                    {t('schedule.sheet.cancelUnavailable')}
                  </Text>
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
              unstyled
              onPress={() => onOpenChange(false)}
            >
              <XStack
                minHeight="$10"
                borderRadius="$4"
                borderWidth={1}
                borderColor="$border"
                backgroundColor="$surfaceMuted"
                alignItems="center"
                justifyContent="center"
              >
                <Text color="$text" fontWeight="600">
                  {t('profile.personal.cancel')}
                </Text>
              </XStack>
            </Button>
          </YStack>
        ) : null}
      </Sheet.Frame>
    </Sheet>
  );
}
