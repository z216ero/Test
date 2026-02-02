import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { t } from '../../i18n';
import { createSlot, getMyTrainerSlots } from '../../api/trainerSlotsApi';
import { keys } from '../../query/keys';
import { CreateSlotForm } from './CreateSlotForm';
import type { TrainerTabsParamList } from '../navigation/types';

type Props = BottomTabScreenProps<TrainerTabsParamList, 'CreateSlot'>;

export function CreateSlotTabScreen({ navigation, route }: Props) {
  const queryClient = useQueryClient();
  const initialDateIsoLocal = route.params?.initialDateIsoLocal;

  useEffect(() => {
    if (initialDateIsoLocal) {
      navigation.setParams({ initialDateIsoLocal: undefined });
    }
  }, [initialDateIsoLocal, navigation]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Schedule', { screen: 'ScheduleHome' });
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
    queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
    navigation.navigate('Schedule', { screen: 'ScheduleHome' });
  };

  return (
    <CreateSlotForm
      title={t('createSlot.title')}
      onBack={handleBack}
      onAfterSuccess={handleSuccess}
      buildQueryKey={(params) => keys.trainerSlots.mine(params)}
      loadSlots={(params, options) => getMyTrainerSlots(params, options)}
      createSlot={(payload, options) => createSlot(payload, options)}
      initialDateIsoLocal={initialDateIsoLocal}
    />
  );
}
