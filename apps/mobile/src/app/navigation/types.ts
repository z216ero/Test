import type { SlotDto } from '../../generated/api';

export type RootStackParamList = {
  Home: undefined;
  Trainers: { mode: 'client' | 'trainer'; clientId?: string };
  AvailableSlots: { trainerId: string; trainerName: string; clientId: string };
  SlotDetails: {
    trainerId: string;
    trainerName: string;
    slot: SlotDto;
    clientId: string;
  };
  TrainerSlots: { trainerId: string; trainerName: string };
  CreateSlot: { trainerId: string; trainerName: string };
};
