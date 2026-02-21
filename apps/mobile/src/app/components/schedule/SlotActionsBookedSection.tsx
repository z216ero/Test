import { Button, Switch, Text, XStack, YStack } from 'tamagui';
import type { SlotDto } from '@generated/api';
import { t } from '@i18n';
import { AppIcon } from '@ui/AppIcon';
import { DualActionSelector } from '@ui/components';
import { paymentMethodLabel } from '@app/components/payments/paymentUi';
import type { PaymentMethod } from '@api/trainerSlotsApi';
import type { UiSlotStatus } from './slotHelpers';
import { SlotActionsClientDeclinedActions } from './SlotActionsClientDeclinedActions';

type SlotActionsBookedSectionProps = {
  slot: SlotDto;
  statusType: UiSlotStatus | null;
  canUseCloseForm: boolean;
  canShowComplete: boolean;
  canShowNoShow: boolean;
  showNoShowLockedHint: boolean;
  noShowMinutesLeft: number;
  selectedAttendance: 'Completed' | 'NoShow';
  setSelectedAttendance: (value: 'Completed' | 'NoShow') => void;
  markPaid: boolean;
  setMarkPaid: (value: boolean) => void;
  isNoShowSelected: boolean;
  selectedMethod: PaymentMethod;
  setSelectedMethod: (method: PaymentMethod) => void;
  paymentMethods: PaymentMethod[];
  canMarkAttendance: boolean;
  isFinalAttendance: boolean;
  isBeforeStart: boolean;
  canSaveClose: boolean;
  isActionPending: boolean;
  isClosingBooking?: boolean;
  onCloseBooking?: (
    payload: {
      slot: SlotDto;
      attendance: 'Completed' | 'NoShow';
      markPaid: boolean;
      method: PaymentMethod | null;
    }
  ) => void;
  onMarkCompleted?: (slot: SlotDto) => void;
  onMarkNoShow?: (slot: SlotDto) => void;
  isMarkingCompleted?: boolean;
  isMarkingNoShow?: boolean;
  onAssignAnotherClient?: (slot: SlotDto) => void;
  onMakeSlotOpen?: (slot: SlotDto) => void;
  isAssigningAnotherClient?: boolean;
  canAssignAnotherClient: boolean;
  canCancelAvailable: boolean;
  onCancelSlot?: (slot: SlotDto) => void;
  isCancelling?: boolean;
  showBookedCancelAction: boolean;
  canCancelBooked: boolean;
  showBookedCancelLockedByTime: boolean;
};

export function SlotActionsBookedSection({
  slot,
  statusType,
  canUseCloseForm,
  canShowComplete,
  canShowNoShow,
  showNoShowLockedHint,
  noShowMinutesLeft,
  selectedAttendance,
  setSelectedAttendance,
  markPaid,
  setMarkPaid,
  isNoShowSelected,
  selectedMethod,
  setSelectedMethod,
  paymentMethods,
  canMarkAttendance,
  isFinalAttendance,
  isBeforeStart,
  canSaveClose,
  isActionPending,
  isClosingBooking,
  onCloseBooking,
  onMarkCompleted,
  onMarkNoShow,
  isMarkingCompleted,
  isMarkingNoShow,
  onAssignAnotherClient,
  onMakeSlotOpen,
  isAssigningAnotherClient,
  canAssignAnotherClient,
  canCancelAvailable,
  onCancelSlot,
  isCancelling,
  showBookedCancelAction,
  canCancelBooked,
  showBookedCancelLockedByTime,
}: SlotActionsBookedSectionProps) {
  if (
    statusType !== 'booked'
    && statusType !== 'needs_attention'
    && statusType !== 'pending_confirmation'
    && statusType !== 'client_declined'
  ) {
    return null;
  }

  return (
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
            onPress={() => onCloseBooking?.({
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
          {!canMarkAttendance && statusType !== 'client_declined' ? (
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
      <SlotActionsClientDeclinedActions
        slot={slot}
        statusType={statusType}
        isActionPending={isActionPending}
        onAssignAnotherClient={onAssignAnotherClient}
        onMakeSlotOpen={onMakeSlotOpen}
        isAssigningAnotherClient={isAssigningAnotherClient}
        canAssignAnotherClient={canAssignAnotherClient}
        canCancelAvailable={canCancelAvailable}
        onCancelSlot={onCancelSlot}
        isCancelling={isCancelling}
        showBookedCancelAction={showBookedCancelAction}
        canCancelBooked={canCancelBooked}
        showBookedCancelLockedByTime={showBookedCancelLockedByTime}
      />
    </YStack>
  );
}
