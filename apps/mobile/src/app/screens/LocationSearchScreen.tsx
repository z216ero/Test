import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useEffect, useState } from 'react';
import { getCities, getDistricts } from '@api/lookupsApi';
import { t } from '@i18n';
import { useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { AppIcon } from '@ui/AppIcon';
import { TabScrollView } from '@ui/layout/TabScrollView';
import type { AuthStackParamList, ProfileStackParamList } from '@app/navigation/types';
import { Button, Input, ScrollView, Text, XStack, YStack } from 'tamagui';

type Props =
  | NativeStackScreenProps<AuthStackParamList, 'LocationSearch'>
  | NativeStackScreenProps<ProfileStackParamList, 'LocationSearch'>;

const DEBOUNCE_MS = 300;

export function LocationSearchScreen({ navigation, route }: Props) {
  const { mode, cityId, cityName, returnTo } = route.params;
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(query);
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const title = mode === 'city'
    ? t('location.search.titleCity')
    : t('location.search.titleDistrict');

  const cityQuery = debouncedQuery.trim();
  const districtQuery = debouncedQuery.trim();

  const citiesQuery = useAppQuery({
    queryKey: keys.lookups.cities(cityQuery || undefined),
    enabled: mode === 'city',
    queryFn: ({ signal }) => getCities(cityQuery, { signal }),
  });

  const districtsQuery = useAppQuery({
    queryKey: keys.lookups.districts(cityId ?? undefined, districtQuery || undefined),
    enabled: mode === 'district' && Boolean(cityId),
    queryFn: ({ signal }) => getDistricts(cityId ?? undefined, districtQuery, { signal }),
  });

  const items = mode === 'city' ? citiesQuery.data ?? [] : districtsQuery.data ?? [];
  const isLoading = mode === 'city' ? citiesQuery.isLoading : districtsQuery.isLoading;

  const isEmpty = !isLoading && items.length === 0;
  const showCityRequired = mode === 'district' && !cityId;

  const handleSelect = (id?: number | null, name?: string | null) => {
    if (!name) {
      return;
    }

    if (returnTo === 'Register') {
      const authNavigation =
        navigation as NativeStackScreenProps<AuthStackParamList, 'LocationSearch'>['navigation'];
      authNavigation.navigate('Register', {
        locationSelection: {
          cityId: mode === 'city'
            ? (typeof id === 'number' ? id : null)
            : (typeof cityId === 'number' ? cityId : null),
          cityName: mode === 'city' ? name : cityName ?? null,
          districtId: mode === 'district' ? (typeof id === 'number' ? id : null) : undefined,
          districtName: mode === 'district' ? name : undefined,
        },
      });
      return;
    }

    const profileNavigation =
      navigation as NativeStackScreenProps<ProfileStackParamList, 'LocationSearch'>['navigation'];

    if (mode === 'city') {
      profileNavigation.navigate('PersonalInfo', {
        locationSelection: {
          cityId: typeof id === 'number' ? id : null,
          cityName: name,
          districtId: null,
          districtName: null,
        },
      });
      return;
    }

    profileNavigation.navigate('PersonalInfo', {
      locationSelection: {
        districtId: typeof id === 'number' ? id : null,
        districtName: name,
        cityId: typeof cityId === 'number' ? cityId : null,
        cityName: cityName ?? null,
      },
    });
  };

  const renderList = useMemo(() => {
    if (showCityRequired) {
      return (
        <Text fontSize="$3" color="$muted">
          {t('location.search.selectCity')}
        </Text>
      );
    }

    if (isEmpty) {
      return (
        <Text fontSize="$3" color="$muted">
          {t('location.search.empty')}
        </Text>
      );
    }

    return (
      <YStack gap="$2">
        {items.map((item) => (
          <Button
            key={`${mode}-${item.id ?? item.name}`}
            unstyled
            paddingVertical="$3"
            paddingHorizontal="$2"
            borderBottomWidth={1}
            borderColor="$border"
            onPress={() => handleSelect(item.id ?? null, item.name ?? null)}
          >
            <Text fontSize="$4" color="$text">
              {item.name}
            </Text>
          </Button>
        ))}
      </YStack>
    );
  }, [handleSelect, isEmpty, items, mode, showCityRequired]);

  return (
    <YStack flex={1} backgroundColor="$background">
      <YStack padding="$4" borderBottomWidth={1} borderColor="$border" gap="$3">
        <XStack alignItems="center" gap="$3">
          <Button unstyled onPress={() => navigation.goBack()}>
            <AppIcon name="chevronLeft" size={20} color="$muted" />
          </Button>
          <Text fontSize="$6" fontWeight="700" color="$text">
            {title}
          </Text>
        </XStack>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={t('location.search.placeholder')}
          autoCapitalize="words"
          borderRadius="$4"
          height={40}
        />
      </YStack>

      <TabScrollView contentContainerStyle={{ padding: 16 }}>
        <YStack gap="$3">
          {isLoading ? (
            <Text fontSize="$3" color="$muted">
              {t('common.loading')}
            </Text>
          ) : null}
          {renderList}
        </YStack>
      </TabScrollView>
    </YStack>
  );
}
