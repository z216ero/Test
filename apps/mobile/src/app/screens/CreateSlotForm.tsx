import type { QueryKey } from '@tanstack/react-query';
import { Sheet } from '@tamagui/sheet';
import { ScrollView } from '@tamagui/scroll-view';
import { useState } from 'react';
import { Button, Text, XStack, YStack } from 'tamagui';
import type {
  CreateSlotRequest,
  GetTrainersTrainerIdSlotsParams,
  SlotDto,
} from '@generated/api';
import { getMe } from '@api/homeApi';
import { useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { t } from '@i18n';
import { FormInput } from '@ui/components';
import { CreateSlotDateSection } from './CreateSlotDateSection';
import { CreateSlotFooter } from './CreateSlotFooter';
import { CreateSlotHeader } from './CreateSlotHeader';
import { CreateSlotMultiSection } from './CreateSlotMultiSection';
import { CreateSlotTimeSection } from './CreateSlotTimeSection';
import { CreateSlotGroupSettingsSheet } from './CreateSlotGroupSettingsSheet';
import {
  formatTimeLabel,
  MULTI_COUNTS,
  useCreateSlotFormState,
} from './useCreateSlotFormState';

type CreateSlotFormProps = {
  title: string;
  onBack: () => void;
  onAfterSuccess: (count: number) => void;
  buildQueryKey: (params: GetTrainersTrainerIdSlotsParams) => QueryKey;
  loadSlots: (
    params: GetTrainersTrainerIdSlotsParams,
    options?: RequestInit
  ) => Promise<SlotDto[]>;
  createSlot: (payload: CreateSlotRequest, options?: RequestInit) => Promise<SlotDto>;
  initialDateIsoLocal?: string;
  initialAssignTrainerClientId?: string;
};

export function CreateSlotForm({
  title,
  onBack,
  onAfterSuccess,
  buildQueryKey,
  loadSlots,
  createSlot,
  initialDateIsoLocal,
  initialAssignTrainerClientId,
}: CreateSlotFormProps) {
  const [clientPickerOpen, setClientPickerOpen] = useState(false);

  const {
    selectedDate,
    setSelectedDate,
    selectedStart,
    selectedRangeEnd,
    selectedRangeLabel,
    unavailableMultiMessage,
    canSubmit,
    handleCreate,
    handleTilePress,
    grid,
    resolvedDisabledTimes,
    slotsQuery,
    apiError,
    multiEnabled,
    setMultiEnabled,
    multiCount,
    setMultiCount,
    slotCount,
    groupEnabled,
    setGroupEnabled,
    assignmentMode,
    setAssignmentMode,
    selectedTrainerClientId,
    setSelectedTrainerClientId,
    trainerClientSearch,
    setTrainerClientSearch,
    filteredTrainerClients,
    selectedTrainerClient,
    trainerClientsQuery,
    groupSettingsOpen,
    setGroupSettingsOpen,
    groupCapacityMin,
    setGroupCapacityMin,
    groupCapacityMax,
    setGroupCapacityMax,
    groupAutoCancelIfMinNotReached,
    setGroupAutoCancelIfMinNotReached,
    pickerVisible,
    setPickerVisible,
    handleDateChange,
    openDatePicker,
    todayDate,
    tomorrowDate,
    visibleDates,
    maxDate,
    isCreating,
  } = useCreateSlotFormState({
    buildQueryKey,
    loadSlots,
    createSlot,
    onAfterSuccess,
    initialDateIsoLocal,
    initialAssignTrainerClientId,
  });

  const meQuery = useAppQuery({
    queryKey: keys.auth.me(),
    queryFn: ({ signal }) => getMe({ signal }),
  });

  const canCreateGroup = (meQuery.data?.trainingTypes ?? []).some((type) =>
    type?.toLowerCase() === 'group'
  );

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <ScrollView>
        <YStack padding="$6" gap="$5" paddingBottom="$8">
          <CreateSlotHeader title={title} onBack={onBack} />
          <CreateSlotDateSection
            visibleDates={visibleDates}
            selectedDate={selectedDate}
            todayDate={todayDate}
            tomorrowDate={tomorrowDate}
            maxDate={maxDate}
            pickerVisible={pickerVisible}
            onSelectDate={setSelectedDate}
            onPickCustom={openDatePicker}
            onClosePicker={() => setPickerVisible(false)}
            onChangeDate={handleDateChange}
          />
          <CreateSlotTimeSection
            selectedRangeLabel={selectedRangeLabel}
            slotsQuery={slotsQuery}
            unavailableMultiMessage={unavailableMultiMessage}
            apiError={apiError}
            grid={grid}
            selectedStart={selectedStart}
            selectedRangeEnd={selectedRangeEnd}
            resolvedDisabledTimes={resolvedDisabledTimes}
            onTilePress={handleTilePress}
            formatTimeLabel={formatTimeLabel}
          />
          <YStack
            gap="$3"
            padding="$4"
            backgroundColor="$background"
            borderRadius="$5"
            borderWidth={1}
            borderColor="$border"
            minHeight={160}
          >
            <Text fontSize="$4" fontWeight="700" color="$text">
              {t('createSlot.assignmentTitle')}
            </Text>
            <XStack
              padding="$1"
              backgroundColor="$surfaceMuted"
              borderRadius="$4"
              borderWidth={1}
              borderColor="$border"
              gap="$1"
            >
              <Button
                unstyled
                flex={1}
                paddingVertical="$2"
                borderRadius="$3"
                backgroundColor={assignmentMode === 'open' ? '$background' : 'transparent'}
                onPress={() => setAssignmentMode('open')}
              >
                <Text
                  fontSize="$3"
                  fontWeight={assignmentMode === 'open' ? '700' : '600'}
                  color={assignmentMode === 'open' ? '$text' : '$muted'}
                  textAlign="center"
                >
                  {t('createSlot.assignmentOpen')}
                </Text>
              </Button>
              <Button
                unstyled
                flex={1}
                paddingVertical="$2"
                borderRadius="$3"
                backgroundColor={assignmentMode === 'assigned' ? '$background' : 'transparent'}
                onPress={() => setAssignmentMode('assigned')}
                disabled={groupEnabled}
              >
                <Text
                  fontSize="$3"
                  fontWeight={assignmentMode === 'assigned' ? '700' : '600'}
                  color={assignmentMode === 'assigned' ? '$text' : '$muted'}
                  textAlign="center"
                >
                  {t('createSlot.assignmentAssigned')}
                </Text>
              </Button>
            </XStack>
            {assignmentMode === 'assigned' ? (
              <YStack gap="$2">
                <Button
                  paddingLeft="$5"
                  backgroundColor="$background"
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$4"
                  minHeight="$8"
                  justifyContent="flex-start"
                  onPress={() => setClientPickerOpen(true)}
                >
                  <Text color={selectedTrainerClient ? '$text' : '$muted'} fontWeight="600">
                    {selectedTrainerClient?.displayName?.trim()
                      ? selectedTrainerClient.displayName
                      : t('createSlot.assignmentSearchPlaceholder')}
                  </Text>
                </Button>
              </YStack>
            ) : null}
          </YStack>
          {assignmentMode === 'open' ? (
            <CreateSlotMultiSection
              multiEnabled={multiEnabled}
              multiCount={multiCount}
              onToggle={(nextValue) => {
                setMultiEnabled(nextValue);
                if (nextValue) {
                  setMultiCount(MULTI_COUNTS[0]);
                }
              }}
              onSelectCount={setMultiCount}
            />
          ) : null}
          {assignmentMode === 'open' ? (
            <YStack
              gap="$3"
              padding="$4"
              backgroundColor="$background"
              borderRadius="$5"
              borderWidth={1}
              borderColor="$border"
            >
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize="$4" fontWeight="700" color="$text">
                  {t('createSlot.groupTitle')}
                </Text>
                <Button
                  size="$3"
                  height={60}
                  onPress={() => {
                    if (!canCreateGroup) {
                      return;
                    }
                    const next = !groupEnabled;
                    setGroupEnabled(next);
                    if (next) {
                      setGroupSettingsOpen(true);
                    }
                  }}
                  disabled={!canCreateGroup}
                >
                  {groupEnabled ? t('common.enabled') : t('common.disabled')}
                </Button>
              </XStack>
              {!canCreateGroup ? (
                <Text fontSize="$3" color="$muted">
                  {t('createSlot.groupEnableProfileHint')}
                </Text>
              ) : null}
              {groupEnabled ? (
                <Text fontSize="$3" color="$muted">
                  {t('createSlot.groupHint')}
                </Text>
              ) : null}
            </YStack>
          ) : null}
        </YStack>
      </ScrollView>
      <CreateSlotGroupSettingsSheet
        open={groupSettingsOpen}
        onOpenChange={setGroupSettingsOpen}
        groupCapacityMin={groupCapacityMin}
        onGroupCapacityMinChange={setGroupCapacityMin}
        groupCapacityMax={groupCapacityMax}
        onGroupCapacityMaxChange={setGroupCapacityMax}
        groupAutoCancelIfMinNotReached={groupAutoCancelIfMinNotReached}
        onGroupAutoCancelIfMinNotReachedChange={setGroupAutoCancelIfMinNotReached}
      />
      <Sheet
        open={clientPickerOpen}
        onOpenChange={setClientPickerOpen}
        modal
        dismissOnSnapToBottom
        snapPoints={[75]}
      >
        <Sheet.Overlay
          animation="fast"
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
          backgroundColor="rgba(15, 23, 42, 0.2)"
        />
        <Sheet.Frame padding="$5" gap="$3" backgroundColor="$backgroundSoft">
          <Sheet.Handle />
          <Text fontSize="$5" fontWeight="700" color="$text">
            {t('createSlot.assignmentAssigned')}
          </Text>
          <FormInput
            height="50"
            placeholder={t('createSlot.assignmentSearchPlaceholder')}
            value={trainerClientSearch}
            onChangeText={setTrainerClientSearch}
          />
          {trainerClientsQuery.isLoading ? (
            <Text fontSize="$3" color="$muted">
              {t('common.loading')}
            </Text>
          ) : null}
          {!trainerClientsQuery.isLoading && filteredTrainerClients.length === 0 ? (
            <Text fontSize="$3" color="$muted">
              {t('createSlot.assignmentEmpty')}
            </Text>
          ) : null}
          <ScrollView maxHeight={360}>
            <YStack gap="$2" paddingBottom="$2">
              {filteredTrainerClients.map((client) => {
                const isSelected = client.id && client.id === selectedTrainerClientId;
                return (
                  <Button
                    key={client.id ?? `${client.displayName ?? 'client'}`}
                    backgroundColor={isSelected ? '$surfaceMuted' : '$background'}
                    borderWidth={1}
                    borderColor={isSelected ? '$accent' : '$border'}
                    borderRadius="$4"
                    paddingLeft="$4"
                    minHeight="$9"
                    justifyContent="flex-start"
                    onPress={() => {
                      setSelectedTrainerClientId(client.id ?? null);
                      setClientPickerOpen(false);
                    }}
                  >
                    <Text color="$text" fontWeight={isSelected ? '700' : '600'}>
                      {client.displayName ?? t('common.empty')}
                    </Text>
                  </Button>
                );
              })}
            </YStack>
          </ScrollView>
          <Button
            height="50"
            onPress={() => setClientPickerOpen(false)}
          >
            {t('common.close')}
          </Button>
        </Sheet.Frame>
      </Sheet>
      <CreateSlotFooter
        canSubmit={canSubmit}
        isPending={isCreating}
        multiEnabled={multiEnabled}
        slotCount={slotCount}
        onCreate={handleCreate}
      />
    </YStack>
  );
}
