import { Text, XStack, YStack } from 'tamagui';
import { AppIcon } from '@ui/AppIcon';

type ProfileTrainerRatingProps = {
  role: 'Trainer' | 'Client';
  showTrainerRating: boolean;
  trainerRating?: number | null;
  ratingCaption: string;
};

export function ProfileTrainerRating({
  role,
  showTrainerRating,
  trainerRating,
  ratingCaption,
}: ProfileTrainerRatingProps) {
  if (role !== 'Trainer') {
    return null;
  }

  return (
    <YStack alignItems="flex-end" gap="$1" maxWidth={160}>
      {showTrainerRating && typeof trainerRating === 'number' ? (
        <XStack alignItems="center" gap="$1">
          <AppIcon name="star" size={16} color="$accent" />
          <Text fontSize="$4" fontWeight="700" color="$text">
            {trainerRating.toFixed(1)}
          </Text>
        </XStack>
      ) : null}
      <Text fontSize="$2" color="$muted" textAlign="right">
        {ratingCaption}
      </Text>
    </YStack>
  );
}
