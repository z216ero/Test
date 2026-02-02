import {
  useMutation,
  useQuery,
  type QueryKey,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

export const useAppQuery = <
  TQueryFnData,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>
): UseQueryResult<TData, TError> => {
  const result = useQuery(options);
  const lastErrorRef = useRef<TError | null>(null);

  useEffect(() => {
    if (__DEV__ && result.error && result.error !== lastErrorRef.current) {
      console.warn('Query error', options.queryKey, result.error);
      lastErrorRef.current = result.error;
    }
  }, [options.queryKey, result.error]);

  return result;
};

export const useAppMutation = <
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown,
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>
): UseMutationResult<TData, TError, TVariables, TContext> => {
  const result = useMutation(options);
  const lastErrorRef = useRef<TError | null>(null);

  useEffect(() => {
    if (__DEV__ && result.error && result.error !== lastErrorRef.current) {
      console.warn('Mutation error', result.error);
      lastErrorRef.current = result.error;
    }
  }, [result.error]);

  return result;
};
