import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { JSX, useCallback } from 'react';
import { Button, ScrollView, Text, YStack } from 'tamagui';
import { apiClient } from '../../api/client';
import { unwrap } from '../../api/core';
import type { SlotDto } from '../../generated/api';
import { t } from '../../i18n';
import { useAppQuery } from '../../query/hooks';
import { keys } from '../../query/keys';
import { secondaryButtonProps } from '../../ui/formDefaults';
import { EmptyState } from '../../ui/states/EmptyState';
import { ErrorState } from '../../ui/states/ErrorState';
import { LoadingState } from '../../ui/states/LoadingState';
import { formatUtcRange } from '../../utils/time';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'AvailableSlots'>;

export function AvailableSlotsScreen({ route, navigation }: Props) {
  const { trainerId, trainerName, clientId } = route.params;

  const {
    data: slots = [],
    isLoading,
    error,
    refetch,
  } = useAppQuery({
    queryKey: keys.trainers.slots(trainerId),
    queryFn: async ({ signal }) => {
      const response = await apiClient.getTrainersTrainerIdSlots(
        trainerId,
        undefined,
        { signal }
      );
      const data = unwrap<SlotDto[]>(
        response,
        'Unable to load available slots.'
      );
      return data.filter((slot) => slot.status === 'Open');
    },
  });

  useFocusEffect(
    useCallback(() => {
      if (!isLoading) {
        refetch();
      }
    }, [isLoading, refetch])
  );

  const trimmedClientId = clientId.trim();
  const canBook = trimmedClientId.length > 0;

  let content: JSX.Element;
  if (isLoading) {
    content = <LoadingState />;
  } else if (error) {
    content = <ErrorState error={error} onRetry={refetch} />;
  } else if (slots.length === 0) {
    content = (
      <EmptyState
        title={t('slots.empty')}
        ctaLabel={t('slots.retry')}
        onCtaPress={refetch}
      />
    );
  } else {
    content = (
      <ScrollView flex={1} width="100%">
        <YStack gap="$3" width="100%">
          {slots.map((slot, index) => {
            const range = formatUtcRange(
              slot.startsAtUtc ?? '',
              slot.durationMinutes ?? 0
            );
            const slotId = slot.id ?? '';
            const canOpen = canBook && slotId.length > 0;
            return (
              <YStack
                key={slot.id ?? `${slot.startsAtUtc ?? 'slot'}-${index}`}
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
                <Button
                  size="$3"
                  backgroundColor="$primary"
                  color="$primaryText"
                  onPress={() =>
                    navigation.navigate('SlotDetails', {
                      trainerId,
                      trainerName,
                      slot,
                      clientId: trimmedClientId,
                    })
                  }
                  disabled={!canOpen}
                  {...secondaryButtonProps}
                >
                  View & book
                </Button>
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
          Available slots (local time)
        </Text>
        {!canBook ? (
          <Text fontSize="$3" color="$primary">
            Client ID is required to book.
          </Text>
        ) : null}
      </YStack>
      {content}
    </YStack>
  );
}
