import type {
  AuthResponse,
  AuthUserDto,
  LoginRequest,
  RegisterRequest,
} from '@generated/api';
import {
  getAuthMe,
  postAuthLogin,
  postAuthLogout,
  postAuthRegister,
} from '@generated/api';
import { unwrap } from './core';
import {
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@auth/tokenStorage';

export const register = async (
  payload: RegisterRequest
): Promise<AuthResponse> => {
  const response = await postAuthRegister(payload);
  const data = unwrap<AuthResponse>(response, 'Unable to register. Please try again.');
  if (data.accessToken) {
    await setAccessToken(data.accessToken);
  }
  if (data.refreshToken) {
    await setRefreshToken(data.refreshToken);
  }
  return data;
};

export const login = async (payload: LoginRequest): Promise<AuthResponse> => {
  const response = await postAuthLogin(payload);
  const data = unwrap<AuthResponse>(response, 'Unable to login. Please try again.');
  if (data.accessToken) {
    await setAccessToken(data.accessToken);
  }
  if (data.refreshToken) {
    await setRefreshToken(data.refreshToken);
  }
  return data;
};

export const me = async (options?: RequestInit): Promise<AuthUserDto> => {
  const response = await getAuthMe(options);
  return unwrap(response, 'Unable to load profile.');
};

export const logout = async (): Promise<void> => {
  const refreshToken = await getRefreshToken();
  const response = await postAuthLogout({ refreshToken: refreshToken ?? null });
  unwrap(response, 'Unable to logout.');
};

