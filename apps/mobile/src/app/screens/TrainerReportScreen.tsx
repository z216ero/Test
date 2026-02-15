import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { RefreshControl } from 'react-native';
import { Button, Text, XStack, YStack } from 'tamagui';
import { getTrainerSummaryReport } from '@api/reportsApi';
import { t } from '@i18n';
import { useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { AppIcon } from '@ui/AppIcon';
import { TabScrollView } from '@ui/layout/TabScrollView';
import { ErrorState } from '@ui/states/ErrorState';
import { LoadingState } from '@ui/states/LoadingState';
import type { ProfileStackParamList } from '@app/navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'TrainerReport'>;

type ReportPeriod = 'today' | 'week' | 'month';

const startOfLocalDay = (value: Date): Date =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);

const buildRange = (period: ReportPeriod): { fromUtc: string; toUtc: string } => {
  const now = new Date();
  const end = new Date();
  const start = startOfLocalDay(now);

  if (period === 'week') {
    start.setDate(start.getDate() - 6);
  } else if (period === 'month') {
    start.setDate(1);
  }

  return {
    fromUtc: start.toISOString(),
    toUtc: end.toISOString(),
  };
};

const formatMoney = (amount?: number): string =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(amount ?? 0);

export function TrainerReportScreen({ navigation }: Props) {
  const [period, setPeriod] = useState<ReportPeriod>('today');
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const range = useMemo(() => buildRange(period), [period]);

  const summaryQuery = useAppQuery({
    queryKey: keys.reports.summary(range),
    queryFn: ({ signal }) => getTrainerSummaryReport(range, { signal }),
  });

  const handleRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await summaryQuery.refetch();
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const summary = summaryQuery.data;

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <TabScrollView
        refreshControl={
          <RefreshControl
            refreshing={isManualRefreshing && summaryQuery.isFetching}
            onRefresh={handleRefresh}
          />
        }
      >
        <YStack gap="$4" padding="$6">
          <XStack alignItems="center" gap="$2">
            <Button unstyled onPress={() => navigation.goBack()}>
              <AppIcon name="chevronLeft" size={18} color="$muted" />
            </Button>
            <Text fontSize="$8" fontWeight="700" color="$text">
              {t('reports.title')}
            </Text>
          </XStack>

          <XStack
            padding="$1"
            backgroundColor="$surfaceMuted"
            borderRadius="$4"
            borderWidth={1}
            borderColor="$border"
            gap="$1"
          >
            {([
              { id: 'today' as const, label: t('reports.period.today') },
              { id: 'week' as const, label: t('reports.period.week') },
              { id: 'month' as const, label: t('reports.period.month') },
            ]).map((item) => {
              const isActive = period === item.id;
              return (
                <Button
                  key={item.id}
                  unstyled
                  flex={1}
                  paddingVertical="$2"
                  borderRadius="$3"
                  backgroundColor={isActive ? '$background' : 'transparent'}
                  onPress={() => setPeriod(item.id)}
                >
                  <Text
                    fontSize="$3"
                    fontWeight={isActive ? '700' : '600'}
                    color={isActive ? '$text' : '$muted'}
                    textAlign="center"
                  >
                    {item.label}
                  </Text>
                </Button>
              );
            })}
          </XStack>

          {summaryQuery.isLoading ? <LoadingState /> : null}
          {summaryQuery.error ? <ErrorState error={summaryQuery.error} onRetry={handleRefresh} /> : null}

          {summary && !summaryQuery.error ? (
            <YStack gap="$3">
              <MetricCard label={t('reports.completed')} value={`${summary.sessionsCompleted ?? 0}`} />
              <MetricCard label={t('reports.noShow')} value={`${summary.sessionsNoShow ?? 0}`} />
              <MetricCard label={t('reports.cancelled')} value={`${summary.sessionsCancelled ?? 0}`} />
              <MetricCard label={t('reports.revenuePaid')} value={formatMoney(summary.revenuePaid)} />
              <MetricCard label={t('reports.revenuePending')} value={formatMoney(summary.revenuePending)} />
            </YStack>
          ) : null}
        </YStack>
      </TabScrollView>
    </YStack>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
};

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <YStack
      gap="$1"
      padding="$4"
      backgroundColor="$background"
      borderRadius="$5"
      borderWidth={1}
      borderColor="$border"
    >
      <Text fontSize="$3" color="$muted">
        {label}
      </Text>
      <Text fontSize="$6" fontWeight="700" color="$text">
        {value}
      </Text>
    </YStack>
  );
}
