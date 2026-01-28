import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Button, Text, YStack } from 'tamagui';
import { clearSession, getAccessToken } from '../../auth/tokenStorage';
import { me } from '../../api/authApi';
import { getUiErrorMessage } from '../../api/core';
import { secondaryButtonProps } from '../../ui/formDefaults';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Bootstrap'>;

export function BootstrapScreen({ navigation }: Props) {
  const [error, setError] = useState<string | null>(null);

  const goToAuth = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
  };

  const goToApp = () => {
    navigation.reset({ index: 0, routes: [{ name: 'App' }] });
  };

  const bootstrap = async () => {
    setError(null);
    try {
      const token = await getAccessToken();
      if (token) {
        await me();
        goToApp();
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
        Loading session...
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
            Retry
          </Button>
        </YStack>
      ) : null}
    </YStack>
  );
}
