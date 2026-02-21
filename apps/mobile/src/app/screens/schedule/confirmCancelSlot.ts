import { Alert } from 'react-native';
import type { SlotDto } from '@generated/api';
import { t } from '@i18n';
import {
  CANCEL_FORBIDDEN_WITHIN_MS,
  isAttendanceFinalStatus,
} from '@app/components/schedule/slotHelpers';

type ConfirmCancelSlotArgs = {
  slot: SlotDto;
  nowTs: number;
  isPending: boolean;
  onConfirm: (slotId: string) => void;
};

export const confirmCancelSlot = ({
  slot,
  nowTs,
  isPending,
  onConfirm,
}: ConfirmCancelSlotArgs) => {
  if (!slot.id || isPending) {
    return;
  }

  const startTs = slot.startsAtUtc ? new Date(slot.startsAtUtc).getTime() : null;
  const hasValidStart = startTs !== null && !Number.isNaN(startTs);
  const statusRaw = slot.status?.toLowerCase().trim();
  const isBooked = statusRaw === 'booked';
  const isFinalAttendance = isAttendanceFinalStatus(slot);
  const isWithinThirtyMinutes = hasValidStart && nowTs >= startTs - CANCEL_FORBIDDEN_WITHIN_MS;

  const title = isBooked
    ? isWithinThirtyMinutes
      ? t('schedule.actions.cancelTrainingConfirmSoonTitle')
      : t('schedule.actions.cancelTrainingConfirmTitle')
    : t('schedule.actions.cancelSlotConfirmTitle');
  const message = isBooked
    ? isWithinThirtyMinutes
      ? t('schedule.actions.cancelTrainingConfirmSoonMessage')
      : t('schedule.actions.cancelTrainingConfirmMessage')
    : t('schedule.actions.cancelSlotConfirmMessage');

  if (isBooked && isFinalAttendance) {
    return;
  }

  Alert.alert(
    title,
    message,
    [
      { text: t('profile.personal.cancel'), style: 'cancel' },
      {
        text: isBooked
          ? t('schedule.actions.cancelTrainingConfirm')
          : t('schedule.actions.cancelSlotConfirm'),
        style: 'destructive',
        onPress: () => onConfirm(slot.id as string),
      },
    ]
  );
};

