import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useState } from 'react';
import { login, me } from '../../api/authApi';
import { ApiError, getUiErrorMessage } from '../../api/core';
import { t } from '../../i18n';
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
import { getUserRole } from '../utils/userRole';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError(t('auth.login.validationRequired'));
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
        throw new ApiError(t('auth.errorMissingToken'));
      }

      const roleFromResponse = getUserRole(response.user?.role);
      const role = roleFromResponse ?? getUserRole((await me()).role);
      if (!role) {
        throw new ApiError(t('auth.errorMissingRole'));
      }

      const rootNavigation =
        navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
      rootNavigation?.reset({ index: 0, routes: [{ name: 'App', params: { role } }] });
    } catch (err) {
      setError(getUiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreen>
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
        <AuthPrimaryButton onPress={handleLogin} disabled={isSubmitting}>
          {isSubmitting ? t('auth.login.loading') : t('auth.login.cta')}
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
