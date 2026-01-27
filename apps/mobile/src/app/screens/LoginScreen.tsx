import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useState } from 'react';
import { setAccessToken } from '../../auth/tokenStorage';
import { login } from '../../api/authApi';
import { ApiError, getUiErrorMessage } from '../../api/core';
import {
  AuthCard,
  AuthError,
  AuthField,
  AuthFooter,
  AuthHeader,
  AuthPrimaryButton,
  AuthScreen,
} from '../../ui/authUi';
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
    <AuthScreen>
      <AuthHeader title="Welcome back" subtitle="Log in to manage your bookings." />
      <AuthCard>
        <AuthField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <AuthField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Your password"
        />
        {error ? (
          <AuthError message={error} />
        ) : null}
        <AuthPrimaryButton onPress={handleLogin} disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Log in'}
        </AuthPrimaryButton>
      </AuthCard>
      <AuthFooter
        text="Don't have an account?"
        actionText="Create account"
        onPress={() => navigation.navigate('Register')}
        variant="column"
      />
    </AuthScreen>
  );
}
