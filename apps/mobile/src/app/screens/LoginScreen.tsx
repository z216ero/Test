import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useState } from 'react';
import { login, me } from '@api/authApi';
import { presentApiError } from '@api/ApiErrorPresenter';
import { ApiError } from '@api/core';
import { t } from '@i18n';
import { XStack } from 'tamagui';
import {
  AuthCard,
  AuthError,
  AuthField,
  AuthFooter,
  AuthHeader,
  AuthPrimaryButton,
  AuthScreen,
} from '@ui/authUi';
import { AppIcon } from '@ui/AppIcon';
import type { AuthStackParamList, RootStackParamList } from '@app/navigation/types';
import { getUserRole } from '@userRole';
import { useAppMutation } from '@query/hooks';
import { registerPushTokenIfPossible } from '@notifications/pushRegistration';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useAppMutation({
    mutationFn: async (payload: { email: string; password: string }) => {
      const response = await login({
        email: payload.email,
        password: payload.password,
      });

      if (!response.accessToken) {
        throw new ApiError(t('auth.errorMissingToken'));
      }

      const roleFromResponse = getUserRole(response.user?.role);
      const role = roleFromResponse ?? getUserRole((await me()).role);
      if (!role) {
        throw new ApiError(t('auth.errorMissingRole'));
      }

      try {
        await registerPushTokenIfPossible();
      } catch {
        // non-blocking
      }

      return role;
    },
    onSuccess: (role) => {
      const rootNavigation =
        navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
      rootNavigation?.reset({ index: 0, routes: [{ name: 'App', params: { role } }] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) {
        setError(t('auth.login.invalidCredentials'));
        return;
      }
      setError(presentApiError(err).message);
    },
  });

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError(t('auth.login.validationRequired'));
      return;
    }

    setError(null);

    try {
      await loginMutation.mutateAsync({
        email: email.trim(),
        password,
      });
    } catch {
      // handled in mutation callbacks
    }
  };

  return (
    <AuthScreen>
      <XStack justifyContent="center">
        <AppIcon name="user" size={28} color="$muted" />
      </XStack>
      <AuthHeader title={t('auth.login.title')} subtitle={t('auth.login.subtitle')} />
      <AuthCard>
        <AuthField
          label={t('auth.login.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder={t('common.emailPlaceholder')}
        />
        <AuthField
          label={t('auth.login.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder={t('common.passwordPlaceholder')}
        />
        {error ? <AuthError message={error} /> : null}
        <AuthPrimaryButton onPress={handleLogin} disabled={loginMutation.isPending}>
          {loginMutation.isPending ? t('auth.login.loading') : t('auth.login.cta')}
        </AuthPrimaryButton>
      </AuthCard>
      <AuthFooter
        text={t('common.noAccount')}
        actionText={t('auth.login.secondary')}
        onPress={() => navigation.navigate('Register')}
        variant="column"
      />
    </AuthScreen>
  );
}



