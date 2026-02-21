import { Button, Text, XStack, YStack } from 'tamagui';
import type { ClientBooking } from '@api/bookingsApi';
import { t } from '@i18n';
import { formatTimeRangeRu } from '@utils/datetime';
import { AppIcon } from '@ui/AppIcon';
import type { AvailableSlotTrainerDto } from '@generated/api';
import {
  bookingStatusMeta,
  type BookingStatusType,
  canCancelBooking,
  getBookingStatusType,
  getSlotTimes,
} from '@app/components/bookings/bookingUtils';
import { TrainerAvatar } from '@app/components/bookings/TrainerAvatar';

type BookingCardProps = {
  booking: ClientBooking;
  nowTs: number;
  showActions: boolean;
  isCancelling: boolean;
  isConfirming: boolean;
  isDeclining: boolean;
  onCancel?: (slotId: string) => void;
  onConfirm?: (bookingId: string) => void;
  onDecline?: (bookingId: string) => void;
  onOpenDetails: (booking: ClientBooking) => void;
};

const isPaidStatus = (value?: string | null) => (value ?? '').trim().toLowerCase() === 'paid';
const statusIndicatorRowWidth = 112;
const unpaidPaymentColor = '#F59E0B';
const compactStatusLabelMap: Partial<Record<BookingStatusType, 'bookings.statusPendingShort' | 'bookings.statusCancelledShort'>> = {
  pending_confirmation: 'bookings.statusPendingShort',
  cancelled: 'bookings.statusCancelledShort',
};

export function BookingCard({
  booking,
  nowTs,
  showActions,
  isCancelling,
  isConfirming,
  isDeclining,
  onCancel,
  onConfirm,
  onDecline,
  onOpenDetails,
}: BookingCardProps) {
  const trainingTypeCode = booking.slot.slotType ?? null;
  const isGroupTraining = trainingTypeCode === 'Group';
  const trainingTypeLabel = trainingTypeCode
    ? t(isGroupTraining ? 'bookings.trainingTypeGroup' : 'bookings.trainingTypeIndividual')
    : null;
  const trainingTypeIcon = isGroupTraining ? 'users' : 'user';
  const times = getSlotTimes(booking.slot);
  const timeLabel = times ? formatTimeRangeRu(times.start, times.end) : t('common.empty');
  const statusType = getBookingStatusType(booking.slot, nowTs);
  const statusMeta = bookingStatusMeta[statusType];
  const statusLabel = t(compactStatusLabelMap[statusType] ?? statusMeta.labelKey);
  const showPaymentStatus = statusType === 'completed';
  const isPendingConfirmation = statusType === 'pending_confirmation';
  const paid = isPaidStatus(booking.paymentStatus);
  const trainerProfile: AvailableSlotTrainerDto = {
    id: booking.slot.trainerId,
    name: booking.trainerName,
    phoneNumber: booking.trainerPhoneNumber,
    avatarUrl: booking.trainerAvatarUrl,
    worksWithGender: booking.trainerWorksWithGender,
    gender: booking.trainerGender,
    rating: booking.trainerRating,
    cityName: booking.trainerCityName,
    districtName: booking.trainerDistrictName,
    trainingTypes: booking.trainerTrainingTypes ?? null,
  };
  const canCancel = booking.slot.id ? canCancelBooking(booking.slot, nowTs) : false;

  return (
    <YStack
      gap="$3"
      padding="$4"
      backgroundColor="$background"
      borderRadius="$5"
      borderWidth={1}
      borderColor="$border"
    >
      <XStack justifyContent="space-between" alignItems="center" gap="$2">
        <Text fontSize="$4" fontWeight="700" color="$text">
          {timeLabel}
        </Text>
        <YStack alignItems="flex-end" gap="$1" minWidth={0}>
          <XStack width={statusIndicatorRowWidth} alignItems="center" gap="$2" minWidth={0}>
            <YStack
              width="$1"
              height="$1"
              borderRadius="$6"
              backgroundColor={statusMeta.color}
            />
            <Text
              fontSize="$2"
              color={statusMeta.color}
              numberOfLines={1}
              ellipsizeMode="tail"
              flexShrink={1}
            >
              {statusLabel}
            </Text>
          </XStack>
          {showPaymentStatus ? (
            <XStack width={statusIndicatorRowWidth} alignItems="center" gap="$2">
              <YStack
                width="$1"
                height="$1"
                borderRadius="$6"
                backgroundColor={paid ? '$accent' : unpaidPaymentColor}
              />
              <Text fontSize="$2" color={paid ? '$accent' : unpaidPaymentColor}>
                {paid ? t('bookings.payment.paid') : t('bookings.payment.unpaid')}
              </Text>
            </XStack>
          ) : null}
        </YStack>
      </XStack>
      <XStack alignItems="center" gap="$3">
        <TrainerAvatar
          name={booking.trainerName}
          avatarUrl={booking.trainerAvatarUrl}
          size="$9"
          trainerProfile={trainerProfile}
        />
        <YStack gap="$1" flex={1}>
          <Text fontSize="$4" fontWeight="700" color="$text">
            {booking.trainerName?.trim() || t('common.empty')}
          </Text>
          {trainingTypeLabel ? (
            <XStack alignItems="center" gap="$2">
              <AppIcon name={trainingTypeIcon} size={14} color="$muted" />
              <Text fontSize="$3" color="$muted">
                {trainingTypeLabel}
              </Text>
            </XStack>
          ) : null}
        </YStack>
      </XStack>
      {showActions ? (
        <XStack justifyContent="flex-end" gap="$2">
          {isPendingConfirmation && booking.slot.bookingId ? (
            <>
              <Button
                backgroundColor="$accent"
                color="$accentText"
                borderRadius="$4"
                minHeight="$9"
                paddingHorizontal="$4"
                onPress={() => onConfirm?.(booking.slot.bookingId as string)}
                disabled={isConfirming || isDeclining}
              >
                {isConfirming ? t('common.loading') : t('bookingConfirm.confirm')}
              </Button>
              <Button
                backgroundColor="$background"
                borderRadius="$4"
                borderWidth={1}
                borderColor="$danger"
                minHeight="$9"
                paddingHorizontal="$4"
                onPress={() => onDecline?.(booking.slot.bookingId as string)}
                disabled={isConfirming || isDeclining}
              >
                <Text color="$danger">
                  {isDeclining ? t('common.loading') : t('bookings.cancel')}
                </Text>
              </Button>
            </>
          ) : null}
          {canCancel ? (
            <Button
              backgroundColor="$background"
              borderRadius="$4"
              borderWidth={1}
              borderColor="$border"
              minHeight="$9"
              paddingHorizontal="$4"
              onPress={() => booking.slot.id && onCancel?.(booking.slot.id)}
              disabled={isCancelling}
            >
              <Text color="$danger">
                {isCancelling ? t('common.loading') : t('bookings.cancel')}
              </Text>
            </Button>
          ) : null}
          <Button
            backgroundColor="$background"
            borderRadius="$4"
            borderWidth={1}
            borderColor="$border"
            minHeight="$9"
            paddingHorizontal="$4"
            onPress={() => onOpenDetails(booking)}
          >
            <Text color="$text">{t('bookings.action.details')}</Text>
          </Button>
        </XStack>
      ) : null}
    </YStack>
  );
}
