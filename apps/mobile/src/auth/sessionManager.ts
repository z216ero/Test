import { clearSession } from '@auth/tokenStorage';
import { queryClient } from '@query/queryClient';
import { clearPushIndicators } from '@notifications/pushIndicators';
import { clearEvents as clearLegacyInAppEvents } from '@notifications/inAppLog';
import { clearEvents as clearNotificationEvents } from '@shared/notifications/eventStore';
import { clearClientSlotsFilters } from '@app/utils/clientSlotsFilters';
import { clearAllTrainingReminders } from '@notifications/localReminder';
import { clearTrainerIdCache } from '@api/trainerSlotsApi';

export const performLocalLogout = async (): Promise<void> => {
  clearTrainerIdCache();

  await Promise.allSettled([
    clearSession(),
    clearPushIndicators(),
    clearLegacyInAppEvents(),
    clearNotificationEvents(),
    clearClientSlotsFilters(),
    clearAllTrainingReminders(),
  ]);

  queryClient.clear();
};
