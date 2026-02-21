import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { RefreshControl } from 'react-native';
import { Sheet } from '@tamagui/sheet';
import { Button, Spinner, Text, XStack, YStack } from 'tamagui';
import { archiveTrainerClient, getTrainerClientsList } from '@api/trainerClientsApi';
import {
  getTrainerClientLinks,
  revokeTrainerClientLink,
  type TrainerClientLink,
} from '@api/clientLinksApi';
import { t } from '@i18n';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { useQueryClient } from '@tanstack/react-query';
import { FormInput } from '@ui/components';
import { useToast } from '@ui/feedback/useToast';
import { AppIcon } from '@ui/AppIcon';
import { TabScrollView } from '@ui/layout/TabScrollView';
import type { ProfileStackParamList } from '@app/navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'TrainerClients'>;

type ClientKind = 'local' | 'linked';

type MyClientItem = {
  key: string;
  kind: ClientKind;
  displayName: string;
  phone?: string | null;
  localId?: string;
  link?: TrainerClientLink;
};

const hiddenOverlayStyle = { opacity: 0 } as const;

const normalize = (value?: string | null): string =>
  (value ?? '').trim().toLowerCase();

const linkStatusLabel = (status?: string): string => {
  switch ((status ?? '').toLowerCase()) {
    case 'accepted':
      return t('trainerClients.statusAccepted');
    case 'pending':
      return t('trainerClients.statusPending');
    case 'rejected':
      return t('trainerClients.statusRejected');
    default:
      return t('common.empty');
  }
};

export function TrainerClientsScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [activeItem, setActiveItem] = useState<MyClientItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const localQuery = useAppQuery({
    queryKey: keys.trainerClients.list({ status: 'Active' }),
    queryFn: ({ signal }) => getTrainerClientsList({ status: 'Active' }, { signal }),
  });

  const linksQuery = useAppQuery({
    queryKey: keys.myClients(),
    queryFn: () => getTrainerClientLinks(),
  });

  const localClients = useMemo(() => localQuery.data ?? [], [localQuery.data]);
  const linkedClients = useMemo(() => linksQuery.data ?? [], [linksQuery.data]);

  const merged = useMemo<MyClientItem[]>(() => {
    const localItems = localClients.map((client) => ({
      key: `local-${client.id}`,
      kind: 'local' as const,
      displayName: client.displayName ?? t('common.empty'),
      phone: client.phone,
      localId: client.id,
    }));

    const linkedItems = linkedClients.map((link) => ({
      key: `link-${link.id}`,
      kind: 'linked' as const,
      displayName: link.clientName?.trim() || t('common.empty'),
      phone: link.clientPhone,
      link,
    }));

    return [...linkedItems, ...localItems];
  }, [linkedClients, localClients]);

  const filtered = useMemo(() => {
    const query = normalize(search);
    if (!query) {
      return merged;
    }

    return merged.filter((item) => normalize(item.displayName).includes(query));
  }, [merged, search]);

  const refreshAll = async () => {
    setIsManualRefreshing(true);
    try {
      await Promise.allSettled([localQuery.refetch(), linksQuery.refetch()]);
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const archiveMutation = useAppMutation({
    mutationFn: (clientId: string) => archiveTrainerClient(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trainerClients.list() });
      queryClient.invalidateQueries({ queryKey: keys.myClients() });
      setSheetOpen(false);
      setActiveItem(null);
      showToast({ type: 'success', title: t('trainerClients.removed') });
    },
    onError: () => {
      showToast({ type: 'error', title: t('errors.generic') });
    },
  });

  const revokeMutation = useAppMutation({
    mutationFn: (linkId: string) => revokeTrainerClientLink(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.myClients() });
      setSheetOpen(false);
      setActiveItem(null);
      showToast({ type: 'success', title: t('trainerClients.removed') });
    },
    onError: () => {
      showToast({ type: 'error', title: t('errors.generic') });
    },
  });

  const isBusy = archiveMutation.isPending || revokeMutation.isPending;

  const handleRemove = () => {
    if (!activeItem || isBusy) {
      return;
    }

    if (activeItem.kind === 'local' && activeItem.localId) {
      archiveMutation.mutate(activeItem.localId);
      return;
    }

    if (activeItem.kind === 'linked' && activeItem.link?.id) {
      revokeMutation.mutate(activeItem.link.id);
    }
  };

  const openDetails = (item: MyClientItem) => {
    setActiveItem(item);
    setSheetOpen(true);
  };

  const isLoading = localQuery.isLoading || linksQuery.isLoading;

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <TabScrollView
        refreshControl={(
          <RefreshControl
            refreshing={isManualRefreshing && (localQuery.isFetching || linksQuery.isFetching)}
            onRefresh={refreshAll}
          />
        )}
      >
        <YStack padding="$6" gap="$4">
          <XStack alignItems="center" justifyContent="space-between" gap="$3">
            <XStack alignItems="center" gap="$2">
              <Button unstyled onPress={() => navigation.goBack()}>
                <AppIcon name="chevronLeft" size={18} color="$muted" />
              </Button>
              <Text fontSize="$8" fontWeight="700" color="$text">
                {t('trainerClients.title')}
              </Text>
            </XStack>
            <Button
              backgroundColor="$accent"
              color="$accentText"
              borderRadius="$4"
              minHeight="$10"
              paddingHorizontal="$4"
              onPress={() => navigation.navigate('TrainerAddClientByPhone')}
            >
              {t('trainerClients.add')}
            </Button>
          </XStack>

          <FormInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('trainerClients.searchPlaceholder')}
            height={52}
          />

          {isLoading ? (
            <XStack alignItems="center" gap="$2">
              <Spinner size="small" color="$muted" />
              <Text fontSize="$3" color="$muted">{t('common.loading')}</Text>
            </XStack>
          ) : null}

          {!isLoading && filtered.length === 0 ? (
            <Text fontSize="$3" color="$muted">{t('trainerClients.empty')}</Text>
          ) : null}

          <YStack gap="$3">
            {filtered.map((item) => (
              <Button
                key={item.key}
                backgroundColor="$background"
                borderWidth={1}
                borderColor="$border"
                borderRadius="$5"
                minHeight="$10"
                paddingHorizontal="$4"
                paddingVertical="$3"
                onPress={() => openDetails(item)}
              >
                <XStack alignItems="center" gap="$3" width="100%">
                  <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
                    <Text fontSize="$4" fontWeight="700" color="$text" numberOfLines={1}>
                      {item.displayName}
                    </Text>
                    {item.phone ? (
                      <Text fontSize="$3" color="$muted" numberOfLines={1}>
                        {item.phone}
                      </Text>
                    ) : null}
                    {item.kind === 'linked' ? (
                      <XStack
                        backgroundColor="$backgroundSoft"
                        borderWidth={1}
                        borderColor="$border"
                        borderRadius="$3"
                        paddingHorizontal="$2"
                        paddingVertical="$1"
                      >
                        <Text fontSize="$2" color="$muted" numberOfLines={1}>
                          {linkStatusLabel(item.link?.status)}
                        </Text>
                      </XStack>
                    ) : null}
                  </XStack>
                  <AppIcon name="chevronRight" size={16} color="$muted" />
                </XStack>
              </Button>
            ))}
          </YStack>
        </YStack>
      </TabScrollView>

      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        dismissOnSnapToBottom
        snapPoints={[45]}
        dismissOnOverlayPress={!isBusy}
      >
        <Sheet.Overlay
          animation="fast"
          enterStyle={hiddenOverlayStyle}
          exitStyle={hiddenOverlayStyle}
          backgroundColor="rgba(15, 23, 42, 0.2)"
        />
        <Sheet.Frame
          padding="$5"
          gap="$3"
          backgroundColor="$backgroundSoft"
          borderTopLeftRadius="$6"
          borderTopRightRadius="$6"
        >
          <Sheet.Handle />
          <Text fontSize="$6" fontWeight="700" color="$text">
            {activeItem?.displayName ?? t('common.empty')}
          </Text>
          <Text fontSize="$3" color="$muted">
            {activeItem?.phone ?? t('common.empty')}
          </Text>
          <Text fontSize="$3" color="$muted">
            {activeItem?.kind === 'linked'
              ? t('trainerClients.typeLinked')
              : t('trainerClients.typeLocal')}
          </Text>
          <Button
            backgroundColor="$background"
            borderWidth={1}
            borderColor="$danger"
            borderRadius="$4"
            minHeight="$10"
            onPress={handleRemove}
            disabled={isBusy || !activeItem}
          >
            <Text color="$danger">
              {isBusy ? t('common.loading') : t('trainerClients.remove')}
            </Text>
          </Button>
        </Sheet.Frame>
      </Sheet>
    </YStack>
  );
}
