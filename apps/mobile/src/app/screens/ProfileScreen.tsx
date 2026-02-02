import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-native';
import { ScrollView } from '@tamagui/scroll-view';
import { Button, Text, XStack, YStack } from 'tamagui';
import { logout } from '../../api/authApi';
import { presentApiError } from '../../api/ApiErrorPresenter';
import { getMe } from '../../api/homeApi';
import { clearSession } from '../../auth/tokenStorage';
import { getAccessToken } from '../../auth/tokenStorage';
import { buildAbsoluteUrl } from '../../utils/url';
import { t } from '../../i18n';
import { AppIcon } from '../../ui/AppIcon';
import type { AppIconName } from '../../ui/icons';
import type { ProfileStackParamList, RootStackParamList } from '../navigation/types';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAppMutation, useAppQuery } from '../../query/hooks';
import { keys } from '../../query/keys';
import { formatPrice } from '../../utils/price';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

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

export function ProfileScreen({ navigation }: Props) {
  const [avatarToken, setAvatarToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(true);

  const {
    data: me,
    isLoading,
    error: meError,
    refetch,
  } = useAppQuery({
    queryKey: keys.auth.me(),
    queryFn: ({ signal }) => getMe({ signal }),
  });

  useEffect(() => {
    let cancelled = false;
    setLoadingToken(true);
    getAccessToken()
      .then((token) => {
        if (!cancelled) {
          setAvatarToken(token);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingToken(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isLoading) {
        refetch();
      }
    }, [isLoading, refetch])
  );

  const role = me?.role === 'Trainer' ? 'Trainer' : 'Client';
  const roleLabel =
    role === 'Trainer' ? t('profile.roleTrainer') : t('profile.roleClient');

  const trainerRating = me?.trainerRating;
  const trainerRatingCount = me?.trainerRatingCount;
  const showTrainerRating = role === 'Trainer'
    && typeof trainerRating === 'number'
    && typeof trainerRatingCount === 'number'
    && trainerRatingCount > 0;
  const ratingCaption = showTrainerRating
    ? t('profile.rating.basedOn', { count: trainerRatingCount })
    : t('profile.rating.empty');

  const name = me?.name?.trim() || t('common.unknownUser');
  const priceLabel = formatPrice(me?.pricePerSession);
  const avatarUrl = useMemo(() => {
    if (!me?.avatarUrl) {
      return null;
    }
    return buildAbsoluteUrl(me.avatarUrl);
  }, [me?.avatarUrl]);

  const avatarSource = useMemo(() => {
    if (avatarUrl && avatarToken) {
      return {
        uri: avatarUrl,
        headers: { Authorization: `Bearer ${avatarToken}` },
      };
    }
    return null;
  }, [avatarUrl, avatarToken]);

  const settingsItems: {
    id: string;
    label: string;
    icon: AppIconName;
    onPress?: () => void;
    disabled?: boolean;
  }[] = [
    {
      id: 'personal',
      label: t('profile.settings.personalInfo'),
      icon: 'user',
      onPress: () => navigation.navigate('PersonalInfo'),
    },
    ...(role === 'Trainer'
      ? []
      : [
          {
            id: 'schedule',
            label: t('profile.settings.bookings'),
            icon: 'history' as const,
          },
        ]),
    {
      id: 'payments',
      label: t('profile.settings.payments'),
      icon: 'creditCard',
      disabled: true,
    },
    {
      id: 'notifications',
      label: t('profile.settings.notifications'),
      icon: 'alertCircle',
      onPress: () => navigation.navigate('Notifications'),
    },
    {
      id: 'support',
      label: t('profile.settings.support'),
      icon: 'info',
    },
  ];

  const handleLogout = async () => {
    await clearSession();
    const tabNavigation = navigation.getParent();
    const rootNavigation =
      tabNavigation?.getParent<NativeStackNavigationProp<RootStackParamList>>();
    rootNavigation?.reset({ index: 0, routes: [{ name: 'Auth' }] });
  };

  const logoutMutation = useAppMutation({
    mutationFn: () => logout(),
    onError: (err) => {
      setError(presentApiError(err).message);
    },
    onSettled: () => {
      handleLogout();
    },
  });

  useEffect(() => {
    if (meError) {
      setError(presentApiError(meError).message);
    }
  }, [meError]);

  const tabBarHeight = useBottomTabBarHeight();
  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingBottom: 24 + tabBarHeight,
        }}
      >
        <YStack gap="$6">
          <YStack gap="$4">
            <XStack alignItems="flex-start" justifyContent="space-between" gap="$4">
              <XStack alignItems="center" gap="$4" flex={1}>
                <YStack
                  width="$11"
                  height="$11"
                  borderRadius="$6"
                  backgroundColor="$background"
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
                    <Text fontSize="$5" color="$muted">
                      {getInitials(me?.name)}
                    </Text>
                  )}
                </YStack>
                <YStack gap="$1" flex={1}>
                  <Text fontSize="$6" fontWeight="700" color="$text">
                    {name}
                  </Text>
                  <Text fontSize="$3" color="$muted">
                    {roleLabel}
                  </Text>
                  {role === 'Trainer' ? (
                    <Text fontSize="$3" color="$muted">
                      {me?.specialization?.trim() || t('common.empty')}
                    </Text>
                  ) : null}
                  {role === 'Trainer' ? (
                    <Text fontSize="$3" color="$muted">
                      {priceLabel
                        ? t('profile.price.value', { price: priceLabel })
                        : t('profile.price.empty')}
                    </Text>
                  ) : null}
                </YStack>
              </XStack>
              {role === 'Trainer' ? (
                <YStack alignItems="flex-end" gap="$1" maxWidth={160}>
                  {showTrainerRating ? (
                    <XStack alignItems="center" gap="$1">
                      <AppIcon name="star" size={16} color="$accent" />
                      <Text fontSize="$4" fontWeight="700" color="$text">
                        {trainerRating.toFixed(1)}
                      </Text>
                    </XStack>
                  ) : null}
                  <Text fontSize="$2" color="$muted" textAlign="right">
                    {ratingCaption}
                  </Text>
                </YStack>
              ) : null}
            </XStack>
            {isLoading || loadingToken ? (
              <Text fontSize="$3" color="$muted">
                {t('common.loading')}
              </Text>
            ) : null}
            {error ? (
              <Text fontSize="$3" color="$muted">
                {error}
              </Text>
            ) : null}
          </YStack>

          <YStack gap="$3">
            {settingsItems.map((item) => (
              <Button
                key={item.id}
                backgroundColor="$background"
                borderRadius="$5"
                borderWidth={1}
                borderColor="$border"
                padding="$4"
                minHeight="$11"
                paddingVertical="$3"
                justifyContent="flex-start"
                onPress={item.onPress}
                disabled={item.disabled}
                opacity={item.disabled ? 0.5 : 1}
              >
                <XStack alignItems="center" gap="$3" flex={1}>
                  <AppIcon name={item.icon} size={20} color="$muted" />
                  <Text fontSize="$3" color="$text" flex={1}>
                    {item.label}
                  </Text>
                  <Text fontSize="$3" color="$muted">
                    {t('common.arrow')}
                  </Text>
                </XStack>
              </Button>
            ))}
          </YStack>
        </YStack>
      </ScrollView>
      <Button
        backgroundColor="$background"
        borderWidth={1}
        borderColor="$border"
        padding="$4"
        minHeight="$11"
        paddingVertical="$3"
        onPress={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
      >
        <Text fontSize="$3" color="$text">
          {t('profile.logout')}
        </Text>
      </Button>
    </YStack>
  );
}
