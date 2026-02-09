import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';
import { Text, YStack } from 'tamagui';
import { t } from '@i18n';
import { IOSDatePickerCard } from '@ui/components';
import { DateStrip } from '@app/components/schedule/DateStrip';
import { formatWeekdayDate } from './useCreateSlotFormState';

type CreateSlotDateSectionProps = {
  visibleDates: Date[];
  selectedDate: Date;
  todayDate: Date;
  tomorrowDate: Date;
  maxDate: Date;
  pickerVisible: boolean;
  onSelectDate: (date: Date) => void;
  onPickCustom: () => void;
  onClosePicker: () => void;
  onChangeDate: (event: DateTimePickerEvent, date?: Date) => void;
};

export function CreateSlotDateSection({
  visibleDates,
  selectedDate,
  todayDate,
  tomorrowDate,
  maxDate,
  pickerVisible,
  onSelectDate,
  onPickCustom,
  onClosePicker,
  onChangeDate,
}: CreateSlotDateSectionProps) {
  return (
    <YStack gap="$3">
      <Text fontSize="$5" fontWeight="700" color="$text">
        {t('createSlot.dateSection')}
      </Text>
      <DateStrip
        dates={visibleDates}
        selectedDate={selectedDate}
        todayDate={todayDate}
        tomorrowDate={tomorrowDate}
        onSelectDate={onSelectDate}
        onOpenCalendar={onPickCustom}
      />
      <Text fontSize="$4" color="$muted">
        {formatWeekdayDate(selectedDate)}
      </Text>
      {pickerVisible && Platform.OS === 'ios' ? (
        <IOSDatePickerCard
          value={selectedDate}
          minimumDate={todayDate}
          maximumDate={maxDate}
          onChange={onChangeDate}
          onClose={onClosePicker}
          closeMarginTop="$3"
        />
      ) : null}
    </YStack>
  );
}


