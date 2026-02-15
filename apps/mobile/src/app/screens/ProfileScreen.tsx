import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Button, Switch, Text, XStack, YStack } from 'tamagui';
import { logout } from '@api/authApi';
import { presentApiError } from '@api/ApiErrorPresenter';
import { getMe } from '@api/homeApi';
import { performLocalLogout } from '@auth/sessionManager';
import { t } from '@i18n';
import { useAppTheme } from '@app/theme/AppThemeContext';
import type { ProfileStackParamList, RootStackParamList } from '@app/navigation/types';
import { TabScrollView } from '@ui/layout/TabScrollView';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { Avatar, useAuthorizedImageSource } from '@ui/components';
import { ProfileSettingsList, type ProfileSettingsItem } from './profile/ui/ProfileSettingsList';
import { ProfileSupportSheet } from './profile/ui/ProfileSupportSheet';
import { ProfileTrainerRating } from './profile/ui/ProfileTrainerRating';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

export function ProfileScreen({ navigation }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const { isDark, setThemeName } = useAppTheme();

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
      ? [
          {
            id: 'trainer-clients',
            label: t('profile.settings.clients'),
            icon: 'users' as const,
            onPress: () => navigation.navigate('TrainerClients'),
          },
          {
            id: 'reports',
            label: t('profile.settings.reports'),
            icon: 'history' as const,
            onPress: () => navigation.navigate('TrainerReport'),
          },
        ]
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
      disabled: role !== 'Trainer',
      onPress: role === 'Trainer'
        ? () => navigation.getParent()?.navigate('Payments' as never)
        : undefined,
    },
    {
      id: 'notifications',
      label: t('profile.settings.notifications'),
      icon: 'alertCircle',
      onPress: () => navigation.navigate('Notifications'),
    },
    {
      id: 'theme',
      label: t('profile.settings.darkTheme'),
      rightSlot: (
        <Switch
          size="$7"
          checked={isDark}
          onCheckedChange={(value) =>
            setThemeName(value ? 'dark' : 'light')
          }
          backgroundColor={isDark ? '$accent' : '$surfaceMuted'}
          borderWidth={1}
          borderColor="$border"
        >
          <Switch.Thumb
            backgroundColor="$background"
            borderWidth={1}
            borderColor="$border"
          />
        </Switch>
      ),
      hideArrow: true,
    },
    {
      id: 'support',
      label: t('profile.settings.support'),
      icon: 'info',
      onPress: () => setIsSupportOpen(true),
    },
  ];

  const handleLogout = async () => {
    await performLocalLogout();
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
      <ProfileSupportSheet
        open={isSupportOpen}
        onOpenChange={setIsSupportOpen}
      />
    </YStack>
  );
}


