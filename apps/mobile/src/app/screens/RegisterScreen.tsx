import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Button, Text, XStack, YStack } from 'tamagui';
import { me, register } from '../../api/authApi';
import { ApiError, getUiErrorMessage } from '../../api/core';
import { t } from '../../i18n';
import type { TranslationKey } from '../../i18n';
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

const SPECIALIZATIONS: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: 'Strength', labelKey: 'auth.register.specializationStrength' },
  { value: 'Mobility', labelKey: 'auth.register.specializationMobility' },
  { value: 'Yoga', labelKey: 'auth.register.specializationYoga' },
  { value: 'Pilates', labelKey: 'auth.register.specializationPilates' },
  { value: 'HIIT', labelKey: 'auth.register.specializationHiit' },
];

type Role = 'Trainer' | 'Client';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('Client');
  const [specialization, setSpecialization] = useState(SPECIALIZATIONS[0].value);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTrainer = role === 'Trainer';
  const specializationValue = useMemo(
    () => (isTrainer ? specialization : undefined),
    [isTrainer, specialization]
  );

  const handleRegister = async () => {
    if (!email.trim() || !password || !name.trim()) {
      setError(t('auth.register.validationRequired'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await register({
        email: email.trim(),
        password,
        name: name.trim(),
        role,
        specialization: specializationValue,
      });

      if (!response.accessToken) {
        throw new ApiError(t('auth.errorMissingToken'));
      }

      const roleFromResponse = getUserRole(response.user?.role);
      const resolvedRole = roleFromResponse ?? getUserRole((await me()).role);
      if (!resolvedRole) {
        throw new ApiError(t('auth.errorMissingRole'));
      }

      const rootNavigation =
        navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
      rootNavigation?.reset({
        index: 0,
        routes: [{ name: 'App', params: { role: resolvedRole } }],
      });
    } catch (err) {
      setError(getUiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreen>
      <AuthHeader
        title={t('auth.register.title')}
        subtitle={t('auth.register.subtitle')}
      />
      <AuthCard>
        <AuthField
          label={t('auth.register.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder={t('common.emailPlaceholder')}
        />
        <AuthField
          label={t('auth.register.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder={t('common.passwordCreatePlaceholder')}
        />
        <AuthField
          label={t('auth.register.name')}
          value={name}
          onChangeText={setName}
          placeholder={t('common.namePlaceholder')}
        />
        <YStack gap="$2">
          <Text fontSize="$3" color="$muted">
            {t('auth.register.role')}
          </Text>
          <XStack gap="$2" padding="$2" backgroundColor="$backgroundSoft" borderRadius="$3">
            {(['Client', 'Trainer'] as Role[]).map((item) => {
              const isSelected = role === item;
              return (
                <Button
                  key={item}
                  size="$3"
                  backgroundColor={isSelected ? '$background' : '$backgroundSoft'}
                  color="$text"
                  fontWeight={isSelected ? '700' : '400'}
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$3"
                  onPress={() => setRole(item)}
                  flex={1}
                >
                  {item === 'Client' ? t('auth.register.roleClient') : t('auth.register.roleTrainer')}
                </Button>
              );
            })}
          </XStack>
        </YStack>
        {isTrainer ? (
          <YStack gap="$2">
            <Text fontSize="$3" color="$muted">
              {t('auth.register.specialization')}
            </Text>
            <XStack gap="$2" flexWrap="wrap">
              {SPECIALIZATIONS.map((item) => {
                const isSelected = specialization === item.value;
                return (
                  <Button
                    key={item.value}
                    size="$3"
                    backgroundColor={isSelected ? '$background' : '$surfaceMuted'}
                    color="$text"
                    fontWeight={isSelected ? '700' : '400'}
                    borderWidth={1}
                    borderColor="$border"
                    borderRadius="$3"
                    onPress={() => setSpecialization(item.value)}
                  >
                    {t(item.labelKey)}
                  </Button>
                );
              })}
            </XStack>
          </YStack>
        ) : null}
        {error ? <AuthError message={error} /> : null}
        <AuthPrimaryButton onPress={handleRegister} disabled={isSubmitting}>
          {isSubmitting ? t('auth.register.loading') : t('auth.register.cta')}
        </AuthPrimaryButton>
      </AuthCard>
      <AuthFooter
        text={t('common.alreadyHaveAccount')}
        actionText={t('auth.register.secondary')}
        onPress={() => navigation.navigate('Login')}
      />
    </AuthScreen>
  );
}
