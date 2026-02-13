import type { QueryKey } from '@tanstack/react-query';
import { Sheet } from '@tamagui/sheet';
import { ScrollView } from '@tamagui/scroll-view';
import { Button, Input, Switch, Text, XStack, YStack } from 'tamagui';
import type {
  CreateSlotRequest,
  GetTrainersTrainerIdSlotsParams,
  SlotDto,
} from '@generated/api';
import { getMe } from '@api/homeApi';
import { useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { t } from '@i18n';
import { CreateSlotDateSection } from './CreateSlotDateSection';
import { CreateSlotFooter } from './CreateSlotFooter';
import { CreateSlotHeader } from './CreateSlotHeader';
import { CreateSlotMultiSection } from './CreateSlotMultiSection';
import { CreateSlotTimeSection } from './CreateSlotTimeSection';
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
};

export function CreateSlotForm({
  title,
  onBack,
  onAfterSuccess,
  buildQueryKey,
  loadSlots,
  createSlot,
  initialDateIsoLocal,
}: CreateSlotFormProps) {
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
        </YStack>
      </ScrollView>
      <Sheet
        open={groupSettingsOpen}
        onOpenChange={setGroupSettingsOpen}
        modal
        dismissOnSnapToBottom
        snapPoints={[50]}
      >
        <Sheet.Overlay
          animation="fast"
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
          backgroundColor="rgba(15, 23, 42, 0.2)"
        />
        <Sheet.Frame padding="$5" gap="$4" backgroundColor="$backgroundSoft">
          <Sheet.Handle />
          <Text fontSize="$5" fontWeight="700" color="$text">
            {t('createSlot.groupSettingsTitle')}
          </Text>
          <YStack gap="$2">
            <Text fontSize="$3" color="$text">{t('createSlot.groupCapacityMinLabel')}</Text>
            <Input
              height="50"
              keyboardType="numeric"
              value={String(groupCapacityMin)}
              onChangeText={(value: string) => {
                const parsed = Number(value.replace(/\D/g, ''));
                if (Number.isNaN(parsed)) {
                  setGroupCapacityMin(2);
                  return;
                }
                setGroupCapacityMin(parsed);
              }}
            />
          </YStack>
          <YStack gap="$2">
            <Text fontSize="$3" color="$text">{t('createSlot.groupCapacityMaxLabel')}</Text>
            <Input
              height="50"
              keyboardType="numeric"
              value={String(groupCapacityMax)}
              onChangeText={(value: string) => {
                const parsed = Number(value.replace(/\D/g, ''));
                if (Number.isNaN(parsed)) {
                  setGroupCapacityMax(10);
                  return;
                }
                setGroupCapacityMax(parsed);
              }}
            />
          </YStack>
          <XStack alignItems="center" justifyContent="space-between" gap="$3">
            <YStack flex={1} gap="$1">
              <Text fontSize="$3" color="$text">
                {t('createSlot.groupAutoCancelToggle')}
              </Text>
              <Text fontSize="$2" color="$muted">
                {t('createSlot.groupAutoCancelHint', { minutes: 40 })}
              </Text>
            </YStack>
            <Switch
              size="$6"
              checked={groupAutoCancelIfMinNotReached}
              onCheckedChange={setGroupAutoCancelIfMinNotReached}
              backgroundColor={groupAutoCancelIfMinNotReached ? '$accent' : '$surfaceMuted'}
            >
              <Switch.Thumb
                backgroundColor="$background"
                borderWidth={1}
                borderColor="$border"
              />
            </Switch>
          </XStack>
          <Button
            height="50"
            onPress={() => setGroupSettingsOpen(false)}
            disabled={groupCapacityMin < 2 || groupCapacityMax > 100 || groupCapacityMin > groupCapacityMax}
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
