import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '@tamagui/sheet';
import { Button, Text, XStack, YStack } from 'tamagui';
import type { SlotDto } from '@generated/api';
import { useQueryClient } from '@tanstack/react-query';
import { t } from '@i18n';
import { formatTimeRangeRu } from '@utils/datetime';
import { AppIcon } from '@ui/AppIcon';
import { Avatar, useAuthorizedImageSource } from '@ui/components';
import { WorkoutTypeChip } from '@app/components/workout/WorkoutTypeChip';
import { TrainerWorkoutTypePickerSheet } from '@app/screens/slot-details/ui/TrainerWorkoutTypePickerSheet';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { useToast } from '@ui/feedback/useToast';
import { presentApiError } from '@api/ApiErrorPresenter';
import {
  getSlotWorkoutType,
  getTrainerWorkoutTypes,
  setTrainerBookingWorkoutType,
  type WorkoutTypeSummary,
} from '@api/workoutTypesApi';
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
  type UiSlotStatus,
} from './slotHelpers';
import type { PaymentMethod } from '@api/trainerSlotsApi';
import { SlotActionsBookedSection } from './SlotActionsBookedSection';

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
  onAssignAnotherClient?: (slot: SlotDto) => void;
  onMakeSlotOpen?: (slot: SlotDto) => void;
  isAssigningAnotherClient?: boolean;
  statusOverride?: UiSlotStatus;
};

const paymentMethods: PaymentMethod[] = ['Cash', 'Transfer', 'SBP', 'Other'];

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
  onAssignAnotherClient,
  onMakeSlotOpen,
  isAssigningAnotherClient,
  statusOverride,
}: SlotActionsSheetProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const statusType = slot ? (statusOverride ?? getUiSlotStatus(slot, nowTs)) : null;
  const statusMeta = statusType ? uiSlotStatusMeta[statusType] : null;
  const statusLabel = statusMeta ? t(statusMeta.labelKey) : null;
  const showStatusIcon = statusType === 'needs_attention';
  const times = slot ? getSlotTimes(slot) : null;
  const timeLabel = times ? formatTimeRangeRu(times.start, times.end) : '';
  const clientName = slot ? getClientName(slot) : null;
  const avatarUrl = slot ? getClientAvatarUrl(slot) : null;
  const avatarSource = useAuthorizedImageSource(avatarUrl);
  const [workoutTypePickerOpen, setWorkoutTypePickerOpen] = useState(false);
  const [selectedWorkoutType, setSelectedWorkoutType] = useState<WorkoutTypeSummary | null>(null);

  const canMarkAttendance = Boolean(
    slot?.id
    && showAttendanceActions
    && (statusType === 'booked' || statusType === 'needs_attention')
  );
  const canShowNoShow = Boolean(slot && canMarkAttendance && canMarkNoShow(slot, nowTs));
  const canShowComplete = Boolean(slot && canMarkAttendance && canMarkCompleted(slot, nowTs));
  const canCancelAvailable = Boolean(slot && canCancelSlot(slot, nowTs));
  const startTs = slot ? getSlotStartTimestamp(slot) : null;
  const canEditWorkoutType =
    !!slot
    && (slot.slotType ?? '').toLowerCase() !== 'group'
    && !!slot.bookingId
    && startTs !== null
    && nowTs <= startTs + 15 * 60 * 1000;
  const canCancelBooked = Boolean(
    slot && statusType !== 'needs_attention' && canCancelBookedSlot(slot, nowTs)
  );
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
  const showBookedCancelAction =
    statusType !== 'client_declined' && (canCancelBooked || showBookedCancelLockedByTime);
  const canAssignAnotherClient = Boolean(
    startTs !== null && nowTs < startTs - CANCEL_FORBIDDEN_WITHIN_MS
  );

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

  useEffect(() => {
    setSelectedWorkoutType(slot ? getSlotWorkoutType(slot) : null);
    setWorkoutTypePickerOpen(false);
  }, [slot]);

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

  const workoutTypesQuery = useAppQuery({
    queryKey: keys.trainerWorkoutTypes.list(false),
    enabled: open && !!slot?.bookingId && (slot?.slotType ?? '').toLowerCase() !== 'group',
    queryFn: ({ signal }) => getTrainerWorkoutTypes(false, { signal }),
  });

  const updateWorkoutTypeMutation = useAppMutation({
    mutationFn: (workoutTypeId: string | null) => {
      if (!slot?.bookingId) {
        throw new Error('Booking id is required');
      }
      return setTrainerBookingWorkoutType(slot.bookingId, workoutTypeId);
    },
    onSuccess: (payload) => {
      setSelectedWorkoutType(payload.workoutType ?? null);
      setWorkoutTypePickerOpen(false);
      queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
      queryClient.invalidateQueries({ queryKey: keys.bookings.upcoming() });
      queryClient.invalidateQueries({ queryKey: keys.bookings.history() });
    },
    onError: (error) => {
      const presented = presentApiError(error);
      showToast({ type: 'error', title: presented.title, message: presented.message });
    },
  });

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      dismissOnSnapToBottom
      snapPointsMode='fit'
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

            <SlotActionsBookedSection
              slot={slot}
              statusType={statusType}
              canUseCloseForm={canUseCloseForm}
              canShowComplete={canShowComplete}
              canShowNoShow={canShowNoShow}
              showNoShowLockedHint={showNoShowLockedHint}
              noShowMinutesLeft={noShowMinutesLeft}
              selectedAttendance={selectedAttendance}
              setSelectedAttendance={setSelectedAttendance}
              markPaid={markPaid}
              setMarkPaid={setMarkPaid}
              isNoShowSelected={isNoShowSelected}
              selectedMethod={selectedMethod}
              setSelectedMethod={setSelectedMethod}
              paymentMethods={paymentMethods}
              canMarkAttendance={canMarkAttendance}
              isFinalAttendance={isFinalAttendance}
              isBeforeStart={isBeforeStart}
              canSaveClose={canSaveClose}
              isActionPending={Boolean(isActionPending)}
              isClosingBooking={isClosingBooking}
              onCloseBooking={onCloseBooking}
              onMarkCompleted={onMarkCompleted}
              onMarkNoShow={onMarkNoShow}
              isMarkingCompleted={isMarkingCompleted}
              isMarkingNoShow={isMarkingNoShow}
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

            {!!slot.bookingId && (slot.slotType ?? '').toLowerCase() !== 'group' ? (
              <YStack
                gap="$2"
                padding="$3"
                borderRadius="$4"
                borderWidth={1}
                borderColor="$border"
                backgroundColor="$background"
              >
                <XStack justifyContent="space-between" alignItems="center" gap="$3">
                  <YStack flex={1} minWidth={0}>
                    <Text fontSize="$3" color="$muted">
                      Тип тренировки
                    </Text>
                    <Text fontSize="$3" color="$text" numberOfLines={1}>
                      {selectedWorkoutType?.name ?? 'Не выбран'}
                    </Text>
                  </YStack>
                  <Button
                    unstyled
                    onPress={() => setWorkoutTypePickerOpen(true)}
                    disabled={!canEditWorkoutType || updateWorkoutTypeMutation.isPending}
                  >
                    <Text color={canEditWorkoutType ? '$accent' : '$muted'}>
                      {canEditWorkoutType ? 'Изменить' : 'Недоступно'}
                    </Text>
                  </Button>
                </XStack>
                <WorkoutTypeChip
                  label={selectedWorkoutType?.name}
                  archived={Boolean(selectedWorkoutType?.isArchived)}
                  compact
                />
                {!canEditWorkoutType ? (
                  <Text fontSize="$2" color="$muted">
                    Можно изменить до начала и 15 минут после
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
      <TrainerWorkoutTypePickerSheet
        open={workoutTypePickerOpen}
        onOpenChange={setWorkoutTypePickerOpen}
        items={workoutTypesQuery.data ?? []}
        current={selectedWorkoutType}
        isLoading={workoutTypesQuery.isLoading}
        submitting={updateWorkoutTypeMutation.isPending}
        onSelect={(workoutTypeId) => {
          if (!slot?.bookingId || updateWorkoutTypeMutation.isPending) {
            return;
          }
          updateWorkoutTypeMutation.mutate(workoutTypeId);
        }}
      />
    </Sheet>
  );
}
