import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { JSX } from 'react';
import { Button, Text, YStack } from 'tamagui';
import { apiClient } from '@api/client';
import { unwrap } from '@api/core';
import { secondaryButtonProps } from '@ui/formDefaults';
import type { TrainerDto } from '@generated/api';
import { useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { EmptyState } from '@ui/states/EmptyState';
import { ErrorState } from '@ui/states/ErrorState';
import { LoadingState } from '@ui/states/LoadingState';
import type { AppStackParamList } from '@app/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Trainers'>;

export function TrainersScreen({ route, navigation }: Props) {
  const { mode, clientId } = route.params;
  const {
    data: trainers = [],
    isLoading,
    error,
    refetch,
  } = useAppQuery({
    queryKey: keys.trainers.list(),
    queryFn: async ({ signal }) => {
      const response = await apiClient.getTrainers({ signal });
      return unwrap<TrainerDto[]>(response, 'Unable to load trainers.');
    },
  });

  const actionLabel = mode === 'trainer' ? 'Manage slots' : 'View slots';
  const canNavigate = mode === 'trainer' || !!clientId?.trim();

  let content: JSX.Element;

  if (isLoading) {
    content = <LoadingState />;
  } else if (error) {
    content = <ErrorState error={error} onRetry={refetch} />;
  } else if (trainers.length === 0) {
    content = <EmptyState title="No trainers yet." />;
  } else {
    content = (
      <YStack gap="$3" width="100%">
        {trainers.map((trainer, index) => {
          const trainerId = trainer.id;
          const trainerName = trainer.displayName;
          const canOpen = !!trainerId && !!trainerName && canNavigate;
          return (
          <YStack
            key={trainer.id ?? `trainer-${index}`}
            padding="$4"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$3"
            gap="$3"
          >
            <YStack gap="$1">
              <Text fontSize="$5" fontWeight="600" color="$text">
                {trainerName ?? '—'}
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
                if (!canOpen || !trainerId || !trainerName) {
                  return;
                }
                if (mode === 'trainer') {
                  navigation.navigate('TrainerSlots', {
                    trainerId,
                    trainerName,
                  });
                } else {
                  navigation.navigate('AvailableSlots', {
                    trainerId,
                    trainerName,
                    clientId: clientId?.trim() ?? '',
                  });
                }
              }}
              disabled={!canOpen}
              {...secondaryButtonProps}
            >
              {actionLabel}
            </Button>
          </YStack>
          );
        })}
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


