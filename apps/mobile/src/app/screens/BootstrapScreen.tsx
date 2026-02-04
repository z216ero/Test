import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, YStack } from 'tamagui';
import { clearSession, getAccessToken } from '@auth/tokenStorage';
import { me } from '@api/authApi';
import { ApiError } from '@api/core';
import { ApiHttpError } from '@api/fetcher';
import { presentApiError } from '@api/ApiErrorPresenter';
import { t } from '@i18n';
import { useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { ErrorState } from '@ui/states/ErrorState';
import { LoadingState } from '@ui/states/LoadingState';
import { getUserRole } from '@userRole';
import { registerPushTokenIfPossible } from '@notifications/pushRegistration';
import type { RootStackParamList } from '@app/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Bootstrap'>;

export function BootstrapScreen({ navigation }: Props) {
  const [error, setError] = useState<string | null>(null);

  const goToAuth = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
  }, [navigation]);

  const goToApp = useCallback((role: NonNullable<RootStackParamList['App']>['role']) => {
    navigation.reset({ index: 0, routes: [{ name: 'App', params: { role } }] });
  }, [navigation]);

  const bootstrapQuery = useAppQuery({
    queryKey: keys.auth.bootstrap(),
    retry: false,
    queryFn: async ({ signal }) => {
      const token = await getAccessToken();
      if (!token) {
        return { target: 'auth' as const };
      }

      try {
        const meData = await me({ signal });
        const role = getUserRole(meData.role);
        if (!role) {
          return { target: 'unknown' as const };
        }
        registerPushTokenIfPossible().catch(() => {});
        return { target: 'app' as const, role };
      } catch (err) {
        if (
          (err instanceof ApiError || err instanceof ApiHttpError)
          && err.status === 401
        ) {
          return { target: 'auth' as const };
        }
        throw err;
      }
    },
  });

  useEffect(() => {
    if (!bootstrapQuery.data) {
      return;
    }

    if (bootstrapQuery.data.target === 'auth') {
      clearSession().finally(() => {
        goToAuth();
      });
      return;
    }

    if (bootstrapQuery.data.target === 'app') {
      goToApp(bootstrapQuery.data.role);
      return;
    }

    setError(t('auth.errorMissingRole'));
  }, [bootstrapQuery.data, goToAuth, goToApp]);

  const errorMessage = useMemo(() => {
    if (error) {
      return error;
    }
    if (bootstrapQuery.error) {
      return presentApiError(bootstrapQuery.error).message;
    }
    return null;
  }, [bootstrapQuery.error, error]);

  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$4"
      padding="$6"
      backgroundColor="$background"
    >
      {bootstrapQuery.isLoading ? (
        <LoadingState />
      ) : errorMessage ? (
        <ErrorState
          message={errorMessage}
          onRetry={() => {
            setError(null);
            bootstrapQuery.refetch();
          }}
        />
      ) : (
        <Text fontSize="$6" fontWeight="700" color="$text">
          {t('common.loading')}
        </Text>
      )}
    </YStack>
  );
}



