import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ScrollView } from '@tamagui/scroll-view';
import { Button, Text, XStack, YStack } from 'tamagui';
import { logout } from '../../api/authApi';
import { getUiErrorMessage } from '../../api/core';
import { getMe } from '../../api/homeApi';
import { clearAccessToken } from '../../auth/tokenStorage';
import { t } from '../../i18n';
import type { AuthUserDto } from '../../generated/api';
import type { AppTabsParamList, RootStackParamList } from '../navigation/types';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

type Props = BottomTabScreenProps<AppTabsParamList, 'Profile'>;

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
  const [me, setMe] = useState<AuthUserDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const meData = await getMe();
      setMe(meData);
    } catch (err) {
      setError(getUiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const role = me?.role === 'Trainer' ? 'Trainer' : 'Client';
  const roleLabel =
    role === 'Trainer' ? t('profile.roleTrainer') : t('profile.roleClient');

  const name = me?.name?.trim() || t('common.unknownUser');

  const settingsItems = [
    { id: 'personal', label: t('profile.settings.personalInfo') },
    {
      id: 'schedule',
      label: role === 'Trainer'
        ? t('profile.settings.schedule')
        : t('profile.settings.bookings'),
    },
    { id: 'payments', label: t('profile.settings.payments'), disabled: true },
    { id: 'notifications', label: t('profile.settings.notifications') },
    { id: 'support', label: t('profile.settings.support') }
  ];

  const handleLogout = async () => {
    try {
      setError(null);
      await logout();
    } catch (err) {
      setError(getUiErrorMessage(err));
    } finally {
      await clearAccessToken();
      const rootNavigation =
        navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
      rootNavigation?.reset({ index: 0, routes: [{ name: 'Auth' }] });
    }
  };

  const tabBarHeight = useBottomTabBarHeight();
  console.log(tabBarHeight)
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
            <XStack alignItems="center" gap="$4">
              <YStack
                width="$12"
                height="$12"
                borderRadius="$6"
                backgroundColor="$background"
                borderWidth={1}
                borderColor="$border"
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize="$5" color="$muted">
                  {getInitials(me?.name)}
                </Text>
              </YStack>
              <YStack gap="$1">
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
              </YStack>
            </XStack>
            {loading ? (
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
                onPress={() => { }}
                disabled={item.disabled}
                opacity={item.disabled ? 0.5 : 1}
              >
                <XStack alignItems="center" gap="$3" flex={1}>
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
        onPress={handleLogout}
      >
        <Text fontSize="$3" color="$text">
          {t('profile.logout')}
        </Text>
      </Button>
    </YStack>
  );
}
