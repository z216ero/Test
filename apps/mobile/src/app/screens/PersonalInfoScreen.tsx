import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-native';
import { ScrollView } from '@tamagui/scroll-view';
import { Button, Input, Text, XStack, YStack } from 'tamagui';
import { launchImageLibrary } from 'react-native-image-picker';
import type { AuthUserDto, UpdateUserRequest } from '../../generated/api';
import { patchUsersMe, putUsersMeAvatar } from '../../generated/api';
import { getUiErrorMessage, unwrap } from '../../api/core';
import { getMe } from '../../api/homeApi';
import { getAccessToken } from '../../auth/tokenStorage';
import { API_BASE_URL } from '../../config/env';
import { t } from '../../i18n';
import { formInputProps, primaryButtonProps, secondaryButtonProps } from '../../ui/formDefaults';
import type { ProfileStackParamList } from '../navigation/types';

const buildAbsoluteUrl = (path: string): string => {
  const trimmedBase = API_BASE_URL.endsWith('/')
    ? API_BASE_URL.slice(0, -1)
    : API_BASE_URL;
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
};

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

type SelectedAvatar = {
  uri: string;
  type: string;
  name: string;
};

type Props = NativeStackScreenProps<ProfileStackParamList, 'PersonalInfo'>;

export function PersonalInfoScreen({ navigation }: Props) {
  const [me, setMe] = useState<AuthUserDto | null>(null);
  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [email, setEmail] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<SelectedAvatar | null>(null);
  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);
  const [avatarToken, setAvatarToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isTrainer = me?.role === 'Trainer';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const meData = await getMe();
      const token = await getAccessToken();
      setMe(meData);
      setName(meData.name?.trim() ?? '');
      setSpecialization(meData.specialization?.trim() ?? '');
      setEmail(meData.email?.trim() ?? '');
      setAvatarToken(token);
    } catch (err) {
      setError(getUiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    try {
      const payload: UpdateUserRequest = {
        name: name.trim(),
        specialization: isTrainer
          ? specialization.trim() || null
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

      const refreshed = await getMe();
      setMe(refreshed);
      navigation.goBack();
    } catch (err) {
      setError(getUiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingBottom: 32,
        }}
      >
        <YStack gap="$6">
          <YStack gap="$2">
            <Text fontSize="$7" fontWeight="700" color="$text">
              {t('profile.personal.title')}
            </Text>
            {loading ? (
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
                disabled={saving}
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

          <YStack gap="$3">
            <Button
              backgroundColor="$accent"
              color="$accentText"
              borderRadius="$4"
              onPress={handleSave}
              disabled={saving || loading}
              {...primaryButtonProps}
            >
              <Text fontSize="$3" color="$accentText">
                {saving ? t('common.loading') : t('profile.personal.save')}
              </Text>
            </Button>
            <Button
              backgroundColor="$background"
              borderRadius="$4"
              borderWidth={1}
              borderColor="$border"
              onPress={() => navigation.goBack()}
              disabled={saving}
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
