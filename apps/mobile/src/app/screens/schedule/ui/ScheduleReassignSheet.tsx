import { ScrollView } from '@tamagui/scroll-view';
import { Sheet } from '@tamagui/sheet';
import { Button, Input, Text, YStack } from 'tamagui';
import type { TrainerClientLink } from '@api/clientLinksApi';
import { t } from '@i18n';

type ScheduleReassignSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: string;
  onSearchChange: (value: string) => void;
  clients: TrainerClientLink[];
  isLoading: boolean;
  isAssigning: boolean;
  selectedSlotId?: string;
  onAssign: (payload: { slotId: string; clientUserId: string }) => void;
  onClose: () => void;
};

export function ScheduleReassignSheet({
  open,
  onOpenChange,
  search,
  onSearchChange,
  clients,
  isLoading,
  isAssigning,
  selectedSlotId,
  onAssign,
  onClose,
}: ScheduleReassignSheetProps) {
  const filteredClients = clients.filter((item) => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return (item.clientName ?? '').toLowerCase().includes(query)
      || (item.clientPhone ?? '').toLowerCase().includes(query);
  });

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      modal
      dismissOnSnapToBottom
      snapPoints={[85]}
      dismissOnOverlayPress
    >
      <Sheet.Overlay
        animation="fast"
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
        backgroundColor="rgba(15, 23, 42, 0.2)"
      />
      <Sheet.Frame
        padding="$5"
        paddingBottom="$7"
        gap="$4"
        backgroundColor="$backgroundSoft"
        borderTopWidth={1}
        borderTopColor="$border"
        borderTopLeftRadius="$6"
        borderTopRightRadius="$6"
      >
        <Sheet.Handle />
        <Text fontSize="$5" fontWeight="700" color="$text">
          {t('schedule.actions.assignAnotherClient')}
        </Text>
        <Input
          value={search}
          onChangeText={onSearchChange}
          placeholder={t('createSlot.assignmentSearchPlaceholder')}
          color="$text"
          placeholderTextColor="$muted"
          backgroundColor="$background"
          borderWidth={1}
          borderColor="$border"
          borderRadius="$4"
          minHeight="$10"
        />
        {isLoading ? (
          <Text fontSize="$3" color="$muted">{t('common.loading')}</Text>
        ) : null}
        {!isLoading && clients.length === 0 ? (
          <Text fontSize="$3" color="$muted">{t('schedule.actions.noAcceptedClients')}</Text>
        ) : null}
        <ScrollView maxHeight={360} showsVerticalScrollIndicator={false}>
          <YStack gap="$2" paddingBottom="$2">
            {filteredClients.map((item) => (
              <Button
                key={item.id}
                backgroundColor="$background"
                borderWidth={1}
                borderColor="$border"
                borderRadius="$4"
                minHeight="$10"
                justifyContent="flex-start"
                paddingHorizontal="$4"
                onPress={() => {
                  if (!selectedSlotId || !item.clientUserId) {
                    return;
                  }
                  onAssign({
                    slotId: selectedSlotId,
                    clientUserId: item.clientUserId,
                  });
                }}
                disabled={isAssigning || !item.clientUserId}
              >
                <YStack alignItems="flex-start" gap="$1">
                  <Text color="$text" fontWeight="600">{item.clientName ?? t('common.empty')}</Text>
                  {item.clientPhone ? (
                    <Text fontSize="$2" color="$muted">{item.clientPhone}</Text>
                  ) : null}
                </YStack>
              </Button>
            ))}
          </YStack>
        </ScrollView>
        <Button
          backgroundColor="$background"
          borderWidth={1}
          borderColor="$border"
          borderRadius="$4"
          minHeight="$10"
          onPress={onClose}
        >
          <Text color="$text">{t('profile.personal.cancel')}</Text>
        </Button>
      </Sheet.Frame>
    </Sheet>
  );
}

