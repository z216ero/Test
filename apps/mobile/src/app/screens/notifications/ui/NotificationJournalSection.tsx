import { ScrollView } from '@tamagui/scroll-view';
import { Button, Text, XStack, YStack } from 'tamagui';
import type { NotificationEvent } from '@shared/notifications/eventStore';
import { t } from '@i18n';
import { AppIcon } from '@ui/AppIcon';

type NotificationJournalSectionProps = {
  events: NotificationEvent[];
  onClearEvents: () => void;
  onPressEvent: (eventId: string) => void;
  formatEventTime: (iso: string) => string;
};

export function NotificationJournalSection({
  events,
  onClearEvents,
  onPressEvent,
  formatEventTime,
}: NotificationJournalSectionProps) {
  return (
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
          onPress={onClearEvents}
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
                  onPress={() => onPressEvent(event.id)}
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
  );
}

