import { t } from '../i18n';
import { formatDateRu, formatTimeRangeRu } from '../utils/datetime';
import { appendEvent } from './inAppLog';
import {
  cancelTrainingReminder,
  getScheduledEntries,
  scheduleTrainingReminder,
} from './localReminder';
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
  bookingId,
  startAtUtcIso,
  title,
}: BookingPayload): Promise<void> => {
  const settings = await getNotificationSettings();
  const timeLabel = buildTimeLabel(startAtUtcIso);

  if (settings.inAppBookingEventsEnabled) {
    await safe(() =>
      appendEvent({
        type: 'BOOKED',
        message: `${t('notifications.event.booked')}${timeLabel ? ` • ${timeLabel}` : ''}`,
      })
    );
  }

  if (settings.enabled) {
    const start = new Date(startAtUtcIso);
    if (Number.isNaN(start.getTime())) {
      return;
    }

    const fireAt = new Date(
      start.getTime() - settings.reminderOffsetMinutes * 60 * 1000
    );
    if (fireAt.getTime() <= Date.now()) {
      return;
    }

    await safe(() =>
      scheduleTrainingReminder({
        bookingId,
        startAtUtcIso,
        fireAtUtcIso: fireAt.toISOString(),
        title: title ?? t('notifications.reminder.notificationTitle'),
        body: timeLabel
          ? t('notifications.reminder.notificationBodyWithTime', {
              time: timeLabel,
            })
          : t('notifications.reminder.notificationBody'),
      })
    );
  }
};

export const onBookingCancelled = async ({
  bookingId,
  startAtUtcIso,
}: {
  bookingId: string;
  startAtUtcIso?: string;
}): Promise<void> => {
  const settings = await getNotificationSettings();
  const timeLabel = startAtUtcIso ? buildTimeLabel(startAtUtcIso) : '';

  await safe(() => cancelTrainingReminder(bookingId));

  if (settings.inAppBookingEventsEnabled) {
    await safe(() =>
      appendEvent({
        type: 'CANCELLED',
        message: `${t('notifications.event.cancelled')}${timeLabel ? ` • ${timeLabel}` : ''}`,
      })
    );
  }
};

export const onSettingsChanged = async (
  prev: NotificationSettings,
  next: NotificationSettings
): Promise<void> => {
  const shouldReschedule =
    prev.enabled !== next.enabled ||
    prev.reminderOffsetMinutes !== next.reminderOffsetMinutes;

  if (!shouldReschedule) {
    return;
  }

  const entries = await getScheduledEntries();
  if (entries.length === 0) {
    return;
  }

  if (!next.enabled) {
    await Promise.all(
      entries.map((entry) => safe(() => cancelTrainingReminder(entry.bookingId)))
    );
    return;
  }

  await Promise.all(
    entries.map((entry) =>
      safe(async () => {
        const start = new Date(entry.startAtUtcIso);
        if (Number.isNaN(start.getTime())) {
          return;
        }
        const fireAt = new Date(
          start.getTime() - next.reminderOffsetMinutes * 60 * 1000
        );
        if (fireAt.getTime() <= Date.now()) {
          await cancelTrainingReminder(entry.bookingId);
          return;
        }
        await scheduleTrainingReminder({
          bookingId: entry.bookingId,
          startAtUtcIso: entry.startAtUtcIso,
          fireAtUtcIso: fireAt.toISOString(),
          title: entry.title,
          body: entry.body,
        });
      })
    )
  );
};
