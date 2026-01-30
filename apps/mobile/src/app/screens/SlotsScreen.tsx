import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { ScrollView } from '@tamagui/scroll-view';
import { Button, Text, XStack, YStack } from 'tamagui';
import { getAvailableSlotsWithTrainers } from '../../api/slotsApi';
import type { SlotDto, TrainerDto } from '../../generated/api';
import { t } from '../../i18n';
import { useAppQuery } from '../../query/hooks';
import { keys } from '../../query/keys';
import { EmptyState } from '../../ui/states/EmptyState';
import { ErrorState } from '../../ui/states/ErrorState';
import { LoadingState } from '../../ui/states/LoadingState';
import { formatDateRu, formatTimeRangeRu } from '../../utils/datetime';
import type { SlotsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<SlotsStackParamList, 'SlotsList'>;

type DayFilter = 'today' | 'tomorrow';

const buildInitials = (name?: string | null): string => {
  if (!name) {
    return '';
  }

  const parts = name.split(' ').filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
  return initials.toUpperCase();
};

const getSlotDate = (slot: SlotDto): Date | null => {
  if (!slot.startsAtUtc) {
    return null;
  }
  const date = new Date(slot.startsAtUtc);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const getSlotEnd = (slot: SlotDto, start: Date): Date => {
  const duration = slot.durationMinutes ?? 0;
  if (!duration) {
    return start;
  }
  return new Date(start.getTime() + duration * 60 * 1000);
};

export function SlotsScreen({ navigation }: Props) {
  const [filter, setFilter] = useState<DayFilter>('today');

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useAppQuery({
    queryKey: keys.slots.available(),
    queryFn: ({ signal }) => getAvailableSlotsWithTrainers(undefined, { signal }),
  });

  const slots = data?.slots ?? [];
  const trainersById: Record<string, TrainerDto> = data?.trainersById ?? {};

  useFocusEffect(
    useCallback(() => {
      if (!isLoading) {
        refetch();
      }
    }, [isLoading, refetch])
  );

  const onRefresh = () => {
    refetch();
  };

  const visibleSlots = slots;

  const renderSlotCard = (slot: SlotDto, index: number) => {
    const start = getSlotDate(slot);
    const dateLabel = start ? formatDateRu(start) : '';
    const end = start ? getSlotEnd(slot, start) : null;
    const timeLabel = start
      ? formatTimeRangeRu(start, end ?? start)
      : '';
    const trainer = slot.trainerId ? trainersById[slot.trainerId] : undefined;
    const trainerName = trainer?.displayName ?? null;
    const trainerInitials = buildInitials(trainerName);

    return (
      <YStack
        key={slot.id ?? `${slot.startsAtUtc ?? 'slot'}-${index}`}
        gap="$3"
        padding="$4"
        backgroundColor="$background"
        borderRadius="$5"
        borderWidth={1}
        borderColor="$border"
      >
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize="$4" fontWeight="700" color="$text">
            {timeLabel || t('common.empty')}
          </Text>
        </XStack>
        <Text fontSize="$3" color="$muted">
          {dateLabel || t('common.empty')}
        </Text>
        {trainerName ? (
          <XStack gap="$3" alignItems="center">
            <YStack
              width="$10"
              height="$10"
              borderRadius="$6"
              backgroundColor="$surfaceMuted"
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize="$4" color="$muted">
                {trainerInitials}
              </Text>
            </YStack>
            <YStack gap="$1" flex={1}>
              <Text fontSize="$4" fontWeight="700" color="$text">
                {trainerName}
              </Text>
            </YStack>
          </XStack>
        ) : null}
        <XStack justifyContent="flex-end">
          <Button
            backgroundColor="$accent"
            color="$accentText"
            borderRadius="$4"
            minHeight="$9"
            paddingHorizontal="$4"
            paddingVertical="$2"
            onPress={() =>
              navigation.navigate('BookingConfirm', {
                slot,
                trainerName,
              })
            }
          >
            {t('slots.bookCta')}
          </Button>
        </XStack>
      </YStack>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return <LoadingState />;
    }

    if (error) {
      return <ErrorState error={error} onRetry={refetch} />;
    }

    if (visibleSlots.length === 0) {
      return <EmptyState title={t('slots.empty')} />;
    }

    return <YStack gap="$4">{visibleSlots.map(renderSlotCard)}</YStack>;
  };

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={onRefresh}
          />
        }
      >
        <YStack flex={1} padding="$6" gap="$6">
          <YStack gap="$2">
            <Text fontSize="$8" fontWeight="700" color="$text">
              {t('slots.title')}
            </Text>
            <Text fontSize="$4" color="$muted">
              {t('slots.subtitle')}
            </Text>
          </YStack>
          <XStack gap="$2">
            <Button
              flex={1}
              backgroundColor={filter === 'today' ? '$surfaceMuted' : '$background'}
              borderRadius="$4"
              borderWidth={1}
              borderColor="$border"
              minHeight="$9"
              paddingVertical="$2"
              onPress={() => setFilter('today')}
            >
              <Text fontSize="$3" color="$text">
                {t('slots.filterToday')}
              </Text>
            </Button>
            <Button
              flex={1}
              backgroundColor={filter === 'tomorrow' ? '$surfaceMuted' : '$background'}
              borderRadius="$4"
              borderWidth={1}
              borderColor="$border"
              minHeight="$9"
              paddingVertical="$2"
              onPress={() => setFilter('tomorrow')}
            >
              <Text fontSize="$3" color="$text">
                {t('slots.filterTomorrow')}
              </Text>
            </Button>
          </XStack>
          {renderContent()}
        </YStack>
      </ScrollView>
    </YStack>
  );
}
