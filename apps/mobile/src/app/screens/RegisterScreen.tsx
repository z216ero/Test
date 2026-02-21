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
import { SelectFieldButton } from '@ui/components';
import { normalizeRussianPhoneInput, russianPhoneToE164 } from '@utils/phone';

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

type RegisterField = 'email' | 'password' | 'confirmPassword' | 'name' | 'phoneNumber' | 'cityName';
type RegisterFieldErrors = Partial<Record<RegisterField, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const minPasswordLength = 8;
const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).+$/;

const getProblemErrors = (details: unknown): Record<string, string[]> => {
  if (!details || typeof details !== 'object' || !('errors' in details)) {
    return {};
  }

  const errors = (details as { errors?: unknown }).errors;
  if (!errors || typeof errors !== 'object') {
    return {};
  }

  return Object.entries(errors as Record<string, unknown>).reduce<Record<string, string[]>>(
    (acc, [key, value]) => {
      if (Array.isArray(value)) {
        const messages = value.filter((item): item is string => typeof item === 'string');
        if (messages.length > 0) {
          acc[key.toLowerCase()] = messages;
        }
      }
      return acc;
    },
    {}
  );
};

const firstProblemError = (errors: Record<string, string[]>, fieldKeys: string[]): string | null => {
  for (const key of fieldKeys) {
    const message = errors[key.toLowerCase()]?.[0];
    if (message) {
      return message;
    }
  }

  return null;
};

const getRegisterApiFieldErrors = (error: ApiError): RegisterFieldErrors => {
  const errors = getProblemErrors(error.details);
  if (Object.keys(errors).length === 0) {
    return {};
  }

  const emailError = firstProblemError(errors, ['email', 'Email']);
  const passwordError = firstProblemError(errors, ['password', 'Password']);
  const nameError = firstProblemError(errors, ['name', 'Name']);
  const phoneError = firstProblemError(errors, ['phoneNumber', 'PhoneNumber']);
  const cityError = firstProblemError(errors, ['cityName', 'CityName']);

  return {
    ...(emailError ? { email: emailError } : {}),
    ...(passwordError ? { password: passwordError } : {}),
    ...(nameError ? { name: nameError } : {}),
    ...(phoneError ? { phoneNumber: phoneError } : {}),
    ...(cityError ? { cityName: cityError } : {}),
  };
};

const validateRegisterForm = (values: {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  cityName: string;
  phoneNumber: string;
}): RegisterFieldErrors => {
  const errors: RegisterFieldErrors = {};

  const emailValue = values.email.trim();
  const nameValue = values.name.trim();
  const cityValue = values.cityName.trim();
  const phoneValue = values.phoneNumber.trim();

  if (!emailValue) {
    errors.email = t('auth.register.emailRequired');
  } else if (!emailPattern.test(emailValue)) {
    errors.email = t('auth.register.emailInvalid');
  }

  if (!values.password) {
    errors.password = t('auth.register.passwordRequired');
  } else if (
    values.password.length < minPasswordLength
    || !passwordPattern.test(values.password)
  ) {
    errors.password = t('auth.register.passwordRules');
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = t('auth.register.passwordConfirmRequired');
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = t('auth.register.passwordMismatch');
  }

  if (!nameValue) {
    errors.name = t('auth.register.nameRequired');
  } else if (nameValue.length < 2) {
    errors.name = t('auth.register.nameMin');
  }

  if (!cityValue) {
    errors.cityName = t('auth.register.cityRequired');
  }

  if (phoneValue && !russianPhoneToE164(phoneValue)) {
    errors.phoneNumber = t('auth.register.phoneInvalid');
  }

  return errors;
};

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
                  backgroundColor={isSelected ? '$accent' : '$backgroundSoft'}
                  color={isSelected ? '$accentText' : '$text'}
                  fontWeight={isSelected ? '700' : '400'}
                  borderWidth={1}
                  borderColor={isSelected ? '$accent' : '$border'}
                  borderRadius="$3"
                  onPress={() => {
                    setRole(item.code);
                    setError(null);
                  }}
                  flex={1}
                  minHeight="$10"
                >
                  {getRoleLabel(item.code)}
                </Button>
              );
            })}
          </XStack>
          {didAttemptSubmit && !role ? (
            <Text fontSize="$2" color="$danger">
              {t('auth.register.roleRequired')}
            </Text>
          ) : null}
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
                  backgroundColor={isSelected ? '$accent' : '$backgroundSoft'}
                  color={isSelected ? '$accentText' : '$text'}
                  fontWeight={isSelected ? '700' : '400'}
                  borderWidth={1}
                  borderColor={isSelected ? '$accent' : '$border'}
                  borderRadius="$3"
                  onPress={() => {
                    setGender(item.code);
                    setError(null);
                  }}
                  flex={1}
                  minHeight="$10"
                >
                  {getGenderLabel(item.code)}
                </Button>
              );
            })}
          </XStack>
          {didAttemptSubmit && !gender ? (
            <Text fontSize="$2" color="$danger">
              {t('auth.register.genderRequired')}
            </Text>
          ) : null}
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
                    onPress={() => {
                      setSpecialization(item.code);
                      setError(null);
                    }}
                    minHeight="$9"
                  >
                    {item.label}
                  </Button>
                );
              })}
            </XStack>
            {didAttemptSubmit && specializationOptions.length > 0 && !specialization ? (
              <Text fontSize="$2" color="$danger">
                {t('auth.register.specializationRequired')}
              </Text>
            ) : null}
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
