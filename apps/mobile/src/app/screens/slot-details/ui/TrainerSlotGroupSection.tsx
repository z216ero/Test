import { Button, Text, XStack, YStack } from 'tamagui';
import type { SlotAttendeeDto } from '@generated/api';
import { t } from '@i18n';
import { TrainerAvatar } from '@app/components/bookings/TrainerAvatar';

type TrainerSlotGroupSectionProps = {
  attendees: SlotAttendeeDto[];
  isLoading: boolean;
  canCompleteNow: boolean;
  canNoShowNow: boolean;
  canMutateAttendee: boolean;
  onCompleteAttendee: (clientId: string) => void;
  onNoShowAttendee: (clientId: string) => void;
  canCancelGroupSlot: boolean;
  onCancelGroupSlot: () => void;
  isCancelling: boolean;
};

const normalize = (value?: string | null) => value?.toLowerCase().trim();
const isBookedAttendee = (attendee: SlotAttendeeDto) => normalize(attendee.status) === 'booked';

const getStatusLabel = (status?: string | null) => {
  if (!status) {
    return t('common.empty');
  }

  switch (status.toLowerCase()) {
    case 'open':
    case 'available':
      return t('status.open');
    case 'booked':
      return t('status.booked');
    case 'cancelled':
      return t('status.cancelled');
    case 'completed':
      return t('status.completed');
    case 'noshow':
    case 'no_show':
    case 'no-show':
      return t('status.noShow');
    default:
      return status;
  }
};

export function TrainerSlotGroupSection({
  attendees,
  isLoading,
  canCompleteNow,
  canNoShowNow,
  canMutateAttendee,
  onCompleteAttendee,
  onNoShowAttendee,
  canCancelGroupSlot,
  onCancelGroupSlot,
  isCancelling,
}: TrainerSlotGroupSectionProps) {
  return (
    <YStack gap="$3">
      <Text fontSize="$4" fontWeight="700" color="$text">
        {t('slotDetails.participantsTitle')}
      </Text>
      {isLoading ? (
        <Text fontSize="$3" color="$muted">{t('common.loading')}</Text>
      ) : null}
      {attendees.map((attendee) => {
        const attendeeStatus = getStatusLabel(attendee.status);
        const showActions = isBookedAttendee(attendee);
        const canShowCompleteAction = showActions && canCompleteNow;
        const canShowNoShowAction = showActions && canNoShowNow;
        return (
          <YStack
            key={attendee.clientId ?? `attendee-${attendee.clientName}`}
            padding="$3"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$4"
            gap="$2"
            backgroundColor="$background"
          >
            <XStack justifyContent="space-between" alignItems="center">
              <XStack alignItems="center" gap="$3" flex={1}>
                <TrainerAvatar
                  name={attendee.clientName}
                  avatarUrl={attendee.clientAvatarUrl}
                  size="$8"
                />
                <Text fontSize="$4" color="$text" flex={1}>
                  {attendee.clientName ?? t('common.empty')}
                </Text>
              </XStack>
              <Text fontSize="$3" color="$muted">
                {attendeeStatus}
              </Text>
            </XStack>
            {canShowCompleteAction || canShowNoShowAction ? (
              <XStack gap="$2">
                {canShowCompleteAction ? (
                  <Button
                    flex={1}
                    backgroundColor="$accent"
                    color="$accentText"
                    borderRadius="$4"
                    minHeight="$9"
                    onPress={() => attendee.clientId && onCompleteAttendee(attendee.clientId)}
                    disabled={!canMutateAttendee}
                  >
                    {t('slotDetails.markCompleted')}
                  </Button>
                ) : null}
                {canShowNoShowAction ? (
                  <Button
                    flex={1}
                    backgroundColor="$background"
                    borderRadius="$4"
                    borderWidth={1}
                    borderColor="$danger"
                    minHeight="$9"
                    onPress={() => attendee.clientId && onNoShowAttendee(attendee.clientId)}
                    disabled={!canMutateAttendee}
                  >
                    <Text color="$danger">{t('slotDetails.markNoShow')}</Text>
                  </Button>
                ) : null}
              </XStack>
            ) : null}
          </YStack>
        );
      })}
      {canCancelGroupSlot ? (
        <Button
          backgroundColor="$background"
          borderRadius="$4"
          borderWidth={1}
          borderColor="$primary"
          minHeight="$9"
          paddingHorizontal="$4"
          onPress={onCancelGroupSlot}
          disabled={isCancelling}
        >
          <Text color="$primary">
            {isCancelling
              ? t('common.loading')
              : t('schedule.actions.cancelSlot')}
          </Text>
        </Button>
      ) : null}
    </YStack>
  );
}

