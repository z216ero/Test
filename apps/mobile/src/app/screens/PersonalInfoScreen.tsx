import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-native';
import { Button, Input, Text, XStack, YStack } from 'tamagui';
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
import { getAccessToken } from '@auth/tokenStorage';
import { buildAbsoluteUrl } from '@utils/url';
import { t } from '@i18n';
import { formInputProps, primaryButtonProps, secondaryButtonProps } from '@ui/formDefaults';
import { AppIcon } from '@ui/AppIcon';
import { useToast } from '@ui/feedback/useToast';
import { TabScrollView } from '@ui/layout/TabScrollView';
import type { ProfileStackParamList } from '@app/navigation/types';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { useQueryClient } from '@tanstack/react-query';
import { formatPrice } from '@utils/price';
import { getAnyLookupCode, getDefaultLookupCode } from '@app/utils/lookups';

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
  const [avatarToken, setAvatarToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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


  const genderOptions = gendersQuery.data ?? [];
  const userGenderOptions = useMemo(
    () => genderOptions.filter((item) => !item.isAny),
    [genderOptions]
  );
  const specializationOptions = specializationsQuery.data ?? [];
  const trainingTypeOptions = trainingTypesQuery.data ?? [];

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
    }
    if (selection.districtName) {
      setDistrictName(selection.districtName ?? '');
    }
    navigation.setParams({ locationSelection: undefined });
  }, [navigation, route.params?.locationSelection]);

  useEffect(() => {
    let cancelled = false;
    getAccessToken().then((token) => {
      if (!cancelled) {
        setAvatarToken(token);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (meError) {
      setError(presentApiError(meError).message);
    }
  }, [meError]);

  const avatarUrl = useMemo(() => {
    if (!me?.avatarUrl) {
      return null;
    }
    return buildAbsoluteUrl(me.avatarUrl);
  }, [me?.avatarUrl]);

  const avatarSource = useMemo(() => {
    if (avatarPreviewUri) {
      return { uri: avatarPreviewUri };
    }
    if (avatarUrl && avatarToken) {
      return {
        uri: avatarUrl,
        headers: { Authorization: `Bearer ${avatarToken}` },
      };
    }
    return null;
  }, [avatarPreviewUri, avatarToken, avatarUrl]);

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
  }, []);

  const handlePickPhoto = async () => {
    setError(null);

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
      setError(t('errors.invalidImage'));
      return;
    }

    const asset = result.assets?.[0];
    if (!asset?.uri) {
      setError(t('errors.invalidImage'));
      return;
    }

    const normalizedType = asset.type?.toLowerCase();
    if (normalizedType && normalizedType !== 'image/jpeg' && normalizedType !== 'image/png') {
      setError(t('errors.invalidImage'));
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
      setError(presented.message);
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
    setError(null);
    if (isTrainer && trainingTypes.length === 0) {
      setError(t('profile.personal.trainingTypesRequired'));
      return;
    }
    if (!cityName.trim()) {
      setError(t('profile.personal.cityRequired'));
      return;
    }
    if (isTrainer && pricePerSession.trim().length > 0) {
      const value = Number(pricePerSession);
      if (!Number.isFinite(value)) {
        setError(t('profile.personal.priceInvalid'));
        return;
      }
      if (value < 0 || value > maxPriceRub) {
        setError(t('profile.personal.priceInvalid'));
        return;
      }
    }
    try {
      await saveMutation.mutateAsync();
    } catch {
      // handled in mutation callbacks
    }
  };

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <TabScrollView
        contentContainerStyle={{ padding: 24 }}
        extraBottomToken={2}
      >
        <YStack gap="$6">
          <YStack gap="$2">
            <Text fontSize="$7" fontWeight="700" color="$text">
              {t('profile.personal.title')}
            </Text>
            {isLoading ? (
              <Text fontSize="$3" color="$muted">
                {t('common.loading')}
              </Text>
            ) : null}
            {error ? (
              <Text fontSize="$3" color="$text">
                {error}
              </Text>
            ) : null}
          </YStack>

          <YStack
            gap="$3"
            padding="$4"
            backgroundColor="$background"
            borderRadius="$5"
            borderWidth={1}
            borderColor="$border"
          >
            <Text fontSize="$4" fontWeight="700" color="$text">
              {t('profile.personal.photo')}
            </Text>
            <XStack alignItems="center" gap="$4">
              <YStack
                width="$11"
                height="$11"
                borderRadius="$6"
                backgroundColor="$surfaceMuted"
                alignItems="center"
                justifyContent="center"
                overflow="hidden"
              >
                {avatarSource ? (
                  <Image
                    source={avatarSource}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text fontSize="$5" color="$muted">
                    {getInitials(name || me?.name)}
                  </Text>
                )}
              </YStack>
              <Button
                backgroundColor="$background"
                borderRadius="$4"
                borderWidth={1}
                borderColor="$border"
                onPress={handlePickPhoto}
                disabled={saveMutation.isPending}
                paddingHorizontal="$3"
                {...secondaryButtonProps}
              >
                <Text fontSize="$3" color="$text">
                  {t('profile.personal.pickPhoto')}
                </Text>
              </Button>
            </XStack>
          </YStack>

          <YStack
            gap="$3"
            padding="$4"
            backgroundColor="$background"
            borderRadius="$5"
            borderWidth={1}
            borderColor="$border"
          >
            <Text fontSize="$4" fontWeight="700" color="$text">
              {t('profile.personal.main')}
            </Text>
            <YStack gap="$2">
              <Text fontSize="$3" color="$text">
                {t('profile.personal.name')}
              </Text>
              <Input
                value={name}
                borderRadius="$4"
                onChangeText={setName}
                placeholder={t('profile.personal.name')}
                {...formInputProps}
              />
            </YStack>
            <YStack gap="$2">
              <Text fontSize="$3" color="$text">
                {t('profile.personal.city')}
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
                onPress={() => navigation.navigate('LocationSearch', {
                  mode: 'city',
                  returnTo: 'PersonalInfo',
                  returnToKey: route.key,
                })}
              >
                <Text
                  color={cityName ? '$text' : '$muted'}
                  width="100%"
                  textAlign="left"
                >
                  {cityName || t('profile.personal.cityPlaceholder')}
                </Text>
              </Button>
            </YStack>
            <YStack gap="$2">
              <Text fontSize="$3" color="$text">
                {t('profile.personal.district')}
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
                    setError(t('profile.personal.cityRequired'));
                    return;
                  }
                  navigation.navigate('LocationSearch', {
                    mode: 'district',
                    cityId: selectedCityId,
                    cityName,
                    returnTo: 'PersonalInfo',
                    returnToKey: route.key,
                  });
                }}
              >
                <Text
                  color={districtName ? '$text' : '$muted'}
                  width="100%"
                  textAlign="left"
                >
                  {districtName || t('profile.personal.districtPlaceholder')}
                </Text>
              </Button>
            </YStack>
            <YStack gap="$2">
              <Text fontSize="$3" color="$text">
                {t('profile.personal.genderUserLabel')}
              </Text>
              <XStack gap="$2" flexWrap="wrap">
                {userGenderOptions.map((option) => {
                  const selected = userGender === option.code;
                  return (
                    <Button
                      key={option.code}
                      unstyled
                      paddingHorizontal="$3"
                      paddingVertical="$2"
                      minHeight="$9"
                      borderRadius="$4"
                      backgroundColor={selected ? '$accent' : '$background'}
                      borderWidth={1}
                      borderColor={selected ? '$accent' : '$border'}
                      onPress={() => setUserGender(option.code)}
                    >
                      <XStack alignItems="center" gap="$2">
                        <AppIcon
                          name="check"
                          size={16}
                          color={selected ? '$accentText' : '$muted'}
                        />
                        <Text fontSize="$3" color={selected ? '$accentText' : '$text'}>
                          {option.label}
                        </Text>
                      </XStack>
                    </Button>
                  );
                })}
              </XStack>
            </YStack>
            {isTrainer ? (
              <YStack gap="$2">
                <Text fontSize="$3" color="$text">
                  {t('profile.personal.price')}
                </Text>
                <Input
                  value={pricePerSession}
                  onChangeText={handlePriceChange}
                  placeholder={t('profile.personal.pricePlaceholder')}
                  keyboardType="numeric"
                  {...formInputProps}
                />
                {pricePerSession.trim().length > 0 ? (
                  <Text fontSize="$2" color="$muted">
                    {t('profile.personal.pricePreview', {
                      price: formatPrice(Number(pricePerSession) * 100) ?? '',
                    })}
                  </Text>
                ) : (
                  <Text fontSize="$2" color="$muted">
                    {t('profile.personal.priceEmpty')}
                  </Text>
                )}
              </YStack>
            ) : null}
            {email ? (
              <YStack gap="$2">
                <Text fontSize="$3" color="$text">
                  {t('profile.personal.email')}
                </Text>
                <Input
                  value={email}
                  borderRadius="$4"
                  editable={false}
                  backgroundColor="$surfaceMuted"
                  color="$muted"
                  {...formInputProps}
                />
              </YStack>
            ) : null}
          </YStack>

          {isTrainer ? (
            <YStack
              gap="$3"
              padding="$4"
              backgroundColor="$background"
              borderRadius="$5"
              borderWidth={1}
              borderColor="$border"
            >
              <Text fontSize="$4" fontWeight="700" color="$text">
                {t('profile.personal.about')}
              </Text>
              <Input
                value={about}
                onChangeText={setAbout}
                placeholder={t('profile.personal.aboutPlaceholder')}
                multiline
                numberOfLines={4}
                maxLength={250}
                {...formInputProps}
                height={120}
                textAlignVertical="top"
              />
            </YStack>
          ) : null}

          {isTrainer ? (
            <YStack
              gap="$3"
              padding="$4"
              backgroundColor="$background"
              borderRadius="$5"
              borderWidth={1}
              borderColor="$border"
            >
              <Text fontSize="$4" fontWeight="700" color="$text">
                {t('profile.personal.specializations')}
              </Text>
              <XStack flexWrap="wrap" gap="$2">
                {specializationOptions.map((option) => {
                  const selected = specializations.includes(option.code);
                  return (
                    <Button
                      key={option.code}
                      unstyled
                      paddingHorizontal="$3"
                      paddingVertical="$2"
                      minHeight="$9"
                      borderRadius="$4"
                      backgroundColor={selected ? '$accent' : '$background'}
                      borderWidth={1}
                      borderColor={selected ? '$accent' : '$border'}
                      onPress={() => toggleSpecialization(option.code)}
                    >
                      <XStack alignItems="center" gap="$2">
                        <AppIcon
                          name="check"
                          size={16}
                          color={selected ? '$accentText' : '$muted'}
                        />
                        <Text fontSize="$3" color={selected ? '$accentText' : '$text'}>
                          {option.label}
                        </Text>
                      </XStack>
                    </Button>
                  );
                })}
              </XStack>
            </YStack>
          ) : null}

          {isTrainer ? (
            <YStack
              gap="$3"
              padding="$4"
              backgroundColor="$background"
              borderRadius="$5"
              borderWidth={1}
              borderColor="$border"
            >
              <Text fontSize="$4" fontWeight="700" color="$text">
                {t('profile.personal.trainingTypes')}
              </Text>
              <XStack flexWrap="wrap" gap="$2">
                {visibleTrainingTypes.map((option) => {
                  const selected = trainingTypes.includes(option.code);
                  return (
                    <Button
                      key={option.code}
                      unstyled
                      paddingHorizontal="$3"
                      paddingVertical="$2"
                      minHeight="$9"
                      borderRadius="$4"
                      backgroundColor={selected ? '$accent' : '$background'}
                      borderWidth={1}
                      borderColor={selected ? '$accent' : '$border'}
                      onPress={() => toggleTrainingType(option.code)}
                    >
                      <XStack alignItems="center" gap="$2">
                        <AppIcon
                          name="check"
                          size={16}
                          color={selected ? '$accentText' : '$muted'}
                        />
                        <Text fontSize="$3" color={selected ? '$accentText' : '$text'}>
                          {option.label}
                        </Text>
                      </XStack>
                    </Button>
                  );
                })}
              </XStack>
              {trainingTypeOptions.length > trainingTypesPreviewCount ? (
                <Button
                  minHeight="$2"
                  backgroundColor="$background"
                  borderRadius="$4"
                  borderWidth={1}
                  borderColor="$border"
                  onPress={() => setTrainingTypesExpanded((prev) => !prev)}
                  paddingHorizontal="$3"
                  {...secondaryButtonProps}
                >
                  <Text fontSize="$3" color="$text">
                    {trainingTypesExpanded
                      ? t('profile.personal.trainingTypesHide')
                      : t('profile.personal.trainingTypesShowMore')}
                  </Text>
                </Button>
              ) : null}
              <YStack gap="$2">
                <Text fontSize="$4" fontWeight="700" color="$text">
                  {t('profile.personal.genderLabel')}
                </Text>
                <YStack gap="$2">
                  {genderOptions.map((option) => {
                    const selected = worksWithGender === option.code;
                    return (
                      <Button
                        key={option.code}
                        unstyled
                        backgroundColor="$background"
                        borderRadius="$4"
                        borderWidth={1}
                        borderColor={selected ? '$accent' : '$border'}
                        padding="$3"
                        minHeight="$10"
                        width="100%"
                        justifyContent="flex-start"
                        onPress={() => setWorksWithGender(option.code)}
                      >
                        <XStack alignItems="center" gap="$3" flex={1}>
                          <YStack
                            width="$4"
                            height="$4"
                            borderRadius="$10"
                            borderWidth={1}
                            borderColor={selected ? '$accent' : '$border'}
                            backgroundColor={selected ? '$accent' : '$background'}
                            alignItems="center"
                            justifyContent="center"
                          >
                            {selected ? (
                              <AppIcon name="check" size={12} color="$accentText" />
                            ) : null}
                          </YStack>
                          <Text fontSize="$3" color="$text">
                            {option.label}
                          </Text>
                        </XStack>
                      </Button>
                    );
                  })}
                </YStack>
              </YStack>
            </YStack>
          ) : null}

          <YStack gap="$3">
            <Button
              backgroundColor="$accent"
              color="$accentText"
              borderRadius="$4"
              onPress={handleSave}
              disabled={saveMutation.isPending || isLoading}
              {...primaryButtonProps}
            >
              <Text fontSize="$3" color="$accentText">
                {saveMutation.isPending ? t('common.loading') : t('profile.personal.save')}
              </Text>
            </Button>
            <Button
              backgroundColor="$background"
              borderRadius="$4"
              borderWidth={1}
              borderColor="$border"
              onPress={() => navigation.goBack()}
              disabled={saveMutation.isPending}
              {...secondaryButtonProps}
            >
              <Text fontSize="$3" color="$text">
                {t('profile.personal.cancel')}
              </Text>
            </Button>
          </YStack>
        </YStack>
      </TabScrollView>
    </YStack>
  );
}
