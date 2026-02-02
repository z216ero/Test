import type { UserRole } from '../navigation/types';

export const getUserRole = (role?: string | null): UserRole | null => {
  if (role === 'Client' || role === 'Trainer') {
    return role;
  }
  return null;
};
