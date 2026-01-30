import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl } from 'react-native';
import { ScrollView } from '@tamagui/scroll-view';
import { Button, Text, XStack, YStack } from 'tamagui';
import { getUiErrorMessage } from '../../api/core';
import { getMyTrainerSlots } from '../../api/trainerSlotsApi';
import type { SlotDto } from '../../generated/api';
import { t } from '../../i18n';
import { formatDateRu, formatTimeRangeRu } from '../../utils/datetime';
import type { ScheduleStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ScheduleStackParamList, 'ScheduleHome'>;

type ViewState = 'loading' | 'ready' | 'error';

type SlotSection = {
  title: string;
  slots: SlotDto[];
};

const getSlotTimes = (slot: SlotDto) => {
  if (!slot.startsAtUtc) {
    return null;
  }
  const start = new Date(slot.startsAtUtc);
  if (Number.isNaN(start.getTime())) {
    return null;
  }
  const duration = slot.durationMinutes ?? 0;
  const end = duration
    ? new Date(start.getTime() + duration * 60 * 1000)
    : start;
  return { start, end };
};

const sortByStart = (a: SlotDto, b: SlotDto) => {
  const aTime = a.startsAtUtc ? new Date(a.startsAtUtc).getTime() : 0;
  const bTime = b.startsAtUtc ? new Date(b.startsAtUtc).getTime() : 0;
  return aTime - bTime;
};

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate();

const getStatusLabel = (status?: string | null) => {
  if (!status) {
    return t('common.empty');
  }

  switch (status.toLowerCase()) {
    case 'open':
    case 'available':
      return t('status.open');
    case 'booked':
      return t('status.booked');
    case 'cancelled':
      return t('status.cancelled');
    case 'completed':
      return t('status.completed');
    case 'noshow':
    case 'no_show':
    case 'no-show':
      return t('status.noShow');
    default:
      return status;
  }
};

const getClientName = (slot: SlotDto): string | null => {
  const candidate = (slot as SlotDto & { clientName?: string | null }).clientName;
  return candidate ? candidate : null;
};

const getSlotStatus = (slot: SlotDto): string | null => {
  return slot.bookingStatus ?? slot.status ?? null;
};

export function ScheduleScreen({ navigation }: Props) {
  const [slots, setSlots] = useState<SlotDto[]>([]);
  const [state, setState] = useState<ViewState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadSlots = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      setState('loading');
    }
    setError(null);

    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const data = await getMyTrainerSlots({ fromUtc: startOfDay.toISOString() });
      setSlots(data.slice().sort(sortByStart));
      setState('ready');
    } catch (err) {
      setError(getUiErrorMessage(err));
      setState('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSlots();
    }, [loadSlots])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadSlots(true);
  };

  const sections = useMemo(() => {
    const today: SlotDto[] = [];
    const upcoming: SlotDto[] = [];
    const now = new Date();

    slots.forEach((slot) => {
      const times = getSlotTimes(slot);
      if (times && isSameDay(times.start, now)) {
        today.push(slot);
        return;
      }
      upcoming.push(slot);
    });

    return [
      { title: t('schedule.sectionToday'), slots: today },
      { title: t('schedule.sectionUpcoming'), slots: upcoming },
    ].filter((section) => section.slots.length > 0) satisfies SlotSection[];
  }, [slots]);

  const handleCreateSlot = () => {
    navigation.getParent()?.navigate('CreateSlot');
  };

  const renderSlotCard = (slot: SlotDto, index: number) => {
    const times = getSlotTimes(slot);
    const dateLabel = times ? formatDateRu(times.start) : '';
    const timeLabel = times
      ? formatTimeRangeRu(times.start, times.end)
      : '';
    const statusLabel = getStatusLabel(getSlotStatus(slot));
    const clientName = getClientName(slot);
    const canOpen = !!slot.id;

    return (
      <Button
        key={slot.id ?? `${slot.startsAtUtc ?? 'slot'}-${index}`}
        backgroundColor="$background"
        borderRadius="$5"
        borderWidth={1}
        borderColor="$border"
        padding="$4"
        height="100"
        justifyContent="flex-start"
        alignItems="stretch"
        onPress={() => {
          if (canOpen) {
            navigation.navigate('SlotDetails', { slot });
          }
        }}
        disabled={!canOpen}
      >
        <YStack gap="$2" width="100%">
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize="$4" fontWeight="700" color="$text">
              {timeLabel || t('common.empty')}
            </Text>
            <XStack
              paddingHorizontal="$3"
              paddingVertical="$1"
              backgroundColor="$surfaceMuted"
              borderRadius="$3"
            >
              <Text fontSize="$2" color="$muted">
                {statusLabel}
              </Text>
            </XStack>
          </XStack>
          <Text fontSize="$3" color="$muted">
            {dateLabel || t('common.empty')}
          </Text>
          {clientName ? (
            <Text fontSize="$3" color="$text">
              {clientName}
            </Text>
          ) : null}
        </YStack>
      </Button>
    );
  };

  const renderSection = (section: SlotSection) => (
    <YStack key={section.title} gap="$3">
      <Text fontSize="$5" fontWeight="700" color="$text">
        {section.title}
      </Text>
      <YStack gap="$4">
        {section.slots.map(renderSlotCard)}
      </YStack>
    </YStack>
  );

  const renderContent = () => {
    if (state === 'loading') {
      return (
        <YStack gap="$3">
          <YStack height="$12" backgroundColor="$surfaceMuted" borderRadius="$5" />
          <YStack height="$12" backgroundColor="$surfaceMuted" borderRadius="$5" />
        </YStack>
      );
    }

    if (state === 'error') {
      return (
        <YStack
          gap="$3"
          padding="$5"
          backgroundColor="$background"
          borderRadius="$5"
          borderWidth={1}
          borderColor="$border"
        >
          <Text fontSize="$3" color="$muted">
            {error ?? t('errors.generic')}
          </Text>
          <Button
            backgroundColor="$accent"
            color="$accentText"
            borderRadius="$4"
            minHeight="$9"
            paddingHorizontal="$4"
            onPress={() => loadSlots()}
          >
            {t('common.retry')}
          </Button>
        </YStack>
      );
    }

    if (slots.length === 0) {
      return (
        <YStack
          gap="$3"
          padding="$5"
          backgroundColor="$background"
          borderRadius="$5"
          borderWidth={1}
          borderColor="$border"
        >
          <Text fontSize="$3" color="$muted">
            {t('schedule.empty')}
          </Text>
          <Button
            backgroundColor="$accent"
            color="$accentText"
            borderRadius="$4"
            minHeight="$9"
            paddingHorizontal="$4"
            onPress={handleCreateSlot}
          >
            {t('schedule.createCta')}
          </Button>
        </YStack>
      );
    }

    if (sections.length === 0) {
      return (
        <YStack gap="$4">
          {slots.map(renderSlotCard)}
        </YStack>
      );
    }

    return (
      <YStack gap="$6">
        {sections.map(renderSection)}
      </YStack>
    );
  };

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <YStack flex={1} padding="$6" gap="$4">
          <YStack gap="$2">
            <Text fontSize="$8" fontWeight="700" color="$text">
              {t('schedule.title')}
            </Text>
            <Text fontSize="$4" color="$muted">
              {t('schedule.subtitle')}
            </Text>
          </YStack>
          {renderContent()}
        </YStack>
      </ScrollView>
    </YStack>
  );
}
