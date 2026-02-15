import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Button, Text, XStack, YStack } from 'tamagui';
import {
  createTrainerClient,
  getTrainerClientsList,
  updateTrainerClient,
} from '@api/trainerClientsApi';
import { presentApiError, shouldShowErrorToast } from '@api/ApiErrorPresenter';
import { t } from '@i18n';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { useQueryClient } from '@tanstack/react-query';
import { FormInput, PhoneInput } from '@ui/components';
import { useToast } from '@ui/feedback/useToast';
import { AppIcon } from '@ui/AppIcon';
import { TabScrollView } from '@ui/layout/TabScrollView';
import { LoadingState } from '@ui/states/LoadingState';
import type { ProfileStackParamList } from '@app/navigation/types';
import { normalizeRussianPhoneInput } from '@utils/phone';

type Props = NativeStackScreenProps<ProfileStackParamList, 'TrainerClientForm'>;

const DISPLAY_NAME_MAX = 100;
const PHONE_MAX = 30;
const NOTES_MAX = 500;

const trimToUndefined = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export function TrainerClientFormScreen({ navigation, route }: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const clientId = route.params?.clientId;
  const isEdit = Boolean(clientId);

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const clientQuery = useAppQuery({
    queryKey: clientId
      ? (['trainer', 'clients', 'item', clientId] as const)
      : (['trainer', 'clients', 'item', 'new'] as const),
    enabled: isEdit,
    queryFn: async ({ signal }) => {
      const clients = await getTrainerClientsList(undefined, { signal });
      return clients.find((item) => item.id === clientId) ?? null;
    },
  });

  useEffect(() => {
    if (!clientQuery.data) {
      return;
    }
    setDisplayName(clientQuery.data.displayName ?? '');
    setPhone(clientQuery.data.phone?.trim() ? normalizeRussianPhoneInput(clientQuery.data.phone) : '');
    setNotes(clientQuery.data.notes ?? '');
  }, [clientQuery.data]);

  const nameLength = displayName.trim().length;
  const phoneLength = phone.trim().length;
  const notesLength = notes.trim().length;

  const canSubmit = useMemo(() => {
    return (
      nameLength > 0 &&
      nameLength <= DISPLAY_NAME_MAX &&
      phoneLength <= PHONE_MAX &&
      notesLength <= NOTES_MAX
    );
  }, [nameLength, notesLength, phoneLength]);

  const createMutation = useAppMutation({
    mutationFn: () =>
      createTrainerClient({
        displayName: trimToUndefined(displayName),
        phone: trimToUndefined(phone),
        notes: trimToUndefined(notes),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trainerClients.list() });
      navigation.goBack();
    },
    onError: (err) => {
      const presented = presentApiError(err);
      const message = presented.kind === 'conflict'
        ? t('trainerClients.errorPhoneInUse')
        : presented.message;
      setFormError(message);
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
    mutationFn: () =>
      updateTrainerClient(clientId!, {
        displayName: trimToUndefined(displayName),
        phone: trimToUndefined(phone),
        notes: trimToUndefined(notes),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trainerClients.list() });
      navigation.goBack();
    },
    onError: (err) => {
      const presented = presentApiError(err);
      const message = presented.kind === 'conflict'
        ? t('trainerClients.errorPhoneInUse')
        : presented.message;
      setFormError(message);
      if (shouldShowErrorToast(presented)) {
        showToast({
          type: 'error',
          title: presented.title,
          message,
        });
      }
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    setFormError(null);
    if (!canSubmit || isSaving) {
      return;
    }
    if (isEdit) {
      updateMutation.mutate();
      return;
    }
    createMutation.mutate();
  };

  if (isEdit && clientQuery.isLoading) {
    return <LoadingState />;
  }

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <TabScrollView>
        <YStack gap="$4" padding="$6">
          <XStack alignItems="center" gap="$2">
            <Button unstyled onPress={() => navigation.goBack()}>
              <AppIcon name="chevronLeft" size={18} color="$muted" />
            </Button>
            <Text fontSize="$8" fontWeight="700" color="$text">
              {isEdit ? t('trainerClients.edit') : t('trainerClients.add')}
            </Text>
          </XStack>

          <YStack gap="$2">
            <Text fontSize="$3" color="$text">
              {t('trainerClients.form.name')}
            </Text>
            <FormInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t('trainerClients.form.namePlaceholder')}
              maxLength={DISPLAY_NAME_MAX}
            />
          </YStack>

          <YStack gap="$2">
            <Text fontSize="$3" color="$text">
              {t('trainerClients.form.phone')}
            </Text>
            <PhoneInput
              value={phone}
              onChangeText={setPhone}
              placeholder={t('trainerClients.form.phonePlaceholder')}
              maxLength={PHONE_MAX}
            />
          </YStack>

          <YStack gap="$2">
            <Text fontSize="$3" color="$text">
              {t('trainerClients.form.notes')}
            </Text>
            <FormInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t('trainerClients.form.notesPlaceholder')}
              maxLength={NOTES_MAX}
            />
          </YStack>

          {!canSubmit ? (
            <Text fontSize="$3" color="$muted">
              {t('trainerClients.form.validation')}
            </Text>
          ) : null}

          {formError ? (
            <Text fontSize="$3" color="$danger">
              {formError}
            </Text>
          ) : null}

          <Button
            backgroundColor="$accent"
            color="$accentText"
            borderRadius="$4"
            minHeight="$10"
            onPress={handleSubmit}
            disabled={!canSubmit || isSaving}
          >
            {isSaving ? t('common.loading') : t('profile.personal.save')}
          </Button>
        </YStack>
      </TabScrollView>
    </YStack>
  );
}
