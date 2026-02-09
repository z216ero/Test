import { t } from '@i18n';
import { formatDateRu, formatTimeRangeRu } from '@utils/datetime';
import { appendEvent } from './inAppLog';
import {
  getNotificationSettings,
  NotificationSettings,
} from './settings';

type BookingPayload = {
  bookingId: string;
  startAtUtcIso: string;
  title?: string;
};

const buildTimeLabel = (startAtUtcIso: string): string => {
  const dateLabel = formatDateRu(startAtUtcIso);
  const timeLabel = formatTimeRangeRu(startAtUtcIso, startAtUtcIso);
  if (!dateLabel && !timeLabel) {
    return '';
  }
  return `${dateLabel} ${timeLabel}`.trim();
};

const safe = async (fn: () => Promise<void>) => {
  try {
    await fn();
  } catch (err) {
    if (__DEV__) {
      console.warn('notifications: operation failed', err);
    }
  }
};

export const onBookingCreated = async ({
  startAtUtcIso,
}: BookingPayload): Promise<void> => {
  const settings = await getNotificationSettings();
  const timeLabel = buildTimeLabel(startAtUtcIso);

  if (settings.inAppBookingEventsEnabled) {
    await safe(() =>
      appendEvent({
        type: 'BOOKED',
        message: `${t('notifications.event.booked')}${timeLabel ? ` - ${timeLabel}` : ''}`,
      })
    );
  }
};

export const onBookingCancelled = async ({
  startAtUtcIso,
}: {
  bookingId: string;
  startAtUtcIso?: string;
}): Promise<void> => {
  const settings = await getNotificationSettings();
  const timeLabel = startAtUtcIso ? buildTimeLabel(startAtUtcIso) : '';

  if (settings.inAppBookingEventsEnabled) {
    await safe(() =>
      appendEvent({
        type: 'CANCELLED',
        message: `${t('notifications.event.cancelled')}${timeLabel ? ` - ${timeLabel}` : ''}`,
      })
    );
  }
};

export const onSettingsChanged = async (
  ..._args: [NotificationSettings, NotificationSettings]
): Promise<void> => {
};
