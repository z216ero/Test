import { useMemo, useState } from 'react';
import { Sheet } from '@tamagui/sheet';
import { Button, Text, XStack, YStack } from 'tamagui';
import type { TrainerWorkoutType, WorkoutTypeSummary } from '@api/workoutTypesApi';
import { WorkoutTypeChip } from '@app/components/workout/WorkoutTypeChip';
import { AppIcon } from '@ui/AppIcon';
import { groupWorkoutTypesByCategory } from '@app/features/workoutTypes/workoutTypeUi';
import { FormInput } from '@ui/components';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: TrainerWorkoutType[];
  current: WorkoutTypeSummary | null;
  isLoading?: boolean;
  submitting?: boolean;
  onSelect: (workoutTypeId: string | null) => void;
};

export function TrainerWorkoutTypePickerSheet({
  open,
  onOpenChange,
  items,
  current,
  isLoading = false,
  submitting = false,
  onSelect,
}: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items;
    }
    return items.filter((item) => item.name.toLowerCase().includes(normalized));
  }, [items, query]);

  const groups = useMemo(() => groupWorkoutTypesByCategory(filtered), [filtered]);
  const currentArchived = current?.isArchived ? current : null;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      modal
      snapPoints={[80]}
      snapPointsMode="percent"
      dismissOnSnapToBottom
    >
      <Sheet.Overlay backgroundColor="rgba(0,0,0,0.35)" />
      <Sheet.Frame padding="$5" gap="$3" backgroundColor="$backgroundSoft">
        <Sheet.Handle />
        <Text fontSize="$6" fontWeight="700" color="$text">Тип тренировки</Text>
        <FormInput
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск"
          minHeight="$9"
        />
        <Sheet.ScrollView showsVerticalScrollIndicator={false}>
          <YStack gap="$3" paddingBottom="$4">
            {currentArchived ? (
              <YStack
                gap="$2"
                padding="$3"
                borderWidth={1}
                borderColor="$border"
                borderRadius="$4"
                backgroundColor="$background"
                opacity={0.75}
              >
                <Text fontSize="$3" color="$muted">Текущий (архив)</Text>
                <WorkoutTypeChip label={currentArchived.name} archived />
              </YStack>
            ) : null}

            <Button
              unstyled
              onPress={() => onSelect(null)}
              disabled={submitting}
              borderWidth={1}
              borderColor="$border"
              borderRadius="$4"
              backgroundColor="$background"
              padding="$3"
            >
              <Text color="$text">Без типа</Text>
            </Button>

            {isLoading ? <Text color="$muted">Загрузка...</Text> : null}

            {groups.map((group) => (
              <YStack key={group.category} gap="$2">
                <Text fontSize="$3" fontWeight="700" color="$muted">
                  {group.title}
                </Text>
                {group.items.map((item) => {
                  const selected = current?.id === item.id;
                  return (
                    <Button
                      key={item.id}
                      unstyled
                      onPress={() => onSelect(item.id)}
                      disabled={submitting}
                      borderWidth={1}
                      borderColor={selected ? '$accent' : '$border'}
                      borderRadius="$4"
                      backgroundColor="$background"
                      padding="$3"
                    >
                      <XStack justifyContent="space-between" alignItems="center" gap="$3">
                        <YStack flex={1} minWidth={0}>
                          <Text color="$text" numberOfLines={1}>{item.name}</Text>
                          <Text color="$muted" fontSize="$2">{group.title}</Text>
                        </YStack>
                        {selected ? <AppIcon name="check" size={16} color="$accent" /> : null}
                      </XStack>
                    </Button>
                  );
                })}
              </YStack>
            ))}
          </YStack>
        </Sheet.ScrollView>
      </Sheet.Frame>
    </Sheet>
  );
}
