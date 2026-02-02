# Mobile API usage

This document describes the standard way to call the API in the React Native app.
Use it for new screens and when refactoring existing ones.

## Rules
- Use `useAppQuery` and `useAppMutation` from `apps/mobile/src/query/hooks.ts`.
- Do not call `fetch` directly in UI code.
- All requests must go through the generated client (`apps/mobile/src/generated/api.ts`),
  which is already wired to the timeout-enabled fetcher.
- Show UI states via the shared components:
  - `LoadingState`
  - `EmptyState`
  - `ErrorState`
- For user feedback, use `useToast` and (optionally) `Banner`.

## Query example (read)
```tsx
const { data, isLoading, error, refetch } = useAppQuery({
  queryKey: keys.trainers.slots(trainerId),
  queryFn: async ({ signal }) => {
    const response = await apiClient.getTrainersTrainerIdSlots(
      trainerId,
      undefined,
      { signal }
    );
    return unwrap<SlotDto[]>(response, 'Unable to load slots.');
  },
});

if (isLoading) return <LoadingState />;
if (error) return <ErrorState error={error} onRetry={refetch} />;
if (!data?.length) return <EmptyState title={t('slots.empty')} />;
```

## Mutation example (write)
```tsx
const queryClient = useQueryClient();
const { showToast } = useToast();

const mutation = useAppMutation({
  mutationFn: (slotId: string) => createBooking(slotId),
  onSuccess: async (_data, slotId) => {
    queryClient.invalidateQueries({ queryKey: keys.bookings.upcoming() });
    showToast({ type: 'success', title: t('notifications.event.booked') });
  },
  onError: (err) => {
    const presented = presentApiError(err);
    showToast({ type: 'error', title: presented.title, message: presented.message });
  },
});
```

## Error handling
- Use `presentApiError(err)` for human-readable messages.
- Do not swallow errors silently.

## Timeouts and retries
- Requests use the shared fetcher with a 15s timeout.
- Retries are handled by React Query (max 2) per `queryClient` defaults.
