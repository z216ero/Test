import { ScrollView } from '@tamagui/scroll-view';
import { Button, Text, XStack, YStack } from 'tamagui';
import { t } from '../../../i18n';
import { AppIcon } from '../../../ui/AppIcon';
import { formatDateRu } from '../../../utils/datetime';

const isSameLocalDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate();

const formatWeekdayShort = (value: Date): string => {
  const raw = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
  }).format(value);
  const cleaned = raw.replace('.', '').trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const buildDateKey = (value: Date): string => {
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
};

type DateStripProps = {
  dates: Date[];
  selectedDate: Date;
  todayDate: Date;
  tomorrowDate: Date;
  markers?: Record<string, boolean>;
  onSelectDate: (date: Date) => void;
  onOpenCalendar: () => void;
};

export function DateStrip({
  dates,
  selectedDate,
  todayDate,
  tomorrowDate,
  markers,
  onSelectDate,
  onOpenCalendar,
}: DateStripProps) {
  return (
    <XStack alignItems="center" gap="$2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <XStack gap="$2" paddingRight="$2">
          {dates.map((date) => {
            const isSelected = isSameLocalDay(date, selectedDate);
            const label = isSameLocalDay(date, todayDate)
              ? t('createSlot.dateToday')
              : isSameLocalDay(date, tomorrowDate)
                ? t('createSlot.dateTomorrow')
                : formatWeekdayShort(date);
            const dateLabel = formatDateRu(date);
            const key = buildDateKey(date);
            const hasSlots = markers?.[key] ?? false;
            return (
              <Button
                key={key}
                height="$11"
                paddingHorizontal="$4"
                backgroundColor={isSelected ? '$surfaceMuted' : '$background'}
                borderWidth={1}
                borderColor={isSelected ? '$accent' : '$border'}
                borderRadius="$4"
                onPress={() => onSelectDate(date)}
              >
                <YStack alignItems="center" gap="$1">
                  <Text
                    fontSize="$3"
                    fontWeight="700"
                    color={isSelected ? '$accent' : '$text'}
                  >
                    {label}
                  </Text>

                  <XStack justifyContent='center' alignItems="center" gap="$1" height="$3">
                    <Text fontSize="$2" color="$muted">
                      {dateLabel}
                    </Text>
                    <YStack
                      marginTop={5}
                      width={6}
                      height={6}
                      borderRadius={3}
                      backgroundColor={isSelected ? '$accent' : '$primary'}
                      opacity={hasSlots ? 1 : 0}
                    />
                  </XStack>
                </YStack>
              </Button>
            );
          })}
        </XStack>
      </ScrollView>
      <Button
        height="$11"
        width="$11"
        backgroundColor="$background"
        borderWidth={1}
        borderColor="$border"
        borderRadius="$4"
        onPress={onOpenCalendar}
      >
        <AppIcon name="calendar" size={18} color="$muted" />
      </Button>
    </XStack>
  );
}
