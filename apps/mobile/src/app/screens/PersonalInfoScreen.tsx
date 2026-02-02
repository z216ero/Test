import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Image } from 'react-native';
import { ScrollView } from '@tamagui/scroll-view';
import { Button, Input, Text, XStack, YStack } from 'tamagui';
import { launchImageLibrary } from 'react-native-image-picker';
import type { UpdateUserRequest } from '../../generated/api';
import { patchUsersMe, putUsersMeAvatar } from '../../generated/api';
import { presentApiError } from '../../api/ApiErrorPresenter';
import { unwrap } from '../../api/core';
import { getMe } from '../../api/homeApi';
import { getAccessToken } from '../../auth/tokenStorage';
import { buildAbsoluteUrl } from '../../utils/url';
import { t } from '../../i18n';
import { formInputProps, primaryButtonProps, secondaryButtonProps } from '../../ui/formDefaults';
import { AppIcon } from '../../ui/AppIcon';
import { useToast } from '../../ui/feedback/useToast';
import type { ProfileStackParamList } from '../navigation/types';
import { useAppMutation, useAppQuery } from '../../query/hooks';
import { keys } from '../../query/keys';
import { useQueryClient } from '@tanstack/react-query';

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

const trainingTypeOptions = [
  'Full Body',
  'Силовая тренировка',
  'Набор массы',
  'Похудение',
  'Функциональная тренировка',
  'Грудь',
  'Спина',
  'Ноги',
  'Пресс / Core',
  'Кардио',
  'HIIT',
  'Растяжка / Mobility',
  'Реабилитация',
] as const;

const trainingTypesPreviewCount = 4;

type ClientGenderPreference = 'Men' | 'Women' | 'All';

const normalizeGenderPreference = (value?: string | null): ClientGenderPreference => {
  if (value === 'Men' || value === 'Women' || value === 'All') {
    return value;
  }
  return 'All';
};

type SelectedAvatar = {
  uri: string;
  type: string;
  name: string;
};

type Props = NativeStackScreenProps<ProfileStackParamList, 'PersonalInfo'>;

export function PersonalInfoScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [email, setEmail] = useState('');
  const [about, setAbout] = useState('');
  const [trainingTypes, setTrainingTypes] = useState<string[]>([]);
  const [trainingTypesExpanded, setTrainingTypesExpanded] = useState(false);
  const [clientGenderPreference, setClientGenderPreference] =
    useState<ClientGenderPreference>('All');
  const [selectedAvatar, setSelectedAvatar] = useState<SelectedAvatar | null>(null);
  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);
  const [avatarToken, setAvatarToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const tabBarHeight = useBottomTabBarHeight();

  const {
    data: me,
    isLoading,
    error: meError,
  } = useAppQuery({
    queryKey: keys.auth.me(),
    queryFn: ({ signal }) => getMe({ signal }),
  });

  const isTrainer = me?.role === 'Trainer';
  const genderOptions: { value: ClientGenderPreference; label: string }[] = [
    { value: 'Men', label: t('profile.personal.genderMen') },
    { value: 'Women', label: t('profile.personal.genderWomen') },
    { value: 'All', label: t('profile.personal.genderAll') },
  ];

  useEffect(() => {
    if (!me) {
      return;
    }
    setName(me.name?.trim() ?? '');
    setSpecialization(me.specialization?.trim() ?? '');
    setEmail(me.email?.trim() ?? '');
    setAbout(me.about?.trim() ?? '');
    setTrainingTypes(
      me.trainingTypes
        ?.filter((value): value is string => Boolean(value))
        .filter((value) => trainingTypeOptions.includes(value as (typeof trainingTypeOptions)[number]))
      ?? []
    );
    setClientGenderPreference(normalizeGenderPreference(me.clientGenderPreference));
  }, [me]);

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
  ), [trainingTypesExpanded]);

  const toggleTrainingType = useCallback((type: string) => {
    setTrainingTypes((prev) => {
      const exists = prev.includes(type);
      const next = exists
        ? prev.filter((item) => item !== type)
        : [...prev, type];
      return trainingTypeOptions.filter((item) => next.includes(item));
    });
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
        specialization: isTrainer
          ? specialization.trim() || null
          : undefined,
        about: isTrainer
          ? about.trim() || null
          : undefined,
        trainingTypes: isTrainer
          ? trainingTypes
          : undefined,
        clientGenderPreference: isTrainer
          ? clientGenderPreference
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
      showToast({ type: 'success', title: t('profile.personal.updated') });
      navigation.goBack();
    },
    onError: (err) => {
      const presented = presentApiError(err);
      setError(presented.message);
      showToast({
        type: 'error',
        title: presented.title,
        message: presented.message,
      });
    },
  });

  const handleSave = async () => {
    setError(null);
    if (isTrainer && trainingTypes.length === 0) {
      setError(t('profile.personal.trainingTypesRequired'));
      return;
    }
    try {
      await saveMutation.mutateAsync();
    } catch {
      // handled in mutation callbacks
    }
  };

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingBottom: 32 + tabBarHeight,
        }}
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
            {isTrainer ? (
              <YStack gap="$2">
                <Text fontSize="$3" color="$text">
                  {t('profile.personal.specialization')}
                </Text>
                <Input
                  value={specialization}
                  onChangeText={setSpecialization}
                  placeholder={t('profile.personal.specialization')}
                  {...formInputProps}
                />
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
                {t('profile.personal.trainingTypes')}
              </Text>
              <XStack flexWrap="wrap" gap="$2">
                {visibleTrainingTypes.map((type) => {
                  const selected = trainingTypes.includes(type);
                  return (
                    <Button
                      key={type}
                      unstyled
                      paddingHorizontal="$3"
                      paddingVertical="$2"
                      minHeight="$9"
                      borderRadius="$4"
                      backgroundColor={selected ? '$accent' : '$background'}
                      borderWidth={1}
                      borderColor={selected ? '$accent' : '$border'}
                      onPress={() => toggleTrainingType(type)}
                    >
                      <XStack alignItems="center" gap="$2">
                        <AppIcon
                          name="check"
                          size={16}
                          color={selected ? '$accentText' : '$muted'}
                        />
                        <Text fontSize="$3" color={selected ? '$accentText' : '$text'}>
                          {type}
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
                    const selected = clientGenderPreference === option.value;
                    return (
                      <Button
                        key={option.value}
                        unstyled
                        backgroundColor="$background"
                        borderRadius="$4"
                        borderWidth={1}
                        borderColor={selected ? '$accent' : '$border'}
                        padding="$3"
                        minHeight="$10"
                        width="100%"
                        justifyContent="flex-start"
                        onPress={() => setClientGenderPreference(option.value)}
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
      </ScrollView>
    </YStack>
  );
}
