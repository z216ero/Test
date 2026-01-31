import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useQueryClient } from '@tanstack/react-query';
import { t } from '../../i18n';
import { createSlot, getMyTrainerSlots } from '../../api/trainerSlotsApi';
import { keys } from '../../query/keys';
import { CreateSlotForm } from './CreateSlotForm';
import type { TrainerTabsParamList } from '../navigation/types';

type Props = BottomTabScreenProps<TrainerTabsParamList, 'CreateSlot'>;

export function CreateSlotTabScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Schedule');
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
    queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
    navigation.navigate('Schedule');
  };

  return (
    <CreateSlotForm
      title={t('createSlot.title')}
      onBack={handleBack}
      onAfterSuccess={handleSuccess}
      buildQueryKey={(params) => keys.trainerSlots.mine(params)}
      loadSlots={(params, options) => getMyTrainerSlots(params, options)}
      createSlot={(payload, options) => createSlot(payload, options)}
    />
  );
}
