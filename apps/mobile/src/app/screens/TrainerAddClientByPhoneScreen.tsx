import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Button, Spinner, Text, XStack, YStack } from 'tamagui';
import { ApiError } from '@api/core';
import {
  requestTrainerClientLink,
  searchTrainerClientByPhone,
  type SearchTrainerClientByPhoneResult,
} from '@api/clientLinksApi';
import { t } from '@i18n';
import { useAppMutation } from '@query/hooks';
import { keys } from '@query/keys';
import { useQueryClient } from '@tanstack/react-query';
import { PhoneInput } from '@ui/components';
import { useToast } from '@ui/feedback/useToast';
import { AppIcon } from '@ui/AppIcon';
import { TabScrollView } from '@ui/layout/TabScrollView';
import type { ProfileStackParamList } from '@app/navigation/types';
import { russianPhoneToE164 } from '@utils/phone';

type Props = NativeStackScreenProps<ProfileStackParamList, 'TrainerAddClientByPhone'>;

type SearchState = 'idle' | 'searching' | 'found' | 'not_found';

const getRetryAfterText = (error: ApiError): string | null => {
  const details = error.details as { retryAfterUtc?: string | null } | null;
  const value = details?.retryAfterUtc?.trim();
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString();
};

export function TrainerAddClientByPhoneScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<SearchState>('idle');
  const [found, setFound] = useState<SearchTrainerClientByPhoneResult | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [requestBlocked, setRequestBlocked] = useState(false);

  const normalizedPhone = useMemo(() => russianPhoneToE164(phone), [phone]);

  const searchMutation = useAppMutation({
    mutationFn: (value: string) => searchTrainerClientByPhone(value),
    onMutate: () => {
      setErrorText(null);
      setRequestBlocked(false);
      setFound(null);
      setState('searching');
    },
    onSuccess: (result) => {
      setFound(result);
      setState('found');
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 404) {
        setState('not_found');
        return;
      }

      setState('idle');
      setErrorText(error instanceof Error ? error.message : t('errors.generic'));
    },
  });

  const requestMutation = useAppMutation({
    mutationFn: (clientUserId: string) => requestTrainerClientLink(clientUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.myClients() });
      queryClient.invalidateQueries({ queryKey: keys.trainerClients.list() });
      showToast({
        type: 'success',
        title: t('trainerClients.addLinkRequestSent'),
      });
      navigation.goBack();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        const retryAfter = getRetryAfterText(error);
        if (retryAfter) {
          setErrorText(t('trainerClients.reRequestAfter', { date: retryAfter }));
        } else {
          setErrorText(t('trainerClients.linkAlreadyRequested'));
        }
        setRequestBlocked(true);
        return;
      }

      setErrorText(error instanceof Error ? error.message : t('errors.generic'));
    },
  });

  const handleSearch = () => {
    if (!normalizedPhone) {
      setErrorText(t('trainerClients.phoneInvalid'));
      return;
    }

    searchMutation.mutate(normalizedPhone);
  };

  const goToLocalClient = () => {
    navigation.navigate('TrainerClientForm', {
      initialPhone: phone.trim() || undefined,
      returnToList: true,
    });
  };

  const handleSendRequest = () => {
    if (!found?.clientUserId || requestMutation.isPending || requestBlocked) {
      return;
    }

    requestMutation.mutate(found.clientUserId);
  };

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <TabScrollView>
        <YStack padding="$6" gap="$4">
          <XStack alignItems="center" gap="$2">
            <Button unstyled onPress={() => navigation.goBack()}>
              <AppIcon name="chevronLeft" size={18} color="$muted" />
            </Button>
            <Text fontSize="$8" fontWeight="700" color="$text">
              {t('trainerClients.add')}
            </Text>
          </XStack>

          <YStack gap="$2">
            <Text fontSize="$3" color="$text">
              {t('trainerClients.form.phone')}
            </Text>
            <PhoneInput
              value={phone}
              onChangeText={(value) => {
                setPhone(value);
                setState('idle');
                setFound(null);
                setErrorText(null);
                setRequestBlocked(false);
              }}
              placeholder={t('trainerClients.form.phonePlaceholder')}
            />
          </YStack>

          <Button
            backgroundColor="$accent"
            color="$accentText"
            borderRadius="$4"
            minHeight="$10"
            onPress={handleSearch}
            disabled={searchMutation.isPending || requestMutation.isPending}
          >
            {t('trainerClients.searchByPhone')}
          </Button>

          {state === 'searching' ? (
            <XStack alignItems="center" gap="$2">
              <Spinner size="small" color="$muted" />
              <Text fontSize="$3" color="$muted">
                {t('common.loading')}
              </Text>
            </XStack>
          ) : null}

          {state === 'found' && found ? (
            <YStack
              gap="$3"
              backgroundColor="$background"
              borderWidth={1}
              borderColor="$border"
              borderRadius="$5"
              padding="$4"
            >
              <Text fontSize="$4" fontWeight="700" color="$text">
                {found.displayName}
              </Text>
              <Text fontSize="$3" color="$muted">
                {found.maskedPhone}
              </Text>
              <Button
                backgroundColor="$accent"
                color="$accentText"
                borderRadius="$4"
                minHeight="$10"
                onPress={handleSendRequest}
                disabled={requestMutation.isPending || requestBlocked}
              >
                {requestMutation.isPending
                  ? t('common.loading')
                  : t('trainerClients.sendLinkRequest')}
              </Button>
              <Button
                backgroundColor="$background"
                borderWidth={1}
                borderColor="$border"
                borderRadius="$4"
                minHeight="$10"
                onPress={goToLocalClient}
              >
                <Text color="$text">{t('trainerClients.localClient')}</Text>
              </Button>
            </YStack>
          ) : null}

          {state === 'not_found' ? (
            <YStack gap="$3">
              <YStack
                backgroundColor="$background"
                borderWidth={1}
                borderColor="$border"
                borderRadius="$5"
                padding="$4"
              >
                <Text fontSize="$3" color="$muted">
                  {t('trainerClients.phoneNotFound')}
                </Text>
              </YStack>
              <Button
                backgroundColor="$background"
                borderWidth={1}
                borderColor="$border"
                borderRadius="$4"
                minHeight="$10"
                onPress={goToLocalClient}
              >
                <Text color="$text">{t('trainerClients.localClient')}</Text>
              </Button>
            </YStack>
          ) : null}

          {errorText ? (
            <Text fontSize="$3" color="$danger">
              {errorText}
            </Text>
          ) : null}
        </YStack>
      </TabScrollView>
    </YStack>
  );
}
