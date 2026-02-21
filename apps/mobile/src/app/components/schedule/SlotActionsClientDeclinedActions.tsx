import { Button, Text, XStack, YStack } from 'tamagui';
import type { SlotDto } from '@generated/api';
import { t } from '@i18n';
import { AppIcon } from '@ui/AppIcon';

type SlotActionsClientDeclinedActionsProps = {
  slot: SlotDto;
  statusType: 'booked' | 'needs_attention' | 'pending_confirmation' | 'client_declined';
  isActionPending: boolean;
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

export function SlotActionsClientDeclinedActions({
  slot,
  statusType,
  isActionPending,
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
}: SlotActionsClientDeclinedActionsProps) {
  return (
    <>
      {statusType === 'pending_confirmation' ? (
        <XStack
          padding="$4"
          borderRadius="$4"
          backgroundColor="$surfaceMuted"
          borderWidth={1}
          borderColor="$border"
        >
          <Text fontSize="$3" color="$muted">
            {t('schedule.sheet.pendingInfo')}
          </Text>
        </XStack>
      ) : null}
      {statusType === 'client_declined' ? (
        <YStack gap="$2">
          <Button
            unstyled
            onPress={() => {
              if (onAssignAnotherClient) {
                onAssignAnotherClient(slot);
              }
            }}
            disabled={isActionPending || !canAssignAnotherClient}
          >
            <XStack
              minHeight="$10"
              borderRadius="$4"
              backgroundColor="$accent"
              alignItems="center"
              justifyContent="center"
            >
              <Text color="$accentText" fontWeight="600">
                {isAssigningAnotherClient
                  ? t('common.loading')
                  : t('schedule.actions.assignAnotherClient')}
              </Text>
            </XStack>
          </Button>
          {!canAssignAnotherClient ? (
            <Text fontSize="$2" color="$muted">
              {t('schedule.sheet.assignAnotherUnavailable')}
            </Text>
          ) : null}
          <Button
            unstyled
            onPress={() => onMakeSlotOpen?.(slot)}
            disabled={isActionPending}
          >
            <XStack
              minHeight="$10"
              borderRadius="$4"
              borderWidth={1}
              borderColor="$border"
              backgroundColor="$background"
              alignItems="center"
              justifyContent="center"
            >
              <Text color="$text" fontWeight="600">{t('schedule.actions.makeSlotOpen')}</Text>
            </XStack>
          </Button>
          {canCancelAvailable && onCancelSlot ? (
            <Button
              unstyled
              onPress={() => onCancelSlot(slot)}
              disabled={isActionPending}
            >
              <XStack
                minHeight="$10"
                borderRadius="$4"
                borderWidth={1}
                borderColor="$primary"
                backgroundColor="$background"
                alignItems="center"
                justifyContent="center"
              >
                <Text color="$primary" fontWeight="600">
                  {isCancelling ? t('common.loading') : t('schedule.actions.cancelSlot')}
                </Text>
              </XStack>
            </Button>
          ) : null}
        </YStack>
      ) : null}
      {showBookedCancelAction ? (
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
    </>
  );
}

