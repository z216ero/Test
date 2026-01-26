import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Button, Text, YStack } from 'tamagui';
import { apiClient } from '../../api/client';
import { getUiErrorMessage, unwrap } from '../../api/core';
import { primaryButtonProps, secondaryButtonProps } from '../../ui/formDefaults';
import { formatUtcRange } from '../../utils/time';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'SlotDetails'>;

export function SlotDetailsScreen({ route, navigation }: Props) {
  const { trainerName, slot, clientId } = route.params;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const range = formatUtcRange(
    slot.startsAtUtc ?? '',
    slot.durationMinutes ?? 0
  );

  const handleBook = async () => {
    const trimmedClientId = clientId.trim();
    if (!trimmedClientId) {
      setError('Client ID is required to book.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    if (!slot.id) {
      setError('Slot ID is missing.');
      return;
    }

    try {
      const response = await apiClient.postSlotsSlotIdBook(slot.id, {
        clientId: trimmedClientId,
      });
      unwrap(response, 'Unable to book this slot right now.');
      setSuccess('Slot booked successfully.');
    } catch (err) {
      setError(getUiErrorMessage(err));
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
          Duration: {slot.durationMinutes ?? 0} min
        </Text>
        <Text fontSize="$3" color="$muted">
          Status: {slot.status ?? 'Unknown'}
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
        {...primaryButtonProps}
      >
        {isSubmitting ? 'Booking...' : 'Book slot'}
      </Button>
      <Button size="$3" onPress={() => navigation.goBack()} {...secondaryButtonProps}>
        Back to list
      </Button>
    </YStack>
  );
}
