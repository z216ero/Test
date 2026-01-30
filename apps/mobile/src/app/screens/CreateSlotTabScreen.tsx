import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useState } from 'react';
import { ScrollView } from '@tamagui/scroll-view';
import { Button, Input, Text, XStack, YStack } from 'tamagui';
import { presentApiError } from '../../api/ApiErrorPresenter';
import {
  createSlot,
  TrainerSlotsOverlapError,
} from '../../api/trainerSlotsApi';
import { t } from '../../i18n';
import { useAppMutation } from '../../query/hooks';
import { keys } from '../../query/keys';
import { formInputProps } from '../../ui/formDefaults';
import { useToast } from '../../ui/feedback/useToast';
import type { TrainerTabsParamList } from '../navigation/types';
import { useQueryClient } from '@tanstack/react-query';

type Props = BottomTabScreenProps<TrainerTabsParamList, 'CreateSlot'>;

const durations = [30, 45, 60, 90];

const parseDateInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    return { year, month, day };
  }

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split('.').map(Number);
    return { year, month, day };
  }

  return null;
};

const parseTimeInput = (value: string) => {
  const trimmed = value.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) {
    return null;
  }

  const [hours, minutes] = trimmed.split(':').map(Number);
  if (
    Number.isNaN(hours)
    || Number.isNaN(minutes)
    || hours < 0
    || hours > 23
    || minutes < 0
    || minutes > 59
  ) {
    return null;
  }

  return { hours, minutes };
};

const buildLocalDateTime = (dateValue: string, timeValue: string) => {
  const date = parseDateInput(dateValue);
  const time = parseTimeInput(timeValue);
  if (!date || !time) {
    return null;
  }

  const local = new Date(
    date.year,
    date.month - 1,
    date.day,
    time.hours,
    time.minutes
  );
  if (Number.isNaN(local.getTime())) {
    return null;
  }

  return local;
};

export function CreateSlotTabScreen({ navigation }: Props) {
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [duration, setDuration] = useState<number>(durations[2]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const createMutation = useAppMutation({
    mutationFn: (payload: { startsAtUtc: string; durationMinutes: number }) =>
      createSlot(payload),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
      setSuccess(t('createSlot.success'));
      showToast({ type: 'success', title: t('createSlot.success') });
      navigation.navigate('Schedule', { screen: 'ScheduleHome' });
    },
    onError: (err) => {
      if (err instanceof TrainerSlotsOverlapError) {
        setError(err.message);
        return;
      }
      const presented = presentApiError(err);
      setError(presented.message);
      showToast({
        type: 'error',
        title: presented.title,
        message: presented.message,
      });
    },
  });

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!dateInput.trim() || !timeInput.trim()) {
      setError(t('createSlot.validationRequired'));
      return;
    }

    const startDate = buildLocalDateTime(dateInput, timeInput);
    if (!startDate) {
      setError(t('createSlot.validationFormat'));
      return;
    }

    if (!duration || duration <= 0) {
      setError(t('createSlot.validationDuration'));
      return;
    }

    if (startDate.getTime() <= Date.now()) {
      setError(t('createSlot.validationFuture'));
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await createMutation.mutateAsync({
        startsAtUtc: startDate.toISOString(),
        durationMinutes: duration,
      });
      setDateInput('');
      setTimeInput('');
      setDuration(durations[2]);
    } catch {
      // handled in mutation callbacks
    }
  };

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <ScrollView>
        <YStack flex={1} padding="$6" gap="$4">
          <YStack gap="$2">
            <Text fontSize="$8" fontWeight="700" color="$text">
              {t('createSlot.title')}
            </Text>
            <Text fontSize="$4" color="$muted">
              {t('createSlot.subtitle')}
            </Text>
          </YStack>
          <YStack gap="$3">
            <Text fontSize="$3" color="$text">
              {t('createSlot.date')}
            </Text>
            <Input
              value={dateInput}
              onChangeText={setDateInput}
              placeholder={t('createSlot.datePlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              {...formInputProps}
            />
          </YStack>
          <YStack gap="$3">
            <Text fontSize="$3" color="$text">
              {t('createSlot.startTime')}
            </Text>
            <Input
              value={timeInput}
              onChangeText={setTimeInput}
              placeholder={t('createSlot.timePlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              {...formInputProps}
            />
          </YStack>
          <YStack gap="$3">
            <Text fontSize="$3" color="$text">
              {t('createSlot.duration')}
            </Text>
            <XStack gap="$2" flexWrap="wrap">
              {durations.map((minutes) => {
                const isActive = duration === minutes;
                return (
                  <Button
                    key={minutes}
                    backgroundColor={isActive ? '$accent' : '$background'}
                    borderRadius="$4"
                    borderWidth={1}
                    borderColor="$border"
                    minHeight="$9"
                    paddingHorizontal="$4"
                    onPress={() => setDuration(minutes)}
                  >
                    <Text color={isActive ? '$accentText' : '$text'}>
                      {t('createSlot.durationOption', { minutes })}
                    </Text>
                  </Button>
                );
              })}
            </XStack>
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
            backgroundColor="$accent"
            color="$accentText"
            borderRadius="$4"
            minHeight="$9"
            paddingHorizontal="$4"
            onPress={handleSubmit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? t('common.loading') : t('createSlot.save')}
          </Button>
        </YStack>
      </ScrollView>
    </YStack>
  );
}
