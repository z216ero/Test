import { ScrollView } from 'react-native';
import { Button, Text, XStack, YStack } from 'tamagui';
import { t } from '@i18n';

export type BookingTab = 'upcoming' | 'pending' | 'history';

type BookingsTabSelectorProps = {
  activeTab: BookingTab;
  pendingCount: number;
  onChangeTab: (tab: BookingTab) => void;
};

export function BookingsTabSelector({
  activeTab,
  pendingCount,
  onChangeTab,
}: BookingsTabSelectorProps) {
  return (
    <YStack
      padding="$1"
      backgroundColor="$surfaceMuted"
      borderRadius="$4"
      borderWidth={1}
      borderColor="$border"
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <XStack gap="$2" paddingRight="$1">
          {([
            { id: 'upcoming', label: t('bookings.upcoming') },
            { id: 'pending', label: t('bookings.pending') },
            { id: 'history', label: t('bookings.past') },
          ] as const).map((tab) => {
            const isActive = activeTab === tab.id;
            const showBadge = tab.id === 'pending' && pendingCount > 0;
            return (
              <Button
                key={tab.id}
                unstyled
                onPress={() => onChangeTab(tab.id)}
              >
                <XStack
                  minHeight="$9"
                  paddingHorizontal="$4"
                  borderRadius="$4"
                  backgroundColor={isActive ? '$background' : 'transparent'}
                  borderWidth={isActive ? 1 : 0}
                  borderColor={isActive ? '$border' : 'transparent'}
                  alignItems="center"
                  justifyContent="center"
                  gap="$2"
                >
                  <Text
                    fontSize="$3"
                    fontWeight={isActive ? '700' : '600'}
                    color={isActive ? '$text' : '$muted'}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                  {showBadge ? (
                    <XStack
                      minWidth={20}
                      height={20}
                      borderRadius="$6"
                      alignItems="center"
                      justifyContent="center"
                      paddingHorizontal="$2"
                      backgroundColor="$accent"
                    >
                      <Text fontSize="$1" fontWeight="700" color="$accentText">
                        {pendingCount > 99 ? '99+' : `${pendingCount}`}
                      </Text>
                    </XStack>
                  ) : null}
                </XStack>
              </Button>
            );
          })}
        </XStack>
      </ScrollView>
    </YStack>
  );
}
