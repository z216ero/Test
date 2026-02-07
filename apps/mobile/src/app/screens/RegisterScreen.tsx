import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Button, Text, XStack, YStack } from 'tamagui';
import { me, register } from '@api/authApi';
import { presentApiError } from '@api/ApiErrorPresenter';
import { ApiError } from '@api/core';
import { getGenderLookups, getRoleLookups, getSpecializationLookups } from '@api/lookupsApi';
import { t } from '@i18n';
import {
  AuthCard,
  AuthError,
  AuthField,
  AuthFooter,
  AuthHeader,
  AuthPrimaryButton,
  AuthScreen,
} from '@ui/authUi';
import type { AuthStackParamList, RootStackParamList } from '@app/navigation/types';
import { getUserRole } from '@userRole';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { registerPushTokenIfPossible } from '@notifications/pushRegistration';
import { getDefaultLookupCode } from '@app/utils/lookups';
import type { LookupItem } from '@api/lookupsApi';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const fallbackRoleOptions: LookupItem[] = [
  {
    code: 'Client',
    label: 'Client',
    isDefault: true,
    isTrainerRole: false,
    isClientRole: true,
  },
  {
    code: 'Trainer',
    label: 'Trainer',
    isDefault: false,
    isTrainerRole: true,
    isClientRole: false,
  },
];

const fallbackGenderOptions: LookupItem[] = [
  { code: 'Male', label: 'Male', isDefault: true, isAny: false },
  { code: 'Female', label: 'Female', isDefault: false, isAny: false },
];

const getRoleLabel = (code: string): string => {
  if (code === 'Trainer') {
    return t('auth.register.roleTrainer');
  }
  if (code === 'Client') {
    return t('auth.register.roleClient');
  }
  return code;
};

const getGenderLabel = (code: string): string => {
  if (code === 'Male') {
    return t('auth.register.genderMale');
  }
  if (code === 'Female') {
    return t('auth.register.genderFemale');
  }
  return code;
};

export function RegisterScreen({ navigation, route }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [cityName, setCityName] = useState('');
  const [districtName, setDistrictName] = useState('');
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [role, setRole] = useState('');
  const [gender, setGender] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [error, setError] = useState<string | null>(null);

  const rolesQuery = useAppQuery({
    queryKey: keys.lookups.roles(),
    queryFn: ({ signal }) => getRoleLookups({ signal }),
  });

  const gendersQuery = useAppQuery({
    queryKey: keys.lookups.genders(),
    queryFn: ({ signal }) => getGenderLookups({ signal }),
  });

  const specializationsQuery = useAppQuery({
    queryKey: keys.lookups.specializations(),
    queryFn: ({ signal }) => getSpecializationLookups({ signal }),
  });


  const roleOptions = useMemo(
    () => (rolesQuery.data?.length ? rolesQuery.data : fallbackRoleOptions),
    [rolesQuery.data]
  );
  const genderOptions = useMemo(
    () => {
      const filtered = (gendersQuery.data ?? []).filter((item) => !item.isAny);
      return filtered.length > 0 ? filtered : fallbackGenderOptions;
    },
    [gendersQuery.data]
  );
  const specializationOptions = useMemo(
    () => specializationsQuery.data ?? [],
    [specializationsQuery.data]
  );

  const defaultRole = useMemo(() => getDefaultLookupCode(roleOptions), [roleOptions]);
  const defaultGender = useMemo(() => getDefaultLookupCode(genderOptions), [genderOptions]);
  const defaultSpecialization = useMemo(
    () => getDefaultLookupCode(specializationOptions),
    [specializationOptions]
  );

  useEffect(() => {
    if (!role && defaultRole) {
      setRole(defaultRole);
    }
  }, [defaultRole, role]);

  useEffect(() => {
    if (!gender && defaultGender) {
      setGender(defaultGender);
    }
  }, [defaultGender, gender]);

  useEffect(() => {
    if (!specialization && defaultSpecialization) {
      setSpecialization(defaultSpecialization);
    }
  }, [defaultSpecialization, specialization]);

  useEffect(() => {
    const selection = route.params?.locationSelection;
    if (!selection) {
      return;
    }
    if (selection.cityName) {
      setCityName(selection.cityName ?? '');
      setSelectedCityId(typeof selection.cityId === 'number' ? selection.cityId : null);
      setDistrictName('');
    }
    if (selection.districtName) {
      setDistrictName(selection.districtName ?? '');
    }
    navigation.setParams({ locationSelection: undefined });
  }, [navigation, route.params?.locationSelection]);

  const isTrainer = useMemo(
    () => roleOptions.find((option) => option.code === role)?.isTrainerRole ?? false,
    [roleOptions, role]
  );

  const specializationValue = useMemo(
    () => (isTrainer && specialization ? [specialization] : undefined),
    [isTrainer, specialization]
  );

  const registerMutation = useAppMutation({
    mutationFn: async (payload: {
      email: string;
      password: string;
      name: string;
      cityName: string;
      districtName?: string | null;
      role: string;
      gender: string;
      specializations?: string[];
    }) => {
      const response = await register({
        email: payload.email,
        password: payload.password,
        name: payload.name,
        cityName: payload.cityName,
        districtName: payload.districtName ?? null,
        role: payload.role,
        gender: payload.gender,
        specializations: payload.specializations,
      });

      if (!response.accessToken) {
        throw new ApiError(t('auth.errorMissingToken'));
      }

      const roleFromResponse = getUserRole(response.user?.role);
      const resolvedRole = roleFromResponse ?? getUserRole((await me()).role);
      if (!resolvedRole) {
        throw new ApiError(t('auth.errorMissingRole'));
      }

      try {
        await registerPushTokenIfPossible();
      } catch {
        // non-blocking
      }

      return resolvedRole;
    },
    onSuccess: (resolvedRole) => {
      const rootNavigation =
        navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
      rootNavigation?.reset({
        index: 0,
        routes: [{ name: 'App', params: { role: resolvedRole } }],
      });
    },
    onError: (err) => {
      setError(presentApiError(err).message);
    },
  });

  const handleRegister = async () => {
    if (!email.trim() || !password || !name.trim() || !cityName.trim()) {
      setError(t('auth.register.validationRequired'));
      return;
    }

    if (!role || !gender) {
      setError(t('errors.generic'));
      return;
    }

    setError(null);

    try {
      await registerMutation.mutateAsync({
        email: email.trim(),
        password,
        name: name.trim(),
        cityName: cityName.trim(),
        districtName: districtName.trim() || null,
        role,
        gender,
        specializations: specializationValue,
      });
    } catch {
      // handled in mutation callbacks
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
            {t('auth.register.city')}
          </Text>
          <Button
            backgroundColor="$background"
            borderRadius="$4"
            borderWidth={1}
            borderColor="$border"
            height={44}
            paddingHorizontal="$3"
            justifyContent="flex-start"
            alignItems="center"
            onPress={() => navigation.navigate('LocationSearch', { mode: 'city', returnTo: 'Register' })}
          >
            <Text color={cityName ? '$text' : '$muted'} width="100%" textAlign="left">
              {cityName || t('auth.register.cityPlaceholder')}
            </Text>
          </Button>
        </YStack>
        <YStack gap="$2">
          <Text fontSize="$3" color="$muted">
            {t('auth.register.district')}
          </Text>
          <Button
            backgroundColor="$background"
            borderRadius="$4"
            borderWidth={1}
            borderColor="$border"
            height={44}
            paddingHorizontal="$3"
            justifyContent="flex-start"
            alignItems="center"
            onPress={() => {
              if (!selectedCityId) {
                setError(t('auth.register.selectCityFirst'));
                return;
              }
              navigation.navigate('LocationSearch', {
                mode: 'district',
                cityId: selectedCityId,
                cityName,
                returnTo: 'Register',
              });
            }}
          >
            <Text color={districtName ? '$text' : '$muted'} width="100%" textAlign="left">
              {districtName || t('auth.register.districtPlaceholder')}
            </Text>
          </Button>
        </YStack>
        <YStack gap="$2">
          <Text fontSize="$3" color="$muted">
            {t('auth.register.role')}
          </Text>
          <XStack gap="$2" padding="$2" backgroundColor="$backgroundSoft" borderRadius="$3">
            {roleOptions.map((item) => {
              const isSelected = role === item.code;
              return (
                <Button
                  key={item.code}
                  size="$3"
                  backgroundColor={isSelected ? '$background' : '$backgroundSoft'}
                  color="$text"
                  fontWeight={isSelected ? '700' : '400'}
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$3"
                  onPress={() => setRole(item.code)}
                  flex={1}
                  minHeight="$10"
                >
                  {getRoleLabel(item.code)}
                </Button>
              );
            })}
          </XStack>
        </YStack>
        <YStack gap="$2">
          <Text fontSize="$3" color="$muted">
            {t('profile.personal.genderUserLabel')}
          </Text>
          <XStack gap="$2" padding="$2" backgroundColor="$backgroundSoft" borderRadius="$3">
            {genderOptions.map((item) => {
              const isSelected = gender === item.code;
              return (
                <Button
                  key={item.code}
                  size="$3"
                  backgroundColor={isSelected ? '$background' : '$backgroundSoft'}
                  color="$text"
                  fontWeight={isSelected ? '700' : '400'}
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$3"
                  onPress={() => setGender(item.code)}
                  flex={1}
                  minHeight="$10"
                >
                  {getGenderLabel(item.code)}
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
              {specializationOptions.map((item) => {
                const isSelected = specialization === item.code;
                return (
                  <Button
                    key={item.code}
                    size="$3"
                    backgroundColor={isSelected ? '$background' : '$surfaceMuted'}
                    color="$text"
                    fontWeight={isSelected ? '700' : '400'}
                    borderWidth={1}
                    borderColor="$border"
                    borderRadius="$3"
                    onPress={() => setSpecialization(item.code)}
                    minHeight="$9"
                  >
                    {item.label}
                  </Button>
                );
              })}
            </XStack>
          </YStack>
        ) : null}
        {error ? <AuthError message={error} /> : null}
        <AuthPrimaryButton onPress={handleRegister} disabled={registerMutation.isPending}>
          {registerMutation.isPending ? t('auth.register.loading') : t('auth.register.cta')}
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
