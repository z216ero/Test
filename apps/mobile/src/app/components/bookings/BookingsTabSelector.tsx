import { Button, Text, XStack } from 'tamagui';
import { t } from '@i18n';

export type BookingTab = 'upcoming' | 'history';

type BookingsTabSelectorProps = {
  activeTab: BookingTab;
  onChangeTab: (tab: BookingTab) => void;
};

export function BookingsTabSelector({ activeTab, onChangeTab }: BookingsTabSelectorProps) {
  return (
    <XStack
      padding="$1"
      backgroundColor="$surfaceMuted"
      borderRadius="$4"
      borderWidth={1}
      borderColor="$border"
      gap="$1"
    >
      {([
        { id: 'upcoming', label: t('bookings.upcoming') },
        { id: 'history', label: t('bookings.past') },
      ] as const).map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <Button
            key={tab.id}
            unstyled
            flex={1}
            paddingVertical="$2"
            borderRadius="$3"
            backgroundColor={isActive ? '$background' : 'transparent'}
            onPress={() => onChangeTab(tab.id)}
          >
            <Text
              fontSize="$3"
              fontWeight={isActive ? '700' : '600'}
              color={isActive ? '$text' : '$muted'}
              textAlign="center"
            >
              {tab.label}
            </Text>
          </Button>
        );
      })}
    </XStack>
  );
}

