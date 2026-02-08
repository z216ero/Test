import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Button, Text, XStack, YStack } from 'tamagui';
import { logout } from '@api/authApi';
import { presentApiError } from '@api/ApiErrorPresenter';
import { getMe } from '@api/homeApi';
import { clearSession } from '@auth/tokenStorage';
import { t } from '@i18n';
import type { ProfileStackParamList, RootStackParamList } from '@app/navigation/types';
import { TabScrollView } from '@ui/layout/TabScrollView';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { Avatar, useAuthorizedImageSource } from '@ui/components';
import { ProfileSettingsList, type ProfileSettingsItem } from './profile/ui/ProfileSettingsList';
import { ProfileTrainerRating } from './profile/ui/ProfileTrainerRating';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

export function ProfileScreen({ navigation }: Props) {
  const [error, setError] = useState<string | null>(null);

  const {
    data: me,
    isLoading,
    isStale,
    error: meError,
    refetch,
  } = useAppQuery({
    queryKey: keys.auth.me(),
    queryFn: ({ signal }) => getMe({ signal }),
  });

  useFocusEffect(
    useCallback(() => {
      if (!isLoading && isStale) {
        refetch();
      }
    }, [isLoading, isStale, refetch])
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
  const avatarSource = useAuthorizedImageSource(me?.avatarUrl);

  const settingsItems: ProfileSettingsItem[] = [
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

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <TabScrollView contentContainerStyle={{ padding: 24 }}>
        <YStack gap="$6">
          <YStack gap="$4">
            <XStack alignItems="flex-start" justifyContent="space-between" gap="$4">
              <XStack alignItems="center" gap="$4" flex={1}>
                <Avatar
                  name={me?.name}
                  source={avatarSource}
                  size="$11"
                  borderRadius="$6"
                  backgroundColor="$background"
                  textSize="$5"
                />
                <YStack gap="$1" flex={1}>
                  <Text fontSize="$6" fontWeight="700" color="$text">
                    {name}
                  </Text>
                  <Text fontSize="$3" color="$muted">
                    {roleLabel}
                  </Text>
                </YStack>
              </XStack>
              <ProfileTrainerRating
                role={role}
                showTrainerRating={showTrainerRating}
                trainerRating={trainerRating}
                ratingCaption={ratingCaption}
              />
            </XStack>
            {isLoading ? (
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

          <ProfileSettingsList items={settingsItems} />
        </YStack>
      </TabScrollView>
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


