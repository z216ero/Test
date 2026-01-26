import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useState } from 'react';
import { Button, Input, Text, YStack } from 'tamagui';
import { setAccessToken } from '../../auth/tokenStorage';
import { login } from '../../api/authApi';
import { ApiError, getUiErrorMessage } from '../../api/core';
import {
  formInputProps,
  primaryButtonProps,
  secondaryButtonProps,
} from '../../ui/formDefaults';
import type { AuthStackParamList, RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await login({
        email: email.trim(),
        password,
      });

      if (!response.accessToken) {
        throw new ApiError('Missing access token.');
      }

      await setAccessToken(response.accessToken);
      const rootNavigation =
        navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
      rootNavigation?.reset({ index: 0, routes: [{ name: 'App' }] });
    } catch (err) {
      setError(getUiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <YStack flex={1} padding="$6" gap="$4" backgroundColor="$background">
      <Text fontSize="$7" fontWeight="700" color="$text">
        Welcome back
      </Text>
      <YStack gap="$2">
        <Text fontSize="$3" color="$text">
          Email
        </Text>
        <Input
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
          {...formInputProps}
        />
      </YStack>
      <YStack gap="$2">
        <Text fontSize="$3" color="$text">
          Password
        </Text>
        <Input
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Your password"
          {...formInputProps}
        />
      </YStack>
      {error ? (
        <Text fontSize="$3" color="$primary">
          {error}
        </Text>
      ) : null}
      <Button
        size="$4"
        backgroundColor="$primary"
        color="$primaryText"
        onPress={handleLogin}
        disabled={isSubmitting}
        {...primaryButtonProps}
      >
        {isSubmitting ? 'Signing in...' : 'Login'}
      </Button>
      <Button
        size="$3"
        onPress={() => navigation.navigate('Register')}
        {...secondaryButtonProps}
      >
        Create account
      </Button>
    </YStack>
  );
}
