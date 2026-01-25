import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Button, Text, YStack } from 'tamagui';
import { apiClient } from '../../api/client';
import { getProblemDetailsMessage } from '../../api/problem-details';
import { formatUtcRange } from '../../utils/time';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SlotDetails'>;

export function SlotDetailsScreen({ route, navigation }: Props) {
  const { trainerName, slot, clientId } = route.params;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const range = formatUtcRange(slot.startsAtUtc, slot.durationMinutes);

  const handleBook = async () => {
    const trimmedClientId = clientId.trim();
    if (!trimmedClientId) {
      setError('Client ID is required to book.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiClient.bookSlot(slot.id, {
        clientId: trimmedClientId,
      });
      if (response.status === 201) {
        setSuccess('Slot booked successfully.');
        return;
      }

      if (response.status === 409) {
        setError(
          getProblemDetailsMessage(response.data, 'Slot is already booked.')
        );
        return;
      }

      setError(
        getProblemDetailsMessage(
          response.data,
          'Unable to book this slot right now.'
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <YStack flex={1} padding="$6" gap="$4" backgroundColor="$background">
      <YStack gap="$1">
        <Text fontSize="$7" fontWeight="700" color="$text">
          {trainerName}
        </Text>
        <Text fontSize="$3" color="$muted">
          Slot details (local time)
        </Text>
      </YStack>
      <YStack
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
      {error ? (
        <Text fontSize="$3" color="$primary">
          {error}
        </Text>
      ) : null}
      {success ? (
        <Text fontSize="$3" color="$text">
          {success}
        </Text>
      ) : null}
      <Button
        size="$4"
        backgroundColor="$primary"
        color="$primaryText"
        onPress={handleBook}
        disabled={isSubmitting || !!success}
      >
        {isSubmitting ? 'Booking...' : 'Book slot'}
      </Button>
      <Button size="$3" onPress={() => navigation.goBack()}>
        Back to list
      </Button>
    </YStack>
  );
}
