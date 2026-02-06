import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Button, Text, YStack } from 'tamagui';
import { apiClient } from '@api/client';
import { presentApiError, shouldShowErrorToast } from '@api/ApiErrorPresenter';
import { unwrap } from '@api/core';
import { useAppMutation } from '@query/hooks';
import { keys } from '@query/keys';
import { t } from '@i18n';
import { primaryButtonProps, secondaryButtonProps } from '@ui/formDefaults';
import { useToast } from '@ui/feedback/useToast';
import { formatUtcRange } from '@utils/time';
import { formatPrice } from '@utils/price';
import type { AppStackParamList } from '@app/navigation/types';
import { useQueryClient } from '@tanstack/react-query';

type Props = NativeStackScreenProps<AppStackParamList, 'SlotDetails'>;

export function SlotDetailsScreen({ route, navigation }: Props) {
  const { trainerName, slot, clientId } = route.params;
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const range = formatUtcRange(
    slot.startsAtUtc ?? '',
    slot.durationMinutes ?? 0
  );
  const priceLabel = formatPrice(slot.trainerPricePerSession);

  const bookMutation = useAppMutation({
    mutationFn: async (payload: { slotId: string; clientId: string }) => {
      const response = await apiClient.postSlotsSlotIdBook(payload.slotId, {
        clientId: payload.clientId,
      });
      return unwrap(response, 'Unable to book this slot right now.');
    },
    onSuccess: () => {
      if (slot.trainerId) {
        queryClient.invalidateQueries({
          queryKey: keys.trainers.slots(slot.trainerId),
        });
      }
      queryClient.invalidateQueries({ queryKey: keys.bookings.upcoming() });
      setSuccess('Slot booked successfully.');
    },
    onError: (err) => {
      const presented = presentApiError(err);
      setError(presented.message);
      if (shouldShowErrorToast(presented)) {
        showToast({
          type: 'error',
          title: presented.title,
          message: presented.message,
        });
      }
    },
  });

  const handleBook = async () => {
    const trimmedClientId = clientId.trim();
    if (!trimmedClientId) {
      setError('Client ID is required to book.');
      return;
    }

    setError(null);
    setSuccess(null);

    if (!slot.id) {
      setError('Slot ID is missing.');
      return;
    }

    try {
      await bookMutation.mutateAsync({
        slotId: slot.id,
        clientId: trimmedClientId,
      });
    } catch {
      // handled by mutation callbacks
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
        {priceLabel ? (
          <Text fontSize="$3" color="$muted">
            {t('slots.priceLabel', { price: priceLabel })}
          </Text>
        ) : null}
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
        disabled={bookMutation.isPending || !!success}
        {...primaryButtonProps}
      >
        {bookMutation.isPending ? 'Booking...' : 'Book slot'}
      </Button>
      <Button size="$3" onPress={() => navigation.goBack()} {...secondaryButtonProps}>
        Back to list
      </Button>
    </YStack>
  );
}



