import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { getMe } from '@api/homeApi';
import { useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import type { AppTabsParamList } from '@app/navigation/types';
import { ClientHomeScreen } from '@app/screens/home/ClientHomeScreen';
import { TrainerHomeScreen } from '@app/screens/home/TrainerHomeScreen';

type Props = BottomTabScreenProps<AppTabsParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const meQuery = useAppQuery({
    queryKey: keys.auth.me(),
    queryFn: ({ signal }) => getMe({ signal }),
  });

  const me = meQuery.data ?? null;
  const role = me?.role === 'Trainer' ? 'Trainer' : 'Client';
  const meState = {
    isLoading: meQuery.isLoading,
    isFetching: meQuery.isFetching,
    error: meQuery.error,
    refetch: meQuery.refetch,
  };

  return role === 'Trainer' ? (
    <TrainerHomeScreen navigation={navigation} me={me} meState={meState} />
  ) : (
    <ClientHomeScreen navigation={navigation} me={me} meState={meState} />
  );
}

