import DateTimePicker from '@react-native-community/datetimepicker';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Button, YStack } from 'tamagui';
import { t } from '@i18n';

type IOSDatePickerCardProps = {
  value: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  onChange: (event: DateTimePickerEvent, date?: Date) => void;
  onClose: () => void;
  closeLabel?: string;
  closeMarginTop?: number | string;
};

export function IOSDatePickerCard({
  value,
  minimumDate,
  maximumDate,
  onChange,
  onClose,
  closeLabel,
  closeMarginTop,
}: IOSDatePickerCardProps) {
  return (
    <YStack
      padding="$4"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$4"
      backgroundColor="$background"
      gap="$3"
    >
      <DateTimePicker
        value={value}
        mode="date"
        display="inline"
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onChange={onChange}
      />
      <Button
        marginTop={closeMarginTop}
        backgroundColor="$surfaceMuted"
        borderWidth={1}
        borderColor="$border"
        onPress={onClose}
      >
        {closeLabel ?? t('common.close')}
      </Button>
    </YStack>
  );
}
