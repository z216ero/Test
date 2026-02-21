import { ApiError } from '@api/core';
import type { LookupItem } from '@api/lookupsApi';
import { t } from '@i18n';
import { russianPhoneToE164 } from '@utils/phone';

export const fallbackRoleOptions: LookupItem[] = [
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

export const fallbackGenderOptions: LookupItem[] = [
  { code: 'Male', label: 'Male', isDefault: true, isAny: false },
  { code: 'Female', label: 'Female', isDefault: false, isAny: false },
];

export const getRoleLabel = (code: string): string => {
  if (code === 'Trainer') {
    return t('auth.register.roleTrainer');
  }
  if (code === 'Client') {
    return t('auth.register.roleClient');
  }
  return code;
};

export const getGenderLabel = (code: string): string => {
  if (code === 'Male') {
    return t('auth.register.genderMale');
  }
  if (code === 'Female') {
    return t('auth.register.genderFemale');
  }
  return code;
};

export type RegisterField = 'email' | 'password' | 'confirmPassword' | 'name' | 'phoneNumber' | 'cityName';
export type RegisterFieldErrors = Partial<Record<RegisterField, string>>;

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

export const getRegisterApiFieldErrors = (error: ApiError): RegisterFieldErrors => {
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

export const validateRegisterForm = (values: {
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

