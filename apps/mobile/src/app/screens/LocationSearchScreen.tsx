import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useEffect, useState } from 'react';
import { getCities, getDistricts } from '@api/lookupsApi';
import { t } from '@i18n';
import { useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { AppIcon } from '@ui/AppIcon';
import { TabScrollView } from '@ui/layout/TabScrollView';
import type { AuthStackParamList, ProfileStackParamList } from '@app/navigation/types';
import { Button, Input, Text, XStack, YStack } from 'tamagui';

type Props =
  | NativeStackScreenProps<AuthStackParamList, 'LocationSearch'>
  | NativeStackScreenProps<ProfileStackParamList, 'LocationSearch'>;

const DEBOUNCE_MS = 300;

export function LocationSearchScreen({ navigation, route }: Props) {
  const { mode, cityId, cityName, returnTo, returnToKey } = route.params;
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

  const items = useMemo(
    () => (mode === 'city' ? citiesQuery.data ?? [] : districtsQuery.data ?? []),
    [citiesQuery.data, districtsQuery.data, mode]
  );
  const isLoading = mode === 'city' ? citiesQuery.isLoading : districtsQuery.isLoading;
  const showCityRequired = mode === 'district' && !cityId;
  const isEmpty = !isLoading && items.length === 0;
  const normalizedInput = query.trim();
  const hasExactMatch = items.some(
    (item) => item.name?.trim().toLowerCase() === normalizedInput.toLowerCase()
  );
  const canUseTypedValue = !showCityRequired
    && normalizedInput.length > 0
    && !isLoading
    && !hasExactMatch;

  const handleSelect = useCallback((id?: number | null, name?: string | null) => {
    if (!name) {
      return;
    }

    const locationSelection = mode === 'city'
      ? {
        cityId: typeof id === 'number' ? id : null,
        cityName: name,
        districtId: null,
        districtName: null,
      }
      : {
        districtId: typeof id === 'number' ? id : null,
        districtName: name,
        cityId: typeof cityId === 'number' ? cityId : null,
        cityName: cityName ?? null,
      };

    if (returnToKey) {
      navigation.dispatch({
        ...CommonActions.setParams({ locationSelection }),
        source: returnToKey,
      });
      navigation.goBack();
      return;
    }

    if (returnTo === 'Register') {
      const authNavigation =
        navigation as NativeStackScreenProps<AuthStackParamList, 'LocationSearch'>['navigation'];
      authNavigation.navigate('Register', {
        locationSelection,
      });
      return;
    }

    const profileNavigation =
      navigation as NativeStackScreenProps<ProfileStackParamList, 'LocationSearch'>['navigation'];

    if (mode === 'city') {
      profileNavigation.navigate('PersonalInfo', {
        locationSelection,
      });
      return;
    }

    profileNavigation.navigate('PersonalInfo', {
      locationSelection,
    });
  }, [cityId, cityName, mode, navigation, returnTo, returnToKey]);

  const renderList = useMemo(() => {
    if (showCityRequired) {
      return (
        <Text fontSize="$3" color="$muted">
          {t('location.search.selectCity')}
        </Text>
      );
    }

    return (
      <YStack gap="$2">
        {canUseTypedValue ? (
          <Button
            unstyled
            paddingVertical="$3"
            paddingHorizontal="$2"
            borderBottomWidth={1}
            borderColor="$border"
            onPress={() => handleSelect(null, normalizedInput)}
          >
            <Text fontSize="$4" color="$text" fontWeight="700">
              {mode === 'city'
                ? t('location.search.useTypedCity', { value: normalizedInput })
                : t('location.search.useTypedDistrict', { value: normalizedInput })}
            </Text>
          </Button>
        ) : null}
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
        {isEmpty ? (
          <Text fontSize="$3" color="$muted">
            {t('location.search.empty')}
          </Text>
        ) : null}
      </YStack>
    );
  }, [canUseTypedValue, handleSelect, isEmpty, items, mode, normalizedInput, showCityRequired]);

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
