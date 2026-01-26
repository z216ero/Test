import type { NavigatorScreenParams } from '@react-navigation/native';
import type { SlotDto } from '../../generated/api';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AppStackParamList = {
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

export type RootStackParamList = {
  Bootstrap: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  App: NavigatorScreenParams<AppStackParamList>;
};
