import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { AuthUserDto } from '@generated/api';
import type { AppTabsParamList } from '@app/navigation/types';

export type HomeNavigation = BottomTabNavigationProp<AppTabsParamList, 'Home'>;

export type HomeMeState = {
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => Promise<unknown> | void;
};

export type HomeUser = AuthUserDto | null;


