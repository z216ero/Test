import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl } from 'react-native';
import { Button, Text, XStack, YStack } from 'tamagui';
import {
  type PaymentMethod,
  type TrainerPaymentsStatusFilter,
  getTrainerPaymentsList,
  markPaymentPaid,
} from '@api/paymentsApi';
import { presentApiError, shouldShowErrorToast } from '@api/ApiErrorPresenter';
import type { PaymentListItemDto } from '@generated/api';
import { t } from '@i18n';
import type { TrainerTabsParamList } from '@app/navigation/types';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@ui/feedback/useToast';
import { Banner } from '@ui/feedback/Banner';
import { TabScrollView } from '@ui/layout/TabScrollView';
import { EmptyState } from '@ui/states/EmptyState';
import { ErrorState } from '@ui/states/ErrorState';
import { LoadingState } from '@ui/states/LoadingState';
import { PaymentListItem } from '@app/components/payments/PaymentListItem';
import { PaymentMethodSheet } from '@app/components/payments/PaymentMethodSheet';

type Props = BottomTabScreenProps<TrainerTabsParamList, 'Payments'>;

type MarkPaidVariables = {
  paymentId: string;
  method: PaymentMethod;
};

const DEFAULT_LOOKBACK_DAYS = 30;

const getDefaultFromUtc = (): string => {
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - DEFAULT_LOOKBACK_DAYS);
  return from.toISOString();
};

export function PaymentsScreen(_: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [activeFilter, setActiveFilter] = useState<TrainerPaymentsStatusFilter>('Pending');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('Cash');
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const fromUtc = useMemo(() => getDefaultFromUtc(), []);
  const params = useMemo(
    () => ({ status: activeFilter, from: fromUtc }),
    [activeFilter, fromUtc]
  );

  const {
    data: payments = [],
    error,
    isLoading,
    isFetching,
    isStale,
    refetch,
  } = useAppQuery({
    queryKey: keys.payments.trainer(params),
    queryFn: ({ signal }) => getTrainerPaymentsList(params, { signal }),
  });

  const sortedPayments = useMemo(() => {
    const toTimestamp = (value?: string | null): number => {
      if (!value) {
        return 0;
      }
      const ts = new Date(value).getTime();
      return Number.isNaN(ts) ? 0 : ts;
    };

    return payments
      .slice()
      .sort((left, right) => {
        const leftTs = toTimestamp(left.slotStartAtUtc) || toTimestamp(left.paidAtUtc);
        const rightTs = toTimestamp(right.slotStartAtUtc) || toTimestamp(right.paidAtUtc);
        return rightTs - leftTs;
      });
  }, [payments]);

  useFocusEffect(
    useCallback(() => {
      if (!isLoading && isStale) {
        refetch();
      }
    }, [isLoading, isStale, refetch])
  );

  const handleRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const markPaidMutation = useAppMutation({
    mutationFn: ({ paymentId, method }: MarkPaidVariables) =>
      markPaymentPaid(paymentId, method),
    onSuccess: (updated) => {
      queryClient.setQueryData<PaymentListItemDto[]>(keys.payments.trainer(params), (current) => {
        if (!current) {
          return current;
        }

        return current
          .map((item) => (item.paymentId === updated.paymentId ? { ...item, ...updated } : item))
          .filter((item) => {
            if (activeFilter !== 'Pending') {
              return true;
            }
            return (item.status ?? '') === 'Pending';
          });
      });

      setSheetOpen(false);
      setActivePaymentId(null);
    },
    onError: (err) => {
      const presented = presentApiError(err);

      if (presented.kind === 'conflict') {
        showToast({
          type: 'error',
          title: t('payments.toast.errorTitle'),
          message: t('payments.toast.conflict'),
        });
        return;
      }

      if (presented.kind === 'notFound') {
        showToast({
          type: 'error',
          title: t('payments.toast.errorTitle'),
          message: t('payments.toast.notFound'),
        });
        refetch();
        return;
      }

      if (presented.kind === 'network' || presented.kind === 'timeout') {
        showToast({
          type: 'error',
          title: presented.title,
          message: t('payments.toast.network'),
        });
        return;
      }

      if (shouldShowErrorToast(presented)) {
        showToast({
          type: 'error',
          title: presented.title,
          message: presented.message,
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keys.payments.all() });
    },
  });

  const presentedError = error ? presentApiError(error) : null;
  const isNetworkError = presentedError
    && (presentedError.kind === 'network' || presentedError.kind === 'timeout');

  const openMethodSheet = (paymentId: string) => {
    setActivePaymentId(paymentId);
    setSelectedMethod('Cash');
    setSheetOpen(true);
  };

  const confirmMarkPaid = () => {
    if (!activePaymentId || markPaidMutation.isPending) {
      return;
    }

    markPaidMutation.mutate({
      paymentId: activePaymentId,
      method: selectedMethod,
    });
  };

  const renderContent = () => {
    if (isLoading && sortedPayments.length === 0) {
      return <LoadingState />;
    }

    if (error && sortedPayments.length === 0) {
      return <ErrorState error={error} onRetry={handleRefresh} />;
    }

    if (sortedPayments.length === 0) {
      const title = activeFilter === 'Pending'
        ? t('payments.empty.pending')
        : activeFilter === 'Paid'
          ? t('payments.empty.paid')
          : t('payments.empty.all');
      return <EmptyState title={title} />;
    }

    return (
      <YStack gap="$3">
        {sortedPayments.map((item) => {
          const paymentId = item.paymentId ?? '';
          const isUpdating = !!paymentId
            && markPaidMutation.isPending
            && markPaidMutation.variables?.paymentId === paymentId;
          return (
            <PaymentListItem
              key={paymentId || `${item.bookingId ?? 'payment'}-${item.slotStartAtUtc ?? ''}`}
              item={item}
              isUpdating={isUpdating}
              onMarkPaid={paymentId ? () => openMethodSheet(paymentId) : undefined}
            />
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
            refreshing={isManualRefreshing && isFetching}
            onRefresh={handleRefresh}
          />
        }
      >
        <YStack gap="$4" padding="$6">
          <Text fontSize="$8" fontWeight="700" color="$text">
            {t('payments.title')}
          </Text>

          <XStack
            padding="$1"
            backgroundColor="$surfaceMuted"
            borderRadius="$4"
            borderWidth={1}
            borderColor="$border"
            gap="$1"
          >
            {([
              { id: 'All', label: t('payments.filter.all') },
              { id: 'Pending', label: t('payments.filter.pending') },
              { id: 'Paid', label: t('payments.filter.paid') },
            ] as const).map((filter) => {
              const isActive = activeFilter === filter.id;
              return (
                <Button
                  key={filter.id}
                  unstyled
                  flex={1}
                  paddingVertical="$2"
                  borderRadius="$3"
                  backgroundColor={isActive ? '$background' : 'transparent'}
                  onPress={() => setActiveFilter(filter.id)}
                >
                  <Text
                    fontSize="$3"
                    fontWeight={isActive ? '700' : '600'}
                    color={isActive ? '$text' : '$muted'}
                    textAlign="center"
                  >
                    {filter.label}
                  </Text>
                </Button>
              );
            })}
          </XStack>

          {isNetworkError && presentedError ? (
            <Banner
              type="error"
              title={presentedError.title}
              message={presentedError.message}
              actionLabel={t('common.retry')}
              onAction={handleRefresh}
            />
          ) : null}

          {renderContent()}
        </YStack>
      </TabScrollView>

      <PaymentMethodSheet
        open={sheetOpen}
        selectedMethod={selectedMethod}
        isSubmitting={markPaidMutation.isPending}
        onOpenChange={(open) => {
          if (!open && markPaidMutation.isPending) {
            return;
          }
          setSheetOpen(open);
          if (!open) {
            setActivePaymentId(null);
          }
        }}
        onSelectMethod={setSelectedMethod}
        onConfirm={confirmMarkPaid}
      />
    </YStack>
  );
}
