import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { Sheet } from '@tamagui/sheet';
import { Button, Switch, Text, XStack, YStack } from 'tamagui';
import {
  archiveTrainerWorkoutType,
  createTrainerWorkoutType,
  getTrainerWorkoutTypes,
  type TrainerWorkoutType,
  type WorkoutTypeCategory,
} from '@api/workoutTypesApi';
import { presentApiError } from '@api/ApiErrorPresenter';
import type { ProfileStackParamList } from '@app/navigation/types';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { useQueryClient } from '@tanstack/react-query';
import { AppIcon } from '@ui/AppIcon';
import { FormInput } from '@ui/components';
import { TabScrollView } from '@ui/layout/TabScrollView';
import { useToast } from '@ui/feedback/useToast';
import {
  getWorkoutTypeCategoryLabel,
  groupWorkoutTypesByCategory,
  workoutTypeCategoryOrder,
} from '@app/features/workoutTypes/workoutTypeUi';

type Props = NativeStackScreenProps<ProfileStackParamList, 'TrainerWorkoutTypes'>;

const CUSTOM_LIMIT = 40;

export function TrainerWorkoutTypesScreen({ navigation }: Props) {
  const [showArchived, setShowArchived] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<WorkoutTypeCategory>('Other');
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const workoutTypesQuery = useAppQuery({
    queryKey: keys.trainerWorkoutTypes.list(showArchived),
    queryFn: ({ signal }) => getTrainerWorkoutTypes(showArchived, { signal }),
  });

  const allForLimit = useAppQuery({
    queryKey: keys.trainerWorkoutTypes.list(false),
    enabled: showArchived,
    queryFn: ({ signal }) => getTrainerWorkoutTypes(false, { signal }),
  });

  const activeList = showArchived ? (allForLimit.data ?? []) : (workoutTypesQuery.data ?? []);
  const activeCustomCount = activeList.filter((item) => !item.isSystem && !item.isArchived).length;
  const limitReached = activeCustomCount >= CUSTOM_LIMIT;

  const groupedItems = useMemo(
    () => groupWorkoutTypesByCategory(workoutTypesQuery.data ?? []),
    [workoutTypesQuery.data]
  );

  const invalidateWorkoutTypes = () => {
    queryClient.invalidateQueries({ queryKey: ['trainer', 'workout-types'] });
  };

  const createMutation = useAppMutation({
    mutationFn: (payload: { name: string; category: WorkoutTypeCategory }) =>
      createTrainerWorkoutType(payload),
    onSuccess: () => {
      showToast({ type: 'success', title: 'Тип создан', message: 'Новый тип тренировки добавлен.' });
      setName('');
      setCategory('Other');
      setFormError(null);
      setSheetOpen(false);
      invalidateWorkoutTypes();
    },
    onError: (error) => {
      setFormError(presentApiError(error).message);
    },
  });

  const archiveMutation = useAppMutation({
    mutationFn: (id: string) => archiveTrainerWorkoutType(id),
    onSuccess: () => {
      showToast({ type: 'success', title: 'Архивировано', message: 'Тип тренировки архивирован.' });
      invalidateWorkoutTypes();
    },
    onError: (error) => {
      const presented = presentApiError(error);
      showToast({ type: 'error', title: presented.title, message: presented.message });
    },
  });

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError('Введите название типа.');
      return;
    }
    if (limitReached) {
      setFormError('Достигнут лимит 40 типов');
      return;
    }
    setFormError(null);
    createMutation.mutate({ name: trimmed, category });
  };

  const handleArchive = (item: TrainerWorkoutType) => {
    if (item.isSystem) {
      return;
    }
    Alert.alert(
      'Архивировать тип?',
      `Тип "${item.name}" будет скрыт из выбора для новых записей.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Архивировать',
          style: 'destructive',
          onPress: () => archiveMutation.mutate(item.id),
        },
      ]
    );
  };

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <TabScrollView contentContainerStyle={{ padding: 24 }}>
        <YStack gap="$4">
          <XStack justifyContent="space-between" alignItems="center" gap="$3">
            <Button unstyled onPress={() => navigation.goBack()}>
              <XStack alignItems="center" gap="$2">
                <AppIcon name="chevronLeft" size={18} color="$muted" />
                <Text color="$muted">Назад</Text>
              </XStack>
            </Button>
            <Button
              backgroundColor="$accent"
              color="$accentText"
              borderRadius="$4"
              minHeight="$9"
              paddingHorizontal="$4"
              onPress={() => setSheetOpen(true)}
            >
              <XStack alignItems="center" gap="$2">
                <AppIcon name="plus" size={16} color="$accentText" />
                <Text color="$accentText">Добавить</Text>
              </XStack>
            </Button>
          </XStack>

          <Text fontSize="$8" fontWeight="700" color="$text">
            Типы тренировок
          </Text>

          <XStack
            alignItems="center"
            justifyContent="space-between"
            gap="$3"
            backgroundColor="$background"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$4"
            padding="$3"
          >
            <YStack flex={1}>
              <Text fontSize="$3" color="$text">Показывать архивные</Text>
              <Text fontSize="$2" color="$muted">
                Активные кастомные: {activeCustomCount}/{CUSTOM_LIMIT}
              </Text>
            </YStack>
            <Switch checked={showArchived} onCheckedChange={setShowArchived}>
              <Switch.Thumb />
            </Switch>
          </XStack>

          {workoutTypesQuery.isLoading ? (
            <Text color="$muted">Загрузка...</Text>
          ) : null}
          {workoutTypesQuery.error ? (
            <Text color="$danger">{presentApiError(workoutTypesQuery.error).message}</Text>
          ) : null}

          {groupedItems.map((group) => (
            <YStack key={group.category} gap="$2">
              <Text fontSize="$4" fontWeight="700" color="$text">
                {group.title}
              </Text>
              {group.items.map((item) => (
                <XStack
                  key={item.id}
                  alignItems="center"
                  justifyContent="space-between"
                  gap="$3"
                  backgroundColor="$background"
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$4"
                  padding="$3"
                  opacity={item.isArchived ? 0.65 : 1}
                >
                    <YStack flex={1} minWidth={0}>
                      <Text fontSize="$4" color="$text" numberOfLines={1}>
                        {item.name}
                      </Text>
                      {showArchived ? (
                        <Text fontSize="$2" color="$muted">
                          {getWorkoutTypeCategoryLabel(item.category)}
                          {item.isArchived ? ' · Архив' : ''}
                        </Text>
                      ) : null}
                    </YStack>
                  {item.isSystem ? (
                    <AppIcon name="lock" size={16} color="$muted" />
                  ) : (
                    <Button
                      unstyled
                      onPress={() => handleArchive(item)}
                      disabled={archiveMutation.isPending}
                      padding="$2"
                    >
                      <AppIcon name="trash" size={16} color="$danger" />
                    </Button>
                  )}
                </XStack>
              ))}
            </YStack>
          ))}
        </YStack>
      </TabScrollView>

      <Sheet
        open={sheetOpen}
        onOpenChange={(open: boolean) => {
          setSheetOpen(open);
          if (!open) {
            setFormError(null);
          }
        }}
        modal
        snapPoints={[70]}
        snapPointsMode="percent"
        dismissOnSnapToBottom
      >
        <Sheet.Overlay backgroundColor="rgba(0,0,0,0.35)" />
        <Sheet.Frame backgroundColor="$backgroundSoft">
          <Sheet.Handle />
          <Sheet.ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
          >
            <YStack gap="$3">
          <Text fontSize="$6" fontWeight="700" color="$text">Новый тип тренировки</Text>
          <FormInput
            value={name}
            onChangeText={setName}
            placeholder="Например, Ноги"
            minHeight="$9"
          />
          <Text fontSize="$3" color="$muted">Категория</Text>
          <XStack gap="$2" flexWrap="wrap">
              {workoutTypeCategoryOrder.map((item) => {
                const selected = category === item;
                return (
                  <Button
                    unstyled
                    key={item}
                    backgroundColor={selected ? '$accent' : '$background'}
                    borderWidth={1}
                    borderColor={selected ? '$accent' : '$border'}
                    borderRadius="$4"
                    height="$8"
                    paddingHorizontal="$3"
                    alignItems="center"
                    justifyContent="center"
                    onPress={() => setCategory(item)}
                  >
                    <Text
                      color={selected ? '$accentText' : '$text'}
                      fontSize="$3"
                      fontWeight="600"
                      lineHeight="$3"
                    >
                      {getWorkoutTypeCategoryLabel(item)}
                    </Text>
                  </Button>
                );
              })}
          </XStack>
          {limitReached ? (
            <Text fontSize="$3" color="$danger">Достигнут лимит 40 типов</Text>
          ) : null}
          {formError ? <Text fontSize="$3" color="$danger">{formError}</Text> : null}
          <Button
            backgroundColor="$accent"
            color="$accentText"
            borderRadius="$4"
            minHeight="$9"
            onPress={handleCreate}
            disabled={createMutation.isPending || limitReached}
          >
            {createMutation.isPending ? 'Создание...' : 'Создать'}
          </Button>
            </YStack>
          </Sheet.ScrollView>
        </Sheet.Frame>
      </Sheet>
    </YStack>
  );
}

