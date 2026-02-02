import type { ReactNode } from 'react';
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';

export type ToastType = 'success' | 'error' | 'info';

export type ToastPayload = {
  type: ToastType;
  title: string;
  message?: string;
};

type ToastContextValue = {
  showToast: (payload: ToastPayload) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

const toastBorderColor: Record<ToastType, string> = {
  success: '$accent',
  error: '$primary',
  info: '$border',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  const showToast = useCallback((payload: ToastPayload) => {
    setToast(payload);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(hideToast, 3500);
  }, [hideToast]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      <YStack flex={1}>
        {children}
        {toast ? (
          <XStack
            position="absolute"
            top="$6"
            left="$4"
            right="$4"
            zIndex={100}
            padding="$4"
            gap="$3"
            backgroundColor="$background"
            borderRadius="$4"
            borderWidth={1}
            borderColor={toastBorderColor[toast.type]}
            elevation={2}
            shadowColor="$border"
            shadowOpacity={0.1}
            shadowRadius={6}
          >
            <YStack flex={1} gap="$1">
              <Text fontSize="$4" fontWeight="700" color="$text">
                {toast.title}
              </Text>
              {toast.message ? (
                <Text fontSize="$3" color="$muted">
                  {toast.message}
                </Text>
              ) : null}
            </YStack>
          </XStack>
        ) : null}
      </YStack>
    </ToastContext.Provider>
  );
}
