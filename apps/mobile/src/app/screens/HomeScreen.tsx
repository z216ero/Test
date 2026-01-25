import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Button, Input, Text, XStack, YStack } from 'tamagui';
import { apiClient } from '../../api/client';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const [clientId, setClientId] = useState(
    '00000000-0000-0000-0000-000000000001'
  );
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      try {
        const response = await apiClient.getHealth();
        if (!isMounted) {
          return;
        }
        if (response.status !== 200) {
          throw new Error('Unexpected health response.');
        }
        setHealthStatus(response.data.status);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        setHealthError(message);
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
        >
          Client flow
        </Button>
        <Button
          flex={1}
          size="$4"
          backgroundColor="$primary"
          color="$primaryText"
          onPress={() => navigation.navigate('Trainers', { mode: 'trainer' })}
        >
          Trainer flow
        </Button>
      </XStack>
    </YStack>
  );
}
