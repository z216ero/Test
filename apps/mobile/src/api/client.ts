import * as api from '../generated/api';

export const createApiClient = () => api;

export const apiClient = createApiClient();

export type ApiClient = ReturnType<typeof createApiClient>;
