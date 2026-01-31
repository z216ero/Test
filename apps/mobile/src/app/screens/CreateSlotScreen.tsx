import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { unwrap } from '../../api/core';
import { t } from '../../i18n';
import { keys } from '../../query/keys';
import { CreateSlotForm } from './CreateSlotForm';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'CreateSlot'>;

export function CreateSlotScreen({ route, navigation }: Props) {
  const { trainerId } = route.params;
  const queryClient = useQueryClient();

  const handleSuccess = () => {
    queryClient.invalidateQueries({
      queryKey: keys.trainers.slots(trainerId),
    });
    queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
    navigation.goBack();
  };

  return (
    <CreateSlotForm
      title={t('createSlot.title')}
      onBack={() => navigation.goBack()}
      onAfterSuccess={handleSuccess}
      buildQueryKey={(params) => keys.trainers.slots(trainerId, params)}
      loadSlots={async (params, options) => {
        const response = await apiClient.getTrainersTrainerIdSlots(
          trainerId,
          params,
          options
        );
        return unwrap(response, t('errors.generic'));
      }}
      createSlot={async (payload, options) => {
        const response = await apiClient.postTrainersTrainerIdSlots(
          trainerId,
          payload,
          options
        );
        return unwrap(response, t('errors.generic'));
      }}
    />
  );
}
