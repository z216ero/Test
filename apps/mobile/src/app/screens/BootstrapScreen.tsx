import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Button, Text, YStack } from 'tamagui';
import { clearSession, getAccessToken } from '../../auth/tokenStorage';
import { me } from '../../api/authApi';
import { getUiErrorMessage } from '../../api/core';
import { t } from '../../i18n';
import { secondaryButtonProps } from '../../ui/formDefaults';
import { getUserRole } from '../utils/userRole';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Bootstrap'>;

export function BootstrapScreen({ navigation }: Props) {
  const [error, setError] = useState<string | null>(null);

  const goToAuth = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
  };

  const goToApp = (role: NonNullable<RootStackParamList['App']>['role']) => {
    navigation.reset({ index: 0, routes: [{ name: 'App', params: { role } }] });
  };

  const bootstrap = async () => {
    setError(null);
    try {
      const token = await getAccessToken();
      if (token) {
        const meData = await me();
        const role = getUserRole(meData.role);
        if (role) {
          goToApp(role);
          return;
        }
        console.warn('Unknown role from /auth/me', meData.role);
        return;
      }
      goToAuth();
    } catch (err) {
      console.error('Bootstrap failed', err);
      setError(getUiErrorMessage(err));
      await clearSession();
      goToAuth();
    }
  };

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$4"
      padding="$6"
      backgroundColor="$background"
    >
      <Text fontSize="$6" fontWeight="700" color="$text">
        {t('common.loading')}
      </Text>
      {error ? (
        <YStack gap="$3" alignItems="center">
          <Text fontSize="$3" color="$primary" textAlign="center">
            {error}
          </Text>
          <Button
            size="$3"
            backgroundColor="$primary"
            color="$primaryText"
            onPress={bootstrap}
            {...secondaryButtonProps}
          >
            {t('common.retry')}
          </Button>
        </YStack>
      ) : null}
    </YStack>
  );
}
