import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { JSX, useCallback, useEffect, useState } from 'react';
import { Button, ScrollView, Text, YStack } from 'tamagui';
import { apiClient } from '../../api/client';
import { getProblemDetailsMessage } from '../../api/problem-details';
import type { SlotDto } from '../../generated/api';
import { formatUtcRange } from '../../utils/time';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TrainerSlots'>;

export function TrainerSlotsScreen({ route, navigation }: Props) {
  const { trainerId, trainerName } = route.params;
  const [slots, setSlots] = useState<SlotDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSlots = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.getTrainerSlots(trainerId);
      if (response.status !== 200) {
        setError(
          getProblemDetailsMessage(
            response.data,
            'Unable to load trainer slots.'
          )
        );
        setSlots([]);
        return;
      }
      setSlots(response.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [trainerId]);

  useEffect(() => {
    loadSlots();
    const unsubscribe = navigation.addListener('focus', loadSlots);
    return unsubscribe;
  }, [loadSlots, navigation]);

  let content: JSX.Element;
  if (isLoading) {
    content = (
      <Text fontSize="$4" color="$muted">
        Loading slots...
      </Text>
    );
  } else if (error) {
    content = (
      <YStack gap="$3" alignItems="center">
        <Text fontSize="$4" color="$text" textAlign="center">
          {error}
        </Text>
        <Button
          size="$3"
          backgroundColor="$primary"
          color="$primaryText"
          onPress={loadSlots}
        >
          Retry
        </Button>
      </YStack>
    );
  } else if (slots.length === 0) {
    content = (
      <Text fontSize="$4" color="$muted">
        No slots created yet.
      </Text>
    );
  } else {
    content = (
      <ScrollView flex={1} width="100%">
        <YStack gap="$3" width="100%">
          {slots.map((slot) => {
            const range = formatUtcRange(
              slot.startsAtUtc,
              slot.durationMinutes
            );
            return (
              <YStack
                key={slot.id}
                padding="$4"
                borderWidth={1}
                borderColor="$border"
                borderRadius="$3"
                gap="$2"
              >
                <Text fontSize="$4" fontWeight="600" color="$text">
                  {range.start} - {range.end}
                </Text>
                <Text fontSize="$3" color="$muted">
                  Duration: {slot.durationMinutes} min
                </Text>
                <Text fontSize="$3" color="$muted">
                  Status: {slot.status}
                </Text>
              </YStack>
            );
          })}
        </YStack>
      </ScrollView>
    );
  }

  return (
    <YStack flex={1} padding="$6" gap="$4" backgroundColor="$background">
      <YStack gap="$1">
        <Text fontSize="$7" fontWeight="700" color="$text">
          {trainerName}
        </Text>
        <Text fontSize="$3" color="$muted">
          Your slots (local time)
        </Text>
      </YStack>
      <Button
        size="$4"
        backgroundColor="$primary"
        color="$primaryText"
        onPress={() =>
          navigation.navigate('CreateSlot', { trainerId, trainerName })
        }
      >
        Create slot
      </Button>
      {content}
    </YStack>
  );
}
