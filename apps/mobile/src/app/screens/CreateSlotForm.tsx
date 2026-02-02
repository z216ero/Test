import type { QueryKey } from '@tanstack/react-query';
import { ScrollView } from '@tamagui/scroll-view';
import { YStack } from 'tamagui';
import type {
  CreateSlotRequest,
  GetTrainersTrainerIdSlotsParams,
  SlotDto,
} from '../../generated/api';
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
    datePreset,
    setDatePreset,
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
    pickerVisible,
    setPickerVisible,
    handleDateChange,
    openDatePicker,
    todayDate,
    tomorrowDate,
    isCreating,
  } = useCreateSlotFormState({
    buildQueryKey,
    loadSlots,
    createSlot,
    onAfterSuccess,
    initialDateIsoLocal,
  });

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <ScrollView>
        <YStack padding="$6" gap="$5" paddingBottom="$8">
          <CreateSlotHeader title={title} onBack={onBack} />
          <CreateSlotDateSection
            datePreset={datePreset}
            selectedDate={selectedDate}
            todayDate={todayDate}
            tomorrowDate={tomorrowDate}
            pickerVisible={pickerVisible}
            onSelectToday={() => {
              setSelectedDate(todayDate);
              setDatePreset('today');
            }}
            onSelectTomorrow={() => {
              setSelectedDate(tomorrowDate);
              setDatePreset('tomorrow');
            }}
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
        </YStack>
      </ScrollView>
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
