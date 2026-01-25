import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Button, Input, Text, YStack } from 'tamagui';
import { apiClient } from '../../api/client';
import { getProblemDetailsMessage } from '../../api/problem-details';
import { parseLocalDateTime } from '../../utils/time';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateSlot'>;

export function CreateSlotScreen({ route, navigation }: Props) {
  const { trainerId, trainerName } = route.params;
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    setError(null);
    setSuccess(null);

    const startDate = parseLocalDateTime(startInput);
    const endDate = parseLocalDateTime(endInput);

    if (!startDate || !endDate) {
      setError('Enter start and end in format YYYY-MM-DDTHH:mm.');
      return;
    }

    if (endDate <= startDate) {
      setError('End time must be later than start time.');
      return;
    }

    const durationMinutes = Math.round(
      (endDate.getTime() - startDate.getTime()) / 60000
    );

    if (durationMinutes <= 0) {
      setError('Duration must be greater than 0 minutes.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.createTrainerSlot(trainerId, {
        startsAtUtc: startDate.toISOString(),
        durationMinutes,
      });

      if (response.status === 201) {
        setSuccess('Slot created successfully.');
        return;
      }

      if (response.status === 409) {
        setError(
          getProblemDetailsMessage(
            response.data,
            'Slot overlaps with another slot.'
          )
        );
        return;
      }

      setError(
        getProblemDetailsMessage(
          response.data,
          'Unable to create slot right now.'
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
          Create slot (local time)
        </Text>
      </YStack>
      <YStack gap="$2">
        <Text fontSize="$3" color="$text">
          Start (YYYY-MM-DDTHH:mm)
        </Text>
        <Input
          value={startInput}
          onChangeText={setStartInput}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="2026-01-25T10:00"
        />
      </YStack>
      <YStack gap="$2">
        <Text fontSize="$3" color="$text">
          End (YYYY-MM-DDTHH:mm)
        </Text>
        <Input
          value={endInput}
          onChangeText={setEndInput}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="2026-01-25T11:00"
        />
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
        onPress={handleCreate}
        disabled={isSubmitting || !!success}
      >
        {isSubmitting ? 'Creating...' : 'Create slot'}
      </Button>
      <Button size="$3" onPress={() => navigation.goBack()}>
        Back to slots
      </Button>
    </YStack>
  );
}
