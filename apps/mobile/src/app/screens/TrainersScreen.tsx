import { JSX, useEffect, useState } from 'react';
import { Text, YStack } from 'tamagui';
import { apiClient } from '../../api/client';
import type { TrainerDto } from '../../generated/api';

export function TrainersScreen() {
  const [trainers, setTrainers] = useState<TrainerDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadTrainers = async () => {
      try {
        const response = await apiClient.getTrainers();
        if (!isMounted) {
          return;
        }
        if (response.status !== 200) {
          throw new Error('Unexpected trainers response.');
        }
        setTrainers(response.data);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadTrainers();

    return () => {
      isMounted = false;
    };
  }, []);

  let content: JSX.Element;

  if (isLoading) {
    content = (
      <Text fontSize="$4" color="$muted">
        Loading trainers...
      </Text>
    );
  } else if (error) {
    content = (
      <Text fontSize="$4" color="$text" textAlign="center">
        Error: {error}
      </Text>
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
          >
            <Text fontSize="$5" fontWeight="600" color="$text">
              {trainer.displayName}
            </Text>
            {trainer.gymName ? (
              <Text fontSize="$3" color="$muted">
                Gym: {trainer.gymName}
              </Text>
            ) : null}
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
      <Text fontSize="$8" fontWeight="700" color="$text">
        Trainers
      </Text>
      {content}
    </YStack>
  );
}
