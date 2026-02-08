import { XStack, YStack } from 'tamagui';

export function ScheduleSkeleton() {
  return (
    <YStack gap="$4">
      {Array.from({ length: 3 }).map((_, index) => (
        <YStack
          key={`skeleton-${index}`}
          gap="$3"
          padding="$4"
          backgroundColor="$background"
          borderRadius="$5"
          borderWidth={1}
          borderColor="$border"
        >
          <YStack height={16} width="60%" backgroundColor="$surfaceMuted" borderRadius="$3" />
          <YStack height={12} width="40%" backgroundColor="$surfaceMuted" borderRadius="$3" />
          <XStack gap="$3" alignItems="center">
            <YStack width="$10" height="$10" borderRadius="$6" backgroundColor="$surfaceMuted" />
            <YStack gap="$2" flex={1}>
              <YStack height={14} width="70%" backgroundColor="$surfaceMuted" borderRadius="$3" />
              <YStack height={12} width="50%" backgroundColor="$surfaceMuted" borderRadius="$3" />
            </YStack>
          </XStack>
        </YStack>
      ))}
    </YStack>
  );
}
