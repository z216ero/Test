import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { YStack } from 'tamagui';
import { launchImageLibrary } from 'react-native-image-picker';
import type { UpdateUserRequest } from '@generated/api';
import { patchUsersMe, putUsersMeAvatar } from '@generated/api';
import { presentApiError, shouldShowErrorToast } from '@api/ApiErrorPresenter';
import { unwrap } from '@api/core';
import { getMe } from '@api/homeApi';
import {
  getGenderLookups,
  getSpecializationLookups,
  getTrainingTypeLookups,
} from '@api/lookupsApi';
import { t } from '@i18n';
import { useToast } from '@ui/feedback/useToast';
import { TabScrollView } from '@ui/layout/TabScrollView';
import type { ProfileStackParamList } from '@app/navigation/types';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { useQueryClient } from '@tanstack/react-query';
import { formatPrice } from '@utils/price';
import { getAnyLookupCode, getDefaultLookupCode } from '@app/utils/lookups';
import { useAuthorizedImageSource } from '@ui/components';
import { normalizeRussianPhoneInput, russianPhoneToE164 } from '@utils/phone';
import { PersonalInfoActions } from './personal-info/ui/PersonalInfoActions';
import { PersonalInfoHeader } from './personal-info/ui/PersonalInfoHeader';
import { PersonalInfoMainSection } from './personal-info/ui/PersonalInfoMainSection';
import { PersonalInfoPhotoSection } from './personal-info/ui/PersonalInfoPhotoSection';
import { PersonalInfoTrainerSections } from './personal-info/ui/PersonalInfoTrainerSections';

const getInitials = (name?: string | null) => {
  const value = name?.trim();
  if (!value) {
    return t('common.initialsPlaceholder');
  }
  const parts = value.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return value.slice(0, 2).toUpperCase();
};

const trainingTypesPreviewCount = 4;

type SelectedAvatar = {
  uri: string;
  type: string;
  name: string;
};

type PersonalInfoFieldErrors = {
  name?: string;
  cityName?: string;
  phoneNumber?: string;
  trainingTypes?: string;
  pricePerSession?: string;
};

type Props = NativeStackScreenProps<ProfileStackParamList, 'PersonalInfo'>;

const sortByOrder = (values: string[], order: Map<string, number>): string[] => (
  [...new Set(values)].sort((left, right) => {
    const leftIndex = order.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = order.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  })
);

export function PersonalInfoScreen({ navigation, route }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [about, setAbout] = useState('');
  const [cityName, setCityName] = useState('');
  const [districtName, setDistrictName] = useState('');
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [trainingTypes, setTrainingTypes] = useState<string[]>([]);
  const [trainingTypesExpanded, setTrainingTypesExpanded] = useState(false);
  const [userGender, setUserGender] = useState('');
  const [worksWithGender, setWorksWithGender] = useState('');
  const [pricePerSession, setPricePerSession] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<SelectedAvatar | null>(null);
  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<PersonalInfoFieldErrors>({});
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const {
    data: me,
    isLoading,
    error: meError,
  } = useAppQuery({
    queryKey: keys.auth.me(),
    queryFn: ({ signal }) => getMe({ signal }),
  });

  const gendersQuery = useAppQuery({
    queryKey: keys.lookups.genders(),
    queryFn: ({ signal }) => getGenderLookups({ signal }),
  });

  const specializationsQuery = useAppQuery({
    queryKey: keys.lookups.specializations(),
    queryFn: ({ signal }) => getSpecializationLookups({ signal }),
  });

  const trainingTypesQuery = useAppQuery({
    queryKey: keys.lookups.trainingTypes(),
    queryFn: ({ signal }) => getTrainingTypeLookups({ signal }),
  });


  const genderOptions = useMemo(
    () => gendersQuery.data ?? [],
    [gendersQuery.data]
  );
  const userGenderOptions = useMemo(
    () => genderOptions.filter((item) => !item.isAny),
    [genderOptions]
  );
  const specializationOptions = useMemo(
    () => specializationsQuery.data ?? [],
    [specializationsQuery.data]
  );
  const trainingTypeOptions = useMemo(
    () => trainingTypesQuery.data ?? [],
    [trainingTypesQuery.data]
  );

  const specializationOrder = useMemo(
    () => new Map(specializationOptions.map((item, index) => [item.code, index])),
    [specializationOptions]
  );
  const trainingTypeOrder = useMemo(
    () => new Map(trainingTypeOptions.map((item, index) => [item.code, index])),
    [trainingTypeOptions]
  );

  const allowedSpecializations = useMemo(
    () => new Set(specializationOptions.map((item) => item.code)),
    [specializationOptions]
  );
  const allowedTrainingTypes = useMemo(
    () => new Set(trainingTypeOptions.map((item) => item.code)),
    [trainingTypeOptions]
  );

  const defaultUserGender = useMemo(
    () => getDefaultLookupCode(userGenderOptions),
    [userGenderOptions]
  );
  const defaultAnyGender = useMemo(() => {
    const anyCode = getAnyLookupCode(genderOptions);
    return anyCode || getDefaultLookupCode(genderOptions);
  }, [genderOptions]);

  const isTrainer = me?.role === 'Trainer';
  const maxPriceRub = 10_000;

  useEffect(() => {
    if (!me) {
      return;
    }

    setName(me.name?.trim() ?? '');
    setEmail(me.email?.trim() ?? '');
    setPhoneNumber(me.phoneNumber?.trim() ? normalizeRussianPhoneInput(me.phoneNumber) : '');
    setAbout(me.about?.trim() ?? '');
    setCityName(me.cityName?.trim() ?? '');
    setDistrictName(me.districtName?.trim() ?? '');
    setSelectedCityId(typeof me.cityId === 'number' ? me.cityId : null);

    const nextSpecializations = Array.isArray(me.specializations)
      ? me.specializations.filter(
        (value: unknown): value is string => typeof value === 'string' && value.length > 0
      )
      : [];
    setSpecializations(
      sortByOrder(
        nextSpecializations.filter((value) => allowedSpecializations.has(value)),
        specializationOrder
      )
    );

    const nextTrainingTypes = Array.isArray(me.trainingTypes)
      ? me.trainingTypes.filter(
        (value: unknown): value is string => typeof value === 'string' && value.length > 0
      )
      : [];
    setTrainingTypes(
      sortByOrder(
        nextTrainingTypes.filter((value) => allowedTrainingTypes.has(value)),
        trainingTypeOrder
      )
    );

    setUserGender(me.gender ?? defaultUserGender);
    setWorksWithGender(me.worksWithGender ?? defaultAnyGender);
    if (typeof me.pricePerSession === 'number') {
      const rubles = Math.floor(me.pricePerSession / 100);
      setPricePerSession(Number.isFinite(rubles) ? String(rubles) : '');
    } else {
      setPricePerSession('');
    }
  }, [
    me,
    allowedSpecializations,
    allowedTrainingTypes,
    specializationOrder,
    trainingTypeOrder,
    defaultUserGender,
    defaultAnyGender,
  ]);

  useEffect(() => {
    const selection = route.params?.locationSelection;
    if (!selection) {
      return;
    }
    if (selection.cityName) {
      setCityName(selection.cityName ?? '');
      setSelectedCityId(typeof selection.cityId === 'number' ? selection.cityId : null);
      setDistrictName('');
      setFieldErrors((prev) => ({ ...prev, cityName: undefined }));
      setSubmitError(null);
    }
    if (selection.districtName) {
      setDistrictName(selection.districtName ?? '');
    }
    navigation.setParams({ locationSelection: undefined });
  }, [navigation, route.params?.locationSelection]);

  useEffect(() => {
    if (meError) {
      setSubmitError(presentApiError(meError).message);
    }
  }, [meError]);

  const authorizedAvatarSource = useAuthorizedImageSource(me?.avatarUrl);
  const avatarSource = useMemo(() => {
    if (avatarPreviewUri) {
      return { uri: avatarPreviewUri };
    }
    return authorizedAvatarSource;
  }, [authorizedAvatarSource, avatarPreviewUri]);

  const visibleTrainingTypes = useMemo(() => (
    trainingTypesExpanded
      ? trainingTypeOptions
      : trainingTypeOptions.slice(0, trainingTypesPreviewCount)
  ), [trainingTypesExpanded, trainingTypeOptions]);

  const toggleSpecialization = useCallback((code: string) => {
    setSpecializations((prev) => {
      const exists = prev.includes(code);
      const next = exists
        ? prev.filter((item) => item !== code)
        : [...prev, code];
      return sortByOrder(next, specializationOrder);
    });
  }, [specializationOrder]);

  const toggleTrainingType = useCallback((code: string) => {
    setFieldErrors((prev) => ({ ...prev, trainingTypes: undefined }));
    setSubmitError(null);
    setTrainingTypes((prev) => {
      const exists = prev.includes(code);
      const next = exists
        ? prev.filter((item) => item !== code)
        : [...prev, code];
      return sortByOrder(next, trainingTypeOrder);
    });
  }, [trainingTypeOrder]);

  const handlePriceChange = useCallback((value: string) => {
    const normalized = value.replace(/\D/g, '');
    setPricePerSession(normalized);
    setFieldErrors((prev) => ({ ...prev, pricePerSession: undefined }));
    setSubmitError(null);
  }, []);

  const handlePickPhoto = async () => {
    setSubmitError(null);

    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.9,
      maxWidth: 1920,
      maxHeight: 1920,
    });

    if (result.didCancel) {
      return;
    }

    if (result.errorCode || result.errorMessage) {
      setSubmitError(t('errors.invalidImage'));
      return;
    }

    const asset = result.assets?.[0];
    if (!asset?.uri) {
      setSubmitError(t('errors.invalidImage'));
      return;
    }

    const normalizedType = asset.type?.toLowerCase();
    if (normalizedType && normalizedType !== 'image/jpeg' && normalizedType !== 'image/png') {
      setSubmitError(t('errors.invalidImage'));
      return;
    }

    setSelectedAvatar({
      uri: asset.uri,
      type: normalizedType ?? 'image/jpeg',
      name: asset.fileName ?? 'avatar.jpg',
    });
    setAvatarPreviewUri(asset.uri);
  };

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

  const handleSelectCity = () => {
    setFieldErrors((prev) => ({ ...prev, cityName: undefined }));
    setSubmitError(null);
    navigation.navigate('LocationSearch', {
      mode: 'city',
      returnTo: 'PersonalInfo',
      returnToKey: route.key,
    });
  };

  const handleSelectDistrict = () => {
    if (!selectedCityId) {
      setFieldErrors((prev) => ({
        ...prev,
        cityName: t('profile.personal.cityRequired'),
      }));
      return;
    }
    navigation.navigate('LocationSearch', {
      mode: 'district',
      cityId: selectedCityId,
      cityName,
      returnTo: 'PersonalInfo',
      returnToKey: route.key,
    });
  };

  const priceHint = pricePerSession.trim().length > 0
    ? t('profile.personal.pricePreview', {
      price: formatPrice(Number(pricePerSession) * 100) ?? '',
    })
    : t('profile.personal.priceEmpty');

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <TabScrollView
        contentContainerStyle={{ padding: 24 }}
        extraBottomToken={2}
      >
        <YStack gap="$6">
          <PersonalInfoHeader
            isLoading={isLoading}
            error={submitError}
          />
          <PersonalInfoPhotoSection
            avatarSource={avatarSource}
            initials={getInitials(name || me?.name)}
            onPickPhoto={handlePickPhoto}
            disabled={saveMutation.isPending}
          />
          <PersonalInfoMainSection
            name={name}
            onChangeName={(value) => {
              setName(value);
              setFieldErrors((prev) => ({ ...prev, name: undefined }));
              setSubmitError(null);
            }}
            phoneNumber={phoneNumber}
            onChangePhoneNumber={(value) => {
              setPhoneNumber(normalizeRussianPhoneInput(value));
              setFieldErrors((prev) => ({ ...prev, phoneNumber: undefined }));
              setSubmitError(null);
            }}
            cityName={cityName}
            districtName={districtName}
            onSelectCity={handleSelectCity}
            onSelectDistrict={handleSelectDistrict}
            userGenderOptions={userGenderOptions}
            userGender={userGender}
            onSelectUserGender={setUserGender}
            isTrainer={isTrainer}
            pricePerSession={pricePerSession}
            onChangePrice={handlePriceChange}
            priceHint={priceHint}
            email={email}
            fieldErrors={fieldErrors}
          />
          <PersonalInfoTrainerSections
            isTrainer={isTrainer}
            about={about}
            onChangeAbout={setAbout}
            specializationOptions={specializationOptions}
            specializations={specializations}
            onToggleSpecialization={toggleSpecialization}
            visibleTrainingTypes={visibleTrainingTypes}
            trainingTypes={trainingTypes}
            onToggleTrainingType={toggleTrainingType}
            hasMoreTrainingTypes={trainingTypeOptions.length > trainingTypesPreviewCount}
            trainingTypesExpanded={trainingTypesExpanded}
            onToggleTrainingTypesExpanded={() => setTrainingTypesExpanded((prev) => !prev)}
            genderOptions={genderOptions}
            worksWithGender={worksWithGender}
            onSelectWorksWithGender={setWorksWithGender}
            trainingTypesError={fieldErrors.trainingTypes}
          />
          <PersonalInfoActions
            isSaving={saveMutation.isPending}
            isLoading={isLoading}
            onSave={handleSave}
            onCancel={() => navigation.goBack()}
          />
        </YStack>
      </TabScrollView>
    </YStack>
  );
}
