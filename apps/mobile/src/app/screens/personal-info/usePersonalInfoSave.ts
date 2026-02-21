import type { NavigationProp } from '@react-navigation/native';
import type { QueryClient } from '@tanstack/react-query';
import type { Dispatch, SetStateAction } from 'react';
import { patchUsersMe, putUsersMeAvatar } from '@generated/api';
import type { UpdateUserRequest } from '@generated/api';
import { presentApiError, shouldShowErrorToast } from '@api/ApiErrorPresenter';
import { unwrap } from '@api/core';
import { t } from '@i18n';
import { useAppMutation } from '@query/hooks';
import { keys } from '@query/keys';
import { russianPhoneToE164 } from '@utils/phone';
import type { ProfileStackParamList } from '@app/navigation/types';

export type SelectedAvatar = {
  uri: string;
  type: string;
  name: string;
};

export type PersonalInfoFieldErrors = {
  name?: string;
  cityName?: string;
  phoneNumber?: string;
  trainingTypes?: string;
  pricePerSession?: string;
};

type UsePersonalInfoSaveArgs = {
  name: string;
  cityName: string;
  districtName: string;
  phoneNumber: string;
  userGender: string;
  isTrainer: boolean;
  about: string;
  specializations: string[];
  trainingTypes: string[];
  worksWithGender: string;
  pricePerSession: string;
  selectedAvatar: SelectedAvatar | null;
  maxPriceRub: number;
  setFieldErrors: Dispatch<SetStateAction<PersonalInfoFieldErrors>>;
  setSubmitError: (value: string | null) => void;
  queryClient: QueryClient;
  navigation: NavigationProp<ProfileStackParamList, 'PersonalInfo'>;
  showToast: (payload: {
    type: 'error';
    title: string;
    message?: string;
  }) => void;
};

export function usePersonalInfoSave({
  name,
  cityName,
  districtName,
  phoneNumber,
  userGender,
  isTrainer,
  about,
  specializations,
  trainingTypes,
  worksWithGender,
  pricePerSession,
  selectedAvatar,
  maxPriceRub,
  setFieldErrors,
  setSubmitError,
  queryClient,
  navigation,
  showToast,
}: UsePersonalInfoSaveArgs) {
  const saveMutation = useAppMutation({
    mutationFn: async () => {
      const payload: UpdateUserRequest = {
        name: name.trim(),
        cityName: cityName.trim(),
        districtName: districtName.trim() || null,
        phoneNumber: phoneNumber.trim()
          ? russianPhoneToE164(phoneNumber)
          : null,
        gender: userGender || null,
        about: isTrainer
          ? about.trim() || null
          : undefined,
        specializations: isTrainer
          ? specializations
          : undefined,
        trainingTypes: isTrainer
          ? trainingTypes
          : undefined,
        worksWithGender: isTrainer
          ? worksWithGender
          : undefined,
        pricePerSession: isTrainer
          ? (pricePerSession.trim().length > 0
            ? Number(pricePerSession) * 100
            : null)
          : undefined,
      };

      const response = await patchUsersMe(payload);
      unwrap(response, t('errors.saveFailed'));

      if (selectedAvatar) {
        const uploadResponse = await putUsersMeAvatar({
          file: selectedAvatar as unknown as Blob,
        });
        unwrap(uploadResponse, t('errors.uploadFailed'));
      }
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: keys.auth.me() });
      navigation.goBack();
    },
    onError: (err) => {
      const presented = presentApiError(err);
      setSubmitError(presented.message);
      if (shouldShowErrorToast(presented)) {
        showToast({
          type: 'error',
          title: presented.title,
          message: presented.message,
        });
      }
    },
  });

  const handleSave = async () => {
    const nextFieldErrors: PersonalInfoFieldErrors = {};

    if (!name.trim()) {
      nextFieldErrors.name = t('profile.personal.nameRequired');
    } else if (name.trim().length < 2) {
      nextFieldErrors.name = t('profile.personal.nameMin');
    }

    if (!cityName.trim()) {
      nextFieldErrors.cityName = t('profile.personal.cityRequired');
    }

    if (phoneNumber.trim().length > 0 && !russianPhoneToE164(phoneNumber)) {
      nextFieldErrors.phoneNumber = t('profile.personal.phoneInvalid');
    }

    if (isTrainer && trainingTypes.length === 0) {
      nextFieldErrors.trainingTypes = t('profile.personal.trainingTypesRequired');
    }

    if (isTrainer && pricePerSession.trim().length > 0) {
      const value = Number(pricePerSession);
      if (!Number.isFinite(value)) {
        nextFieldErrors.pricePerSession = t('profile.personal.priceInvalid');
      }
      if ((Number.isFinite(value) && value < 0) || value > maxPriceRub) {
        nextFieldErrors.pricePerSession = t('profile.personal.priceInvalid');
      }
    }

    setFieldErrors(nextFieldErrors);
    setSubmitError(null);

    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    try {
      await saveMutation.mutateAsync();
    } catch {
      // handled in mutation callbacks
    }
  };

  return {
    saveMutation,
    handleSave,
  };
}
