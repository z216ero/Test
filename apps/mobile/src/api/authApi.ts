import type {
  AuthResponse,
  AuthUserDto,
  LoginRequest,
  RegisterRequest,
} from '../generated/api';
import {
  getAuthMe,
  postAuthLogin,
  postAuthLogout,
  postAuthRegister,
} from '../generated/api';
import { unwrap } from './core';

export const register = async (
  payload: RegisterRequest
): Promise<AuthResponse> => {
  const response = await postAuthRegister(payload);
  return unwrap(response, 'Unable to register. Please try again.');
};

export const login = async (payload: LoginRequest): Promise<AuthResponse> => {
  const response = await postAuthLogin(payload);
  return unwrap(response, 'Unable to login. Please try again.');
};

export const me = async (): Promise<AuthUserDto> => {
  const response = await getAuthMe();
  return unwrap(response, 'Unable to load profile.');
};

export const logout = async (): Promise<void> => {
  const response = await postAuthLogout();
  unwrap(response, 'Unable to logout.');
};
