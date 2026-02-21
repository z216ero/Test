import { useCallback, useState } from 'react';
import type { SlotDto } from '@generated/api';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ScheduleStackParamList } from '@app/navigation/types';
import { markSlotHighlightSeen } from '@notifications/pushIndicators';

type UseScheduleSheetStateArgs = {
  navigation: NativeStackNavigationProp<ScheduleStackParamList, 'ScheduleHome'>;
};

export function useScheduleSheetState({ navigation }: UseScheduleSheetStateArgs) {
  const [activeSlot, setActiveSlot] = useState<SlotDto | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reassignSheetOpen, setReassignSheetOpen] = useState(false);
  const [reassignSlot, setReassignSlot] = useState<SlotDto | null>(null);
  const [reassignSearch, setReassignSearch] = useState('');

  const openSlot = useCallback((slot: SlotDto) => {
    if (!slot.id) {
      return;
    }
    if ((slot.slotType ?? '').toLowerCase() === 'group') {
      navigation.navigate('SlotDetails', { slot });
      return;
    }
    markSlotHighlightSeen(slot.id).catch(() => {});
    setActiveSlot(slot);
    setSheetOpen(true);
  }, [navigation]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setActiveSlot(null);
  }, []);

  const closeReassignSheet = useCallback(() => {
    setReassignSheetOpen(false);
    setReassignSlot(null);
    setReassignSearch('');
  }, []);

  return {
    activeSlot,
    setActiveSlot,
    sheetOpen,
    setSheetOpen,
    reassignSheetOpen,
    setReassignSheetOpen,
    reassignSlot,
    setReassignSlot,
    reassignSearch,
    setReassignSearch,
    openSlot,
    closeSheet,
    closeReassignSheet,
  };
}

