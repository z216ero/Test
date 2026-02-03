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
  InAppEvent,
  listEvents,
} from '@notifications/inAppLog';
import { onSettingsChanged } from '@notifications/orchestrator';
import { formatDateRu, formatTimeRangeRu } from '@utils/datetime';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Notifications'>;

const formatEventTime = (iso: string): string => {
  const dateLabel = formatDateRu(iso);
  const timeLabel = formatTimeRangeRu(iso, iso);
  if (!dateLabel && !timeLabel) {
    return '';
  }
  return `${dateLabel} ${timeLabel}`.trim();
};

export function NotificationsScreen({ navigation }: Props) {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [events, setEvents] = useState<InAppEvent[]>([]);
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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
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
  };

  const handleClearEvents = async () => {
    await clearEvents();
    setEvents([]);
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
              height="170"
            >
              <ScrollView>
                <YStack gap="$3">
                  {events.length === 0 ? (
                    <Text fontSize="$3" color="$muted">
                      {t('notifications.journal.empty')}
                    </Text>
                  ) : (
                    events.map((event) => (
                      <XStack key={event.id} gap="$3" alignItems="flex-start">
                        <AppIcon
                          name={event.type === 'BOOKED' ? 'calendar' : 'alertCircle'}
                          size={18}
                          color="$muted"
                        />
                        <YStack flex={1} gap="$1">
                          <Text fontSize="$3" color="$text">
                            {event.message}
                          </Text>
                          <Text fontSize="$2" color="$muted">
                            {formatEventTime(event.occurredAtUtcIso)}
                          </Text>
                        </YStack>
                      </XStack>
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



