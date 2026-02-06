import { useEffect, useMemo, useState } from 'react';
import { Image } from 'react-native';
import { YStack, Text } from 'tamagui';
import { getAccessToken } from '@auth/tokenStorage';
import { t } from '@i18n';
import { buildAbsoluteUrl } from '@utils/url';

type TrainerAvatarProps = {
  name?: string | null;
  avatarUrl?: string | null;
  size?: number | string;
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

export function TrainerAvatar({ name, avatarUrl, size = '$9' }: TrainerAvatarProps) {
  const [avatarToken, setAvatarToken] = useState<string | null>(null);
  const resolvedAvatar = avatarUrl ? buildAbsoluteUrl(avatarUrl) : null;
  const avatarSource = useMemo(() => {
    if (!resolvedAvatar || !avatarToken) {
      return null;
    }
    return {
      uri: resolvedAvatar,
      headers: { Authorization: `Bearer ${avatarToken}` },
    };
  }, [avatarToken, resolvedAvatar]);

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

  return (
    <YStack
      width={size}
      height={size}
      borderRadius="$6"
      backgroundColor="$surfaceMuted"
      borderWidth={1}
      borderColor="$border"
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
        <Text fontSize="$4" color="$muted">
          {getInitials(name)}
        </Text>
      )}
    </YStack>
  );
}


