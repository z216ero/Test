import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { JSX, useCallback, useEffect, useState } from 'react';
import { Button, Text, YStack } from 'tamagui';
import { apiClient } from '../../api/client';
import { getProblemDetailsMessage } from '../../api/problem-details';
import type { TrainerDto } from '../../generated/api';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Trainers'>;

export function TrainersScreen({ route, navigation }: Props) {
  const { mode, clientId } = route.params;
  const [trainers, setTrainers] = useState<TrainerDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTrainers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.getTrainers();
      if (response.status !== 200) {
        setError(
          getProblemDetailsMessage(
            response.data,
            'Unable to load trainers.'
          )
        );
        setTrainers([]);
        return;
      }
      setTrainers(response.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrainers();
  }, [loadTrainers]);

  const actionLabel = mode === 'trainer' ? 'Manage slots' : 'View slots';
  const canNavigate = mode === 'trainer' || !!clientId?.trim();

  let content: JSX.Element;

  if (isLoading) {
    content = (
      <Text fontSize="$4" color="$muted">
        Loading trainers...
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
          onPress={loadTrainers}
        >
          Retry
        </Button>
      </YStack>
    );
  } else if (trainers.length === 0) {
    content = (
      <Text fontSize="$4" color="$muted">
        No trainers yet.
      </Text>
    );
  } else {
    content = (
      <YStack gap="$3" width="100%">
        {trainers.map((trainer) => (
          <YStack
            key={trainer.id}
            padding="$4"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$3"
            gap="$3"
          >
            <YStack gap="$1">
              <Text fontSize="$5" fontWeight="600" color="$text">
                {trainer.displayName}
              </Text>
              {trainer.gymName ? (
                <Text fontSize="$3" color="$muted">
                  Gym: {trainer.gymName}
                </Text>
              ) : null}
            </YStack>
            <Button
              size="$3"
              backgroundColor="$primary"
              color="$primaryText"
              onPress={() => {
                if (mode === 'trainer') {
                  navigation.navigate('TrainerSlots', {
                    trainerId: trainer.id,
                    trainerName: trainer.displayName,
                  });
                } else {
                  navigation.navigate('AvailableSlots', {
                    trainerId: trainer.id,
                    trainerName: trainer.displayName,
                    clientId: clientId?.trim() ?? '',
                  });
                }
              }}
              disabled={!canNavigate}
            >
              {actionLabel}
            </Button>
          </YStack>
        ))}
      </YStack>
    );
  }

  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$4"
      padding="$6"
      backgroundColor="$background"
    >
      <YStack gap="$1" alignItems="center">
        <Text fontSize="$8" fontWeight="700" color="$text">
          Trainers
        </Text>
        <Text fontSize="$3" color="$muted">
          Mode: {mode === 'trainer' ? 'Trainer' : 'Client'}
        </Text>
      </YStack>
      {mode === 'client' && !clientId ? (
        <Text fontSize="$3" color="$primary">
          Client ID is required to book slots.
        </Text>
      ) : null}
      {content}
    </YStack>
  );
}
