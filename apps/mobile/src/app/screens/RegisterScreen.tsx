import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Text, YStack } from 'tamagui';
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
import { SelectFieldButton } from '@ui/components';
import { normalizeRussianPhoneInput, russianPhoneToE164 } from '@utils/phone';
import {
  fallbackGenderOptions,
  fallbackRoleOptions,
  getRegisterApiFieldErrors,
  type RegisterField,
  type RegisterFieldErrors,
  validateRegisterForm,
} from './register/registerFormValidation';
import { RegisterLookupsSection } from './register/ui/RegisterLookupsSection';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation, route }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [cityName, setCityName] = useState('');
  const [districtName, setDistrictName] = useState('');
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [role, setRole] = useState('');
  const [gender, setGender] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [didAttemptSubmit, setDidAttemptSubmit] = useState(false);

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

  const roleOptions = useMemo(() => {
    const source = rolesQuery.data?.length ? rolesQuery.data : fallbackRoleOptions;
    return [...source].sort((a, b) => {
      const getOrder = (item: LookupItem) => {
        if (item.code === 'Client' || item.isClientRole) {
          return 0;
        }
        if (item.code === 'Trainer' || item.isTrainerRole) {
          return 1;
        }
        return 2;
      };
      return getOrder(a) - getOrder(b);
    });
  }, [rolesQuery.data]);
  const genderOptions = useMemo(() => {
    const filtered = (gendersQuery.data ?? []).filter((item) => !item.isAny);
    return filtered.length > 0 ? filtered : fallbackGenderOptions;
  }, [gendersQuery.data]);
  const specializationOptions = useMemo(() => specializationsQuery.data ?? [], [specializationsQuery.data]);

  const defaultRole = useMemo(() => getDefaultLookupCode(roleOptions), [roleOptions]);
  const defaultGender = useMemo(() => getDefaultLookupCode(genderOptions), [genderOptions]);
  const defaultSpecialization = useMemo(() => getDefaultLookupCode(specializationOptions), [specializationOptions]);

  useEffect(() => {
    if (!role && defaultRole) {
      setRole(defaultRole);
    }
    if (!gender && defaultGender) {
      setGender(defaultGender);
    }
    if (!specialization && defaultSpecialization) {
      setSpecialization(defaultSpecialization);
    }
  }, [defaultGender, defaultRole, defaultSpecialization, gender, role, specialization]);

  useEffect(() => {
    const selection = route.params?.locationSelection;
    if (!selection) {
      return;
    }
    if (selection.cityName) {
      setCityName(selection.cityName ?? '');
      setSelectedCityId(typeof selection.cityId === 'number' ? selection.cityId : null);
      setDistrictName('');
      setFieldErrors((prev) => {
        if (!('cityName' in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next.cityName;
        return next;
      });
      setError(null);
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
      phoneNumber?: string | null;
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
        phoneNumber: payload.phoneNumber ?? null,
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
      if (err instanceof ApiError && err.status === 409) {
        setError(null);
        setFieldErrors((prev) => ({
          ...prev,
          email: t('auth.register.emailTaken'),
        }));
        return;
      }

      if (err instanceof ApiError && err.status === 400) {
        const apiFieldErrors = getRegisterApiFieldErrors(err);
        if (Object.keys(apiFieldErrors).length > 0) {
          setFieldErrors((prev) => ({ ...prev, ...apiFieldErrors }));
          setError(null);
          return;
        }
      }

      setError(presentApiError(err).message);
    },
  });

  const clearFieldError = (field: RegisterField) => {
    setFieldErrors((prev) => {
      if (!(field in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleRegister = async () => {
    setDidAttemptSubmit(true);

    const nextFieldErrors = validateRegisterForm({
      email,
      password,
      confirmPassword,
      name,
      cityName,
      phoneNumber,
    });

    setFieldErrors(nextFieldErrors);

    if (
      !role
      || !gender
      || (isTrainer && specializationOptions.length > 0 && !specialization)
    ) {
      setError(t('auth.register.validationRoleGender'));
      return;
    }

    if (Object.keys(nextFieldErrors).length > 0) {
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
        phoneNumber: phoneNumber.trim()
          ? russianPhoneToE164(phoneNumber)
          : null,
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
          onChangeText={(value: string) => {
            setEmail(value);
            clearFieldError('email');
            setError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder={t('common.emailPlaceholder')}
          errorMessage={fieldErrors.email}
        />
        <AuthField
          label={t('auth.register.password')}
          value={password}
          onChangeText={(value: string) => {
            setPassword(value);
            clearFieldError('password');
            clearFieldError('confirmPassword');
            setError(null);
          }}
          secureTextEntry
          placeholder={t('common.passwordCreatePlaceholder')}
          errorMessage={fieldErrors.password}
        />
        <AuthField
          label={t('auth.register.passwordConfirm')}
          value={confirmPassword}
          onChangeText={(value: string) => {
            setConfirmPassword(value);
            clearFieldError('confirmPassword');
            setError(null);
          }}
          secureTextEntry
          placeholder={t('auth.register.passwordConfirmPlaceholder')}
          errorMessage={fieldErrors.confirmPassword}
        />
        <AuthField
          label={t('auth.register.name')}
          value={name}
          onChangeText={(value: string) => {
            setName(value);
            clearFieldError('name');
            setError(null);
          }}
          placeholder={t('common.namePlaceholder')}
          errorMessage={fieldErrors.name}
        />
        <AuthField
          label={t('auth.register.phone')}
          value={phoneNumber}
          onChangeText={(value: string) => {
            setPhoneNumber(normalizeRussianPhoneInput(value));
            clearFieldError('phoneNumber');
            setError(null);
          }}
          keyboardType="numeric"
          placeholder={t('auth.register.phonePlaceholder')}
          errorMessage={fieldErrors.phoneNumber}
        />
        <YStack gap="$2">
          <Text fontSize="$3" color="$muted">
            {t('auth.register.city')}
          </Text>
          <SelectFieldButton
            value={cityName}
            placeholder={t('auth.register.cityPlaceholder')}
            onPress={() => navigation.navigate('LocationSearch', {
              mode: 'city',
              returnTo: 'Register',
              returnToKey: route.key,
            })}
          />
          {fieldErrors.cityName ? (
            <Text fontSize="$2" color="$danger">
              {fieldErrors.cityName}
            </Text>
          ) : null}
        </YStack>
        <YStack gap="$2">
          <Text fontSize="$3" color="$muted">
            {t('auth.register.district')}
          </Text>
          <SelectFieldButton
            value={districtName}
            placeholder={t('auth.register.districtPlaceholder')}
            onPress={() => {
              if (!selectedCityId) {
                setFieldErrors((prev) => ({
                  ...prev,
                  cityName: t('auth.register.selectCityFirst'),
                }));
                return;
              }
              navigation.navigate('LocationSearch', {
                mode: 'district',
                cityId: selectedCityId,
                cityName,
                returnTo: 'Register',
                returnToKey: route.key,
              });
            }}
          />
        </YStack>
        <RegisterLookupsSection
          roleOptions={roleOptions}
          selectedRole={role}
          onSelectRole={(value) => {
            setRole(value);
            setError(null);
          }}
          showRoleError={didAttemptSubmit && !role}
          genderOptions={genderOptions}
          selectedGender={gender}
          onSelectGender={(value) => {
            setGender(value);
            setError(null);
          }}
          showGenderError={didAttemptSubmit && !gender}
          isTrainer={isTrainer}
          specializationOptions={specializationOptions}
          selectedSpecialization={specialization}
          onSelectSpecialization={(value) => {
            setSpecialization(value);
            setError(null);
          }}
          showSpecializationError={didAttemptSubmit && specializationOptions.length > 0 && !specialization}
        />
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
