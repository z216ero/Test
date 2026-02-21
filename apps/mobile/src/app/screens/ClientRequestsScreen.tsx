import { useMemo } from 'react';
import { Button, Spinner, Text, XStack, YStack } from 'tamagui';
import { useNavigation } from '@react-navigation/native';
import {
  acceptClientLinkRequest,
  getClientAcceptedLinks,
  getClientLinkRequests,
  rejectClientLinkRequest,
  revokeClientLink,
} from '@api/clientLinksApi';
import { presentApiError } from '@api/ApiErrorPresenter';
import { t } from '@i18n';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { useQueryClient } from '@tanstack/react-query';
import { AppIcon } from '@ui/AppIcon';
import { Avatar } from '@ui/components';
import { TabScrollView } from '@ui/layout/TabScrollView';
import { useToast } from '@ui/feedback/useToast';

export function ClientRequestsScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const requestsQuery = useAppQuery({
    queryKey: keys.clientRequests(),
    queryFn: ({ signal }) => getClientLinkRequests().then((data) => {
      if (signal.aborted) {
        return [];
      }
      return data;
    }),
  });

  const acceptedLinksQuery = useAppQuery({
    queryKey: ['client', 'links', 'accepted'] as const,
    queryFn: ({ signal }) => getClientAcceptedLinks().then((data) => {
      if (signal.aborted) {
        return [];
      }
      return data;
    }),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: keys.clientRequests() });
    queryClient.invalidateQueries({ queryKey: ['client', 'links', 'accepted'] as const });
    queryClient.invalidateQueries({ queryKey: keys.pendingLinkRequestsCount() });
    queryClient.invalidateQueries({ queryKey: keys.pendingBookingConfirmationsCount() });
    queryClient.invalidateQueries({ queryKey: keys.auth.me() });
  };

  const acceptMutation = useAppMutation({
    mutationFn: (linkId: string) => acceptClientLinkRequest(linkId),
    onSuccess: () => {
      invalidateAll();
      showToast({ type: 'success', title: t('clientRequests.accepted') });
    },
    onError: (error) => {
      const presented = presentApiError(error);
      showToast({ type: 'error', title: presented.title, message: presented.message });
    },
  });

  const rejectMutation = useAppMutation({
    mutationFn: (linkId: string) => rejectClientLinkRequest(linkId),
    onSuccess: () => {
      invalidateAll();
      showToast({ type: 'success', title: t('clientRequests.rejected') });
    },
    onError: (error) => {
      const presented = presentApiError(error);
      showToast({ type: 'error', title: presented.title, message: presented.message });
    },
  });

  const revokeMutation = useAppMutation({
    mutationFn: (linkId: string) => revokeClientLink(linkId),
    onSuccess: () => {
      invalidateAll();
      showToast({ type: 'success', title: t('clientRequests.linkRemoved') });
    },
    onError: (error) => {
      const presented = presentApiError(error);
      showToast({ type: 'error', title: presented.title, message: presented.message });
    },
  });

  const isBusy = acceptMutation.isPending || rejectMutation.isPending || revokeMutation.isPending;
  const pending = useMemo(() => requestsQuery.data ?? [], [requestsQuery.data]);
  const accepted = useMemo(() => acceptedLinksQuery.data ?? [], [acceptedLinksQuery.data]);

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <TabScrollView>
        <YStack padding="$6" gap="$4">
          <XStack alignItems="center" gap="$2">
            <Button unstyled onPress={() => navigation.goBack()}>
              <AppIcon name="chevronLeft" size={18} color="$muted" />
            </Button>
            <Text fontSize="$8" fontWeight="700" color="$text">
              {t('clientRequests.title')}
            </Text>
          </XStack>

          <YStack gap="$3">
            <Text fontSize="$5" fontWeight="700" color="$text">
              {t('clientRequests.pendingSection')}
            </Text>
            {requestsQuery.isLoading ? (
              <XStack alignItems="center" gap="$2">
                <Spinner size="small" color="$muted" />
                <Text fontSize="$3" color="$muted">{t('common.loading')}</Text>
              </XStack>
            ) : null}
            {!requestsQuery.isLoading && pending.length === 0 ? (
              <Text fontSize="$3" color="$muted">
                {t('clientRequests.empty')}
              </Text>
            ) : null}
            {pending.map((item) => (
              <YStack
                key={item.id}
                gap="$3"
                backgroundColor="$background"
                borderWidth={1}
                borderColor="$border"
                borderRadius="$5"
                padding="$4"
              >
                <XStack alignItems="center" gap="$3">
                  <Avatar
                    name={item.trainerName}
                    size="$10"
                    borderRadius="$6"
                    backgroundColor="$surfaceMuted"
                    borderColor="$border"
                    borderWidth={1}
                    textSize="$3"
                  />
                  <YStack gap="$1" flex={1}>
                    <Text fontSize="$4" fontWeight="700" color="$text" numberOfLines={1}>
                      {item.trainerName?.trim() || t('common.empty')}
                    </Text>
                    {item.trainerCityName ? (
                      <Text fontSize="$3" color="$muted" numberOfLines={1}>
                        {item.trainerCityName}
                      </Text>
                    ) : null}
                  </YStack>
                </XStack>
                <XStack gap="$2">
                  <Button
                    flex={1}
                    backgroundColor="$accent"
                    color="$accentText"
                    borderRadius="$4"
                    minHeight="$10"
                    onPress={() => item.id && acceptMutation.mutate(item.id)}
                    disabled={!item.id || isBusy}
                  >
                    {t('clientRequests.accept')}
                  </Button>
                  <Button
                    flex={1}
                    backgroundColor="$background"
                    borderWidth={1}
                    borderColor="$border"
                    borderRadius="$4"
                    minHeight="$10"
                    onPress={() => item.id && rejectMutation.mutate(item.id)}
                    disabled={!item.id || isBusy}
                  >
                    <Text color="$text">{t('clientRequests.reject')}</Text>
                  </Button>
                </XStack>
              </YStack>
            ))}
          </YStack>

          <YStack gap="$3">
            <Text fontSize="$5" fontWeight="700" color="$text">
              {t('clientRequests.trainersSection')}
            </Text>
            {acceptedLinksQuery.isLoading ? (
              <XStack alignItems="center" gap="$2">
                <Spinner size="small" color="$muted" />
                <Text fontSize="$3" color="$muted">{t('common.loading')}</Text>
              </XStack>
            ) : null}
            {!acceptedLinksQuery.isLoading && accepted.length === 0 ? (
              <Text fontSize="$3" color="$muted">
                {t('clientRequests.trainersEmpty')}
              </Text>
            ) : null}
            {accepted.map((item) => (
              <YStack
                key={item.id}
                gap="$1"
                backgroundColor="$background"
                borderWidth={1}
                borderColor="$border"
                borderRadius="$5"
                padding="$4"
              >
                <XStack alignItems="center" gap="$3">
                  <Avatar
                    name={item.trainerName}
                    size="$10"
                    borderRadius="$6"
                    backgroundColor="$surfaceMuted"
                    borderColor="$border"
                    borderWidth={1}
                    textSize="$3"
                  />
                  <YStack flex={1} minWidth={0}>
                    <Text fontSize="$4" fontWeight="700" color="$text" numberOfLines={1}>
                      {item.trainerName?.trim() || t('common.empty')}
                    </Text>
                    {item.trainerCityName ? (
                      <Text fontSize="$3" color="$muted" numberOfLines={1}>
                        {item.trainerCityName}
                      </Text>
                    ) : null}
                  </YStack>
                  <Button
                    unstyled
                    width="$8"
                    height="$8"
                    borderRadius="$4"
                    alignItems="center"
                    justifyContent="center"
                    backgroundColor="$backgroundSoft"
                    borderWidth={1}
                    borderColor="$danger"
                    hitSlop={8}
                    onPress={() => item.id && revokeMutation.mutate(item.id)}
                    disabled={!item.id || isBusy}
                  >
                    <AppIcon name="trash" size={16} color="$danger" />
                  </Button>
                </XStack>
              </YStack>
            ))}
          </YStack>
        </YStack>
      </TabScrollView>
    </YStack>
  );
}
