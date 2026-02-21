import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import { ScrollView } from '@tamagui/scroll-view';
import { Button, Switch, Text, XStack, YStack } from 'tamagui';
import { AppIcon } from '@ui/AppIcon';
import { t } from '@i18n';
import type { ProfileStackParamList } from '@app/navigation/types';
import { useFocusEffect } from '@react-navigation/native';
import { getMe } from '@api/homeApi';
import { useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import {
  getNotificationSettings,
  NotificationSettings,
  setNotificationSettings,
} from '@notifications/settings';
import {
  clearEvents,
  listEvents,
  markAllEventsRead,
  markEventRead,
  type NotificationEvent,
} from '@shared/notifications/eventStore';
import { onSettingsChanged } from '@notifications/orchestrator';
import { updatePushPreferences } from '@api/pushApi';
import { formatDateRu, formatTimeRangeRu } from '@utils/datetime';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Notifications'>;

const isSameLocalDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate();

const formatEventTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const dateLabel = isSameLocalDay(date, now) ? 'сегодня' : formatDateRu(date);
  const timeLabel = formatTimeRangeRu(date, date);
  if (!dateLabel && !timeLabel) {
    return '';
  }
  return `${dateLabel} ${timeLabel}`.trim();
};

export function NotificationsScreen({ navigation }: Props) {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const meQuery = useAppQuery({
    queryKey: keys.auth.me(),
    queryFn: ({ signal }) => getMe({ signal }),
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [nextSettings, nextEvents] = await Promise.all([
      getNotificationSettings(),
      listEvents(),
    ]);
    setSettings(nextSettings);
    setEvents(nextEvents);
    setLoading(false);
    return nextEvents;
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const run = async () => {
        const nextEvents = await load();
        if (!active) {
          return;
        }
        if (nextEvents.some((event) => !event.isRead)) {
          const updated = await markAllEventsRead();
          if (active) {
            setEvents(updated);
          }
        }
      };

      run();

      return () => {
        active = false;
      };
    }, [load])
  );

  const updateSettings = async (partial: Partial<NotificationSettings>) => {
    const prev = settings ?? (await getNotificationSettings());
    const next = await setNotificationSettings(partial);
    setSettings(next);
    try {
      await onSettingsChanged(prev, next);
    } catch (err) {
      if (__DEV__) {
        console.warn('notifications: reschedule failed', err);
      }
    }

    const shouldSyncPushPreferences =
      typeof partial.inAppBookingEventsEnabled === 'boolean'
      || typeof partial.inAppGroupMinCancellationEventsEnabled === 'boolean'
      || typeof partial.linkRequestPushEnabled === 'boolean'
      || typeof partial.linkResponsePushEnabled === 'boolean'
      || typeof partial.enabled === 'boolean'
      || typeof partial.reminderOffsetMinutes === 'number';

    if (shouldSyncPushPreferences) {
      try {
        await updatePushPreferences({
          eventsEnabled: next.inAppBookingEventsEnabled,
          groupMinCancellationEnabled: next.inAppGroupMinCancellationEventsEnabled,
          reminderEnabled: next.enabled,
          trainerLinkRequestsEnabled: next.linkRequestPushEnabled,
          clientLinkResponsesEnabled: next.linkResponsePushEnabled,
          reminderOffsetMinutes: next.reminderOffsetMinutes,
        });
      } catch (err) {
        if (__DEV__) {
          console.warn('notifications: push preferences sync failed', err);
        }
      }
    }
  };

  const handleClearEvents = async () => {
    await clearEvents();
    setEvents([]);
  };

  const handleEventPress = async (eventId: string) => {
    const updated = await markEventRead(eventId);
    setEvents(updated);
  };

  const offsetOptions = useMemo(
    () => [
      { label: t('notifications.reminder.offset2h'), value: 120 },
      { label: t('notifications.reminder.offset24h'), value: 1440 },
    ],
    []
  );

  const resolvedSettings = settings ?? {
    enabled: true,
    reminderOffsetMinutes: 120,
    inAppBookingEventsEnabled: true,
    inAppGroupMinCancellationEventsEnabled: true,
    linkRequestPushEnabled: true,
    linkResponsePushEnabled: true,
  };

  const role = meQuery.data?.role === 'Trainer' ? 'Trainer' : 'Client';
  const showReminderSection = role !== 'Trainer';

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <ScrollView>
        <YStack padding="$6" gap="$5">
          <XStack alignItems="center" gap="$3">
            <Button
              backgroundColor="$background"
              borderRadius="$4"
              borderWidth={1}
              borderColor="$border"
              padding="$3"
              onPress={() => navigation.goBack()}
            >
              <AppIcon name="chevronLeft" size={18} color="$text" />
            </Button>
            <Text fontSize="$8" fontWeight="700" color="$text">
              {t('notifications.title')}
            </Text>
          </XStack>

          {showReminderSection ? (
            <YStack gap="$3">
              <Text fontSize="$5" fontWeight="700" color="$text">
                {t('notifications.reminder.title')}
              </Text>
              <YStack
                backgroundColor="$background"
                borderRadius="$5"
                borderWidth={1}
                borderColor="$border"
                padding="$4"
                gap="$3"
              >
                <XStack alignItems="center" justifyContent="space-between">
                  <Text fontSize="$3" color="$text">
                    {t('notifications.reminder.toggle')}
                  </Text>
                  <Switch
                    size="$7"
                    checked={resolvedSettings.enabled}
                    onCheckedChange={(value) =>
                      updateSettings({ enabled: Boolean(value) })
                    }
                    disabled={loading}
                    backgroundColor={
                      resolvedSettings.enabled ? '$accent' : '$surfaceMuted'
                    }
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
                {resolvedSettings.enabled ? (
                  <XStack gap="$2">
                    {offsetOptions.map((option) => {
                      const active =
                        resolvedSettings.reminderOffsetMinutes === option.value;
                      return (
                        <Button
                          key={option.value}
                          backgroundColor={active ? '$accent' : '$background'}
                          borderRadius="$4"
                          borderWidth={1}
                          borderColor="$border"
                          paddingHorizontal="$3"
                          paddingVertical="$2"
                          height={40}
                          onPress={() =>
                            updateSettings({
                              reminderOffsetMinutes: option.value,
                            })
                          }
                        >
                          <Text
                            color={active ? '$accentText' : '$text'}
                            fontSize="$3"
                          >
                            {option.label}
                          </Text>
                        </Button>
                      );
                    })}
                  </XStack>
                ) : null}
                <Text fontSize="$3" color="$muted">
                  {t('notifications.reminder.caption')}
                </Text>
              </YStack>
            </YStack>
          ) : null}

          <YStack gap="$3">
            <Text fontSize="$5" fontWeight="700" color="$text">
              {t('notifications.inApp.title')}
            </Text>
            <YStack
              backgroundColor="$background"
              borderRadius="$5"
              borderWidth={1}
              borderColor="$border"
              padding="$4"
              gap="$3"
            >
              <XStack alignItems="center" justifyContent="space-between">
                <Text fontSize="$3" color="$text">
                  {role === 'Trainer'
                    ? t('notifications.inApp.toggleTrainer')
                    : t('notifications.inApp.toggle')}
                </Text>
                <Switch
                  size="$7"
                  checked={resolvedSettings.inAppBookingEventsEnabled}
                  onCheckedChange={(value) =>
                    updateSettings({ inAppBookingEventsEnabled: Boolean(value) })
                  }
                  disabled={loading}
                  backgroundColor={
                    resolvedSettings.inAppBookingEventsEnabled
                      ? '$accent'
                      : '$surfaceMuted'
                  }
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
              {role === 'Client' ? (
                <XStack alignItems="center" justifyContent="space-between">
                  <YStack flex={1} gap="$1">
                    <Text fontSize="$3" color="$text">
                      {t('notifications.inApp.groupMinCancelToggle')}
                    </Text>
                    <Text fontSize="$2" color="$muted">
                      {t('notifications.inApp.groupMinCancelHint')}
                    </Text>
                  </YStack>
                  <Switch
                    size="$7"
                    checked={resolvedSettings.inAppGroupMinCancellationEventsEnabled}
                    onCheckedChange={(value) =>
                      updateSettings({
                        inAppGroupMinCancellationEventsEnabled: Boolean(value),
                      })
                    }
                    disabled={loading || !resolvedSettings.inAppBookingEventsEnabled}
                    backgroundColor={
                      resolvedSettings.inAppGroupMinCancellationEventsEnabled
                        ? '$accent'
                        : '$surfaceMuted'
                    }
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
              ) : null}
            </YStack>
          </YStack>

          <YStack gap="$3">
            <Text fontSize="$5" fontWeight="700" color="$text">
              {t('notifications.links.title')}
            </Text>
            <YStack
              backgroundColor="$background"
              borderRadius="$5"
              borderWidth={1}
              borderColor="$border"
              padding="$4"
              gap="$3"
            >
              {role === 'Client' ? (
                <XStack alignItems="center" justifyContent="space-between">
                  <Text fontSize="$3" color="$text">
                    {t('notifications.links.clientRequests')}
                  </Text>
                  <Switch
                    size="$7"
                    checked={resolvedSettings.linkRequestPushEnabled}
                    onCheckedChange={(value) =>
                      updateSettings({ linkRequestPushEnabled: Boolean(value) })
                    }
                    disabled={loading}
                    backgroundColor={
                      resolvedSettings.linkRequestPushEnabled
                        ? '$accent'
                        : '$surfaceMuted'
                    }
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
              ) : null}
              {role === 'Trainer' ? (
                <XStack alignItems="center" justifyContent="space-between">
                  <Text fontSize="$3" color="$text">
                    {t('notifications.links.trainerResponses')}
                  </Text>
                  <Switch
                    size="$7"
                    checked={resolvedSettings.linkResponsePushEnabled}
                    onCheckedChange={(value) =>
                      updateSettings({ linkResponsePushEnabled: Boolean(value) })
                    }
                    disabled={loading}
                    backgroundColor={
                      resolvedSettings.linkResponsePushEnabled
                        ? '$accent'
                        : '$surfaceMuted'
                    }
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
              ) : null}
            </YStack>
          </YStack>

          <YStack gap="$3">
            <Text fontSize="$5" fontWeight="700" color="$text">
              {t('notifications.system.title')}
            </Text>
            <YStack
              backgroundColor="$background"
              borderRadius="$5"
              borderWidth={1}
              borderColor="$border"
              padding="$4"
              gap="$3"
            >
              <XStack alignItems="center" gap="$3">
                <AppIcon name="settings" size={18} color="$muted" />
                <Text fontSize="$3" color="$text" flex={1}>
                  {t('notifications.system.permissions')}
                </Text>
                <AppIcon name="chevronRight" size={18} color="$muted" />
              </XStack>
              <Button
                backgroundColor="$background"
                borderRadius="$4"
                borderWidth={1}
                borderColor="$border"
                paddingHorizontal="$3"
                paddingVertical="$2"
                onPress={() => Linking.openSettings()}
                height="$9"
              >
                <Text fontSize="$3" color="$text">
                  {t('notifications.system.openSettings')}
                </Text>
              </Button>
            </YStack>
          </YStack>

          <YStack gap="$3">
            <XStack alignItems="center" justifyContent="space-between">
              <Text fontSize="$5" fontWeight="700" color="$text">
                {t('notifications.journal.title')}
              </Text>
              <Button
                backgroundColor="$background"
                borderRadius="$4"
                borderWidth={1}
                borderColor="$border"
                paddingHorizontal="$3"
                paddingVertical="$2"
                onPress={handleClearEvents}
                disabled={events.length === 0}
                height="$9"
              >
                <Text fontSize="$3" color="$text">
                  {t('notifications.journal.clear')}
                </Text>
              </Button>
            </XStack>
            <YStack
              backgroundColor="$background"
              borderRadius="$5"
              borderWidth={1}
              borderColor="$border"
              padding="$4"
              height="300"
            >
              <ScrollView>
                <YStack gap="$3">
                  {events.length === 0 ? (
                    <Text fontSize="$3" color="$muted">
                      {t('notifications.journal.empty')}
                    </Text>
                  ) : (
                    events.map((event) => (
                      <Button
                        key={event.id}
                        unstyled
                        onPress={() => handleEventPress(event.id)}
                      >
                        <XStack gap="$3" alignItems="flex-start">
                          <AppIcon
                            name="calendar"
                            size={18}
                            color="$muted"
                          />
                          <YStack flex={1} gap="$1">
                            <XStack alignItems="center" gap="$2">
                              {event.isRead ? null : (
                                <YStack
                                  width="$1"
                                  height="$1"
                                  borderRadius="$6"
                                  backgroundColor="$accent"
                                  marginTop="$1"
                                />
                              )}
                              <Text fontSize="$3" fontWeight="700" color="$text">
                                {event.title}
                              </Text>
                            </XStack>
                            <Text fontSize="$3" color="$text" numberOfLines={2}>
                              {event.description}
                            </Text>
                            <Text fontSize="$2" color="$muted">
                              {formatEventTime(event.occurredAtUtc)}
                            </Text>
                          </YStack>
                        </XStack>
                      </Button>
                    ))
                  )}
                </YStack>
              </ScrollView>
            </YStack>
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  );
}



