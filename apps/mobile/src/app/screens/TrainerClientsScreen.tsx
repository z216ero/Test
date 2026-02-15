import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { RefreshControl } from 'react-native';
import { Sheet } from '@tamagui/sheet';
import { Button, Text, XStack, YStack } from 'tamagui';
import {
  archiveTrainerClient,
  getTrainerClientsList,
  updateTrainerClient,
} from '@api/trainerClientsApi';
import { presentApiError, shouldShowErrorToast } from '@api/ApiErrorPresenter';
import type { TrainerClientDto } from '@generated/api';
import { t } from '@i18n';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { useQueryClient } from '@tanstack/react-query';
import { FormInput, PhoneInput } from '@ui/components';
import { useToast } from '@ui/feedback/useToast';
import { AppIcon } from '@ui/AppIcon';
import { TabScrollView } from '@ui/layout/TabScrollView';
import { EmptyState } from '@ui/states/EmptyState';
import { ErrorState } from '@ui/states/ErrorState';
import { LoadingState } from '@ui/states/LoadingState';
import type { ProfileStackParamList } from '@app/navigation/types';
import { normalizeRussianPhoneInput } from '@utils/phone';

type Props = NativeStackScreenProps<ProfileStackParamList, 'TrainerClients'>;

const normalize = (value?: string | null): string =>
  (value ?? '').trim().toLowerCase();
const hiddenOverlayStyle = { opacity: 0 } as const;
const trimToUndefined = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export function TrainerClientsScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeClient, setActiveClient] = useState<TrainerClientDto | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [sheetError, setSheetError] = useState<string | null>(null);

  const clientsQuery = useAppQuery({
    queryKey: keys.trainerClients.list({ status: 'Active' }),
    queryFn: ({ signal }) => getTrainerClientsList({ status: 'Active' }, { signal }),
  });

  const clients = useMemo(() => clientsQuery.data ?? [], [clientsQuery.data]);
  const filteredClients = useMemo(() => {
    const query = normalize(search);
    if (!query) {
      return clients;
    }

    return clients.filter((client) =>
      normalize(client.displayName).includes(query)
    );
  }, [clients, search]);

  const archiveMutation = useAppMutation({
    mutationFn: (clientId: string) => archiveTrainerClient(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trainerClients.list() });
      setSheetOpen(false);
      setActiveClient(null);
    },
    onError: (err) => {
      const presented = presentApiError(err);
      const message = presented.kind === 'conflict'
        ? t('trainerClients.errorPhoneInUse')
        : presented.message;
      setSheetError(message);
      if (shouldShowErrorToast(presented)) {
        showToast({
          type: 'error',
          title: presented.title,
          message,
        });
      }
    },
  });

  const updateMutation = useAppMutation({
    mutationFn: (payload: { id: string; displayName: string; phone: string; notes: string }) =>
      updateTrainerClient(payload.id, {
        displayName: trimToUndefined(payload.displayName),
        phone: trimToUndefined(payload.phone),
        notes: trimToUndefined(payload.notes),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trainerClients.list() });
      setSheetError(null);
      setSheetOpen(false);
      setActiveClient(null);
    },
    onError: (err) => {
      const presented = presentApiError(err);
      const message = presented.kind === 'conflict'
        ? t('trainerClients.errorPhoneInUse')
        : presented.message;
      setSheetError(message);
      if (shouldShowErrorToast(presented)) {
        showToast({
          type: 'error',
          title: presented.title,
          message,
        });
      }
    },
  });

  const handleRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await clientsQuery.refetch();
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const openClientActions = (client: TrainerClientDto) => {
    setActiveClient(client);
    setEditDisplayName(client.displayName ?? '');
    setEditPhone(client.phone?.trim() ? normalizeRussianPhoneInput(client.phone) : '');
    setEditNotes(client.notes ?? '');
    setSheetError(null);
    setSheetOpen(true);
  };

  const handleSave = () => {
    if (!activeClient?.id || updateMutation.isPending) {
      return;
    }

    const nameLength = editDisplayName.trim().length;
    const phoneLength = editPhone.trim().length;
    const notesLength = editNotes.trim().length;
    if (nameLength === 0 || nameLength > 100 || phoneLength > 30 || notesLength > 500) {
      setSheetError(t('trainerClients.form.validation'));
      return;
    }

    setSheetError(null);
    updateMutation.mutate({
      id: activeClient.id,
      displayName: editDisplayName,
      phone: editPhone,
      notes: editNotes,
    });
  };

  const handleCreateTraining = () => {
    const clientId = activeClient?.id;
    if (!clientId) {
      return;
    }
    setSheetOpen(false);
    navigation.getParent()?.navigate('CreateSlot', {
      assignTrainerClientId: clientId,
    });
  };

  const handleArchive = () => {
    const clientId = activeClient?.id;
    if (!clientId || archiveMutation.isPending) {
      return;
    }
    setSheetError(null);
    archiveMutation.mutate(clientId);
  };

  const renderContent = () => {
    if (clientsQuery.isLoading) {
      return <LoadingState />;
    }

    if (clientsQuery.error) {
      return <ErrorState error={clientsQuery.error} onRetry={handleRefresh} />;
    }

    if (filteredClients.length === 0) {
      return <EmptyState title={t('trainerClients.empty')} />;
    }

    return (
      <YStack gap="$3">
        {filteredClients.map((client) => {
          const id = client.id ?? `${client.displayName ?? 'client'}`;
          const phone = client.phone?.trim();
          const notes = client.notes?.trim();
          return (
            <Button
              key={id}
              backgroundColor="$background"
              borderWidth={1}
              borderColor="$border"
              borderRadius="$5"
              minHeight="100"
              padding="$4"
              paddingVertical="$3"
              justifyContent="flex-start"
              onPress={() => openClientActions(client)}
              disabled={archiveMutation.isPending || updateMutation.isPending}
            >
              <YStack flex={1} gap="$2" alignItems="flex-start">
                <XStack width="100%" alignItems="center" justifyContent="space-between" gap="$3">
                  <Text fontSize="$4" fontWeight="700" color="$text" numberOfLines={1} flex={1}>
                    {client.displayName?.trim() || t('common.empty')}
                  </Text>
                  <AppIcon name="chevronRight" size={16} color="$muted" />
                </XStack>
                {phone ? (
                  <Text fontSize="$3" color="$muted" numberOfLines={1}>
                    {phone}
                  </Text>
                ) : null}
                {notes ? (
                  <Text fontSize="$3" color="$muted" numberOfLines={1}>
                    {notes}
                  </Text>
                ) : null}
              </YStack>
            </Button>
          );
        })}
      </YStack>
    );
  };

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <TabScrollView
        refreshControl={
          <RefreshControl
            refreshing={isManualRefreshing && clientsQuery.isFetching}
            onRefresh={handleRefresh}
          />
        }
      >
        <YStack gap="$4" padding="$6">
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
              onPress={() => navigation.navigate('TrainerClientForm')}
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
          {renderContent()}
        </YStack>
      </TabScrollView>
      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        dismissOnSnapToBottom
        snapPoints={[72]}
        dismissOnOverlayPress={!archiveMutation.isPending && !updateMutation.isPending}
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
            {t('trainerClients.edit')}
          </Text>
          <YStack gap="$2">
            <Text fontSize="$3" color="$text">
              {t('trainerClients.form.name')}
            </Text>
            <FormInput
              value={editDisplayName}
              onChangeText={setEditDisplayName}
              placeholder={t('trainerClients.form.namePlaceholder')}
              maxLength={100}
              height={52}
            />
          </YStack>
          <YStack gap="$2">
            <Text fontSize="$3" color="$text">
              {t('trainerClients.form.phone')}
            </Text>
            <PhoneInput
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder={t('trainerClients.form.phonePlaceholder')}
              maxLength={30}
              height={52}
            />
          </YStack>
          <YStack gap="$2">
            <Text fontSize="$3" color="$text">
              {t('trainerClients.form.notes')}
            </Text>
            <FormInput
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder={t('trainerClients.form.notesPlaceholder')}
              maxLength={500}
              height={52}
            />
          </YStack>
          {sheetError ? (
            <Text fontSize="$3" color="$danger">
              {sheetError}
            </Text>
          ) : null}
          <Button
            backgroundColor="$accent"
            color="$accentText"
            borderRadius="$4"
            minHeight="$10"
            onPress={handleSave}
            disabled={updateMutation.isPending || archiveMutation.isPending}
          >
            {updateMutation.isPending ? t('common.loading') : t('profile.personal.save')}
          </Button>
          <Button
            backgroundColor="$background"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$4"
            minHeight="$10"
            onPress={handleCreateTraining}
            disabled={updateMutation.isPending || archiveMutation.isPending}
          >
            <Text color="$text">{t('trainerClients.createTraining')}</Text>
          </Button>
          <Button
            backgroundColor="$background"
            borderWidth={1}
            borderColor="$danger"
            borderRadius="$4"
            minHeight="$10"
            onPress={handleArchive}
            disabled={updateMutation.isPending || archiveMutation.isPending}
          >
            <Text color="$danger">
              {archiveMutation.isPending ? t('common.loading') : t('trainerClients.archive')}
            </Text>
          </Button>
        </Sheet.Frame>
      </Sheet>
    </YStack>
  );
}
