import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';
import { Button, Text, XStack, YStack } from 'tamagui';
import { t } from '@i18n';
import { AppIcon } from '@ui/AppIcon';
import { IOSDatePickerCard } from '@ui/components';
import { formatDateRu } from '@utils/datetime';
import { formatWeekdayDate } from './useCreateSlotFormState';

type CreateSlotDateSectionProps = {
  datePreset: 'today' | 'tomorrow' | 'custom';
  selectedDate: Date;
  todayDate: Date;
  tomorrowDate: Date;
  pickerVisible: boolean;
  onSelectToday: () => void;
  onSelectTomorrow: () => void;
  onPickCustom: () => void;
  onClosePicker: () => void;
  onChangeDate: (event: DateTimePickerEvent, date?: Date) => void;
};

export function CreateSlotDateSection({
  datePreset,
  selectedDate,
  todayDate,
  tomorrowDate,
  pickerVisible,
  onSelectToday,
  onSelectTomorrow,
  onPickCustom,
  onClosePicker,
  onChangeDate,
}: CreateSlotDateSectionProps) {
  return (
    <YStack gap="$3">
      <Text fontSize="$5" fontWeight="700" color="$text">
        {t('createSlot.dateSection')}
      </Text>
      <XStack gap="$2">
        <Button
          height="$11"
          flex={1}
          backgroundColor={datePreset === 'today' ? '$surfaceMuted' : '$background'}
          borderWidth={1}
          borderColor={datePreset === 'today' ? '$accent' : '$border'}
          borderRadius="$4"
          paddingVertical="$3"
          onPress={onSelectToday}
        >
          <YStack alignItems="center" gap="$1">
            <Text
              fontSize="$4"
              fontWeight="700"
              color={datePreset === 'today' ? '$accent' : '$text'}
            >
              {t('createSlot.dateToday')}
            </Text>
            <Text fontSize="$3" color="$muted">
              {formatDateRu(todayDate)}
            </Text>
          </YStack>
        </Button>
        <Button
          height="$11"
          flex={1}
          backgroundColor={datePreset === 'tomorrow' ? '$surfaceMuted' : '$background'}
          borderWidth={1}
          borderColor={datePreset === 'tomorrow' ? '$accent' : '$border'}
          borderRadius="$4"
          paddingVertical="$3"
          onPress={onSelectTomorrow}
        >
          <YStack alignItems="center" gap="$1">
            <Text
              fontSize="$4"
              fontWeight="700"
              color={datePreset === 'tomorrow' ? '$accent' : '$text'}
            >
              {t('createSlot.dateTomorrow')}
            </Text>
            <Text fontSize="$3" color="$muted">
              {formatDateRu(tomorrowDate)}
            </Text>
          </YStack>
        </Button>
        <Button
          height="$11"
          flex={1}
          backgroundColor={datePreset === 'custom' ? '$surfaceMuted' : '$background'}
          borderWidth={1}
          borderColor={datePreset === 'custom' ? '$accent' : '$border'}
          borderRadius="$4"
          paddingVertical="$3"
          onPress={onPickCustom}
        >
          <XStack alignItems="center" justifyContent="center" gap="$2">
            <Text
              fontSize="$3"
              fontWeight="700"
              color={datePreset === 'custom' ? '$accent' : '$text'}
            >
              {t('createSlot.datePick')}
            </Text>
            <AppIcon name="calendar" size={18} color="$muted" />
          </XStack>
        </Button>
      </XStack>
      <Text fontSize="$4" color="$muted">
        {formatWeekdayDate(selectedDate)}
      </Text>
      {pickerVisible && Platform.OS === 'ios' ? (
        <IOSDatePickerCard
          value={selectedDate}
          minimumDate={todayDate}
          onChange={onChangeDate}
          onClose={onClosePicker}
          closeMarginTop="$3"
        />
      ) : null}
    </YStack>
  );
}


