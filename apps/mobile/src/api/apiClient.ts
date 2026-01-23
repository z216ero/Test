import Axios, { AxiosError, AxiosRequestConfig } from 'axios';

const baseURL = (globalThis as { process?: { env?: Record<string, string | undefined> } })
  .process?.env?.API_BASE_URL ?? '';

export const AXIOS_INSTANCE = Axios.create({ baseURL });

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  return AXIOS_INSTANCE({ ...config }).then(({ data }) => data);
};

export type ErrorType<Error> = AxiosError<Error>;
export type BodyType<BodyData> = BodyData;
