import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Button, Input, Text, XStack, YStack } from 'tamagui';
import { clearAccessToken } from '../../auth/tokenStorage';
import { apiClient } from '../../api/client';
import { logout } from '../../api/authApi';
import { getUiErrorMessage, unwrap } from '../../api/core';
import {
  formInputProps,
  primaryButtonProps,
  secondaryButtonProps,
} from '../../ui/formDefaults';
import type { AppStackParamList, RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const [clientId, setClientId] = useState(
    '00000000-0000-0000-0000-000000000001'
  );
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      try {
        const response = await apiClient.getHealth();
        const data = unwrap(response, 'Unable to reach API.');
        if (!isMounted) {
          return;
        }
        setHealthStatus(data.status);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setHealthError(getUiErrorMessage(error));
      } finally {
        if (isMounted) {
          setIsHealthLoading(false);
        }
      }
    };

    checkHealth();

    return () => {
      isMounted = false;
    };
  }, []);

  const healthText = isHealthLoading
    ? 'Checking API...'
    : healthError
      ? `API error: ${healthError}`
      : `API: ${healthStatus?.toUpperCase() ?? 'OK'}`;

  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$4"
      padding="$6"
      backgroundColor="$background"
    >
      <Text fontSize="$8" fontWeight="700" color="$text">
        Fitness App
      </Text>
      <Text fontSize="$3" color={healthError ? '$primary' : '$muted'}>
        {healthText}
      </Text>
      <YStack width="100%" gap="$2">
        <Text fontSize="$3" color="$text">
          Client ID (for booking)
        </Text>
        <Input
          value={clientId}
          onChangeText={setClientId}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="00000000-0000-0000-0000-000000000001"
          {...formInputProps}
        />
        <Text fontSize="$2" color="$muted">
          Use any GUID for now (no auth yet).
        </Text>
      </YStack>
      <XStack width="100%" gap="$3">
        <Button
          flex={1}
          size="$4"
          backgroundColor="$primary"
          color="$primaryText"
          onPress={() =>
            navigation.navigate('Trainers', { mode: 'client', clientId })
          }
          {...primaryButtonProps}
        >
          Client flow
        </Button>
        <Button
          flex={1}
          size="$4"
          backgroundColor="$primary"
          color="$primaryText"
          onPress={() => navigation.navigate('Trainers', { mode: 'trainer' })}
          {...primaryButtonProps}
        >
          Trainer flow
        </Button>
      </XStack>
      <Button
        size="$3"
        onPress={async () => {
          try {
            setAuthError(null);
            await logout();
          } catch (error) {
            setAuthError(getUiErrorMessage(error));
          } finally {
            await clearAccessToken();
            const rootNavigation =
              navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
            rootNavigation?.reset({
              index: 0,
              routes: [{ name: 'Auth' }],
            });
          }
        }}
        {...secondaryButtonProps}
      >
        Logout
      </Button>
      {authError ? (
        <Text fontSize="$3" color="$primary" textAlign="center">
          {authError}
        </Text>
      ) : null}
    </YStack>
  );
}
