import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { getApp } from '@react-native-firebase/app';
import {
  getInitialNotification,
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
} from '@react-native-firebase/messaging';
import { useEffect, useRef } from 'react';
import { AppState, StatusBar } from 'react-native';
import { enableScreens } from 'react-native-screens';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PortalProvider } from '@tamagui/portal';
import { RootNavigator } from '@app/navigation/RootNavigator';
import { queryClient } from '@query/queryClient';
import { keys } from '@query/keys';
import { ToastProvider } from '@ui/feedback/ToastProvider';
import { handleRemoteMessage } from '@shared/push/handleRemoteMessage';
import {
  registerPushTokenIfPossible,
  registerPushTokenRefreshListener,
} from '@notifications/pushRegistration';
import { hydratePushIndicators } from '@notifications/pushIndicators';
import config from './tamagui.config.cjs';
import { TamaguiProvider } from '@tamagui/core';

enableScreens();

const tokens = config.tokens;
type TokenValue<T> = { val: T } | T;
const isTokenValue = <T,>(value: TokenValue<T>): value is { val: T } =>
  typeof value === 'object' && value !== null && 'val' in value;
const getTokenValue = <T,>(token: TokenValue<T> | undefined): T | undefined =>
  token && isTokenValue(token) ? token.val : token;

const baseInsetPadding = (getTokenValue(tokens.space[2]) as number) ?? 8;
const safeAreaBackground = (getTokenValue(tokens.color.background) as string) ?? '#ffffff';

function App() {
  const resumeInvalidateRef = useRef(0);

  useEffect(() => {
    const messaging = getMessaging(getApp());
    const unsubscribeMessage = onMessage(messaging, (message) =>
      handleRemoteMessage(message, { source: 'foreground' })
    );
    const unsubscribeOpened = onNotificationOpenedApp(messaging, (message) => {
      if (message) {
        handleRemoteMessage(message, { source: 'opened' });
      }
    });
    const unsubscribeToken = registerPushTokenRefreshListener();
    registerPushTokenIfPossible();
    hydratePushIndicators().catch(() => {});

    getInitialNotification(messaging)
      .then((message) => {
        if (message) {
          handleRemoteMessage(message, { source: 'initial' });
        }
      })
      .catch(() => {});

    const resumeSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        return;
      }
      const now = Date.now();
      if (now - resumeInvalidateRef.current < 1000) {
        return;
      }
      resumeInvalidateRef.current = now;
      queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
      queryClient.invalidateQueries({ queryKey: keys.bookings.upcoming() });
      queryClient.invalidateQueries({ queryKey: keys.bookings.history() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Client') });
    });

    return () => {
      unsubscribeMessage();
      unsubscribeOpened();
      unsubscribeToken();
      resumeSubscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <TamaguiProvider config={config} defaultTheme="light">
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: safeAreaBackground,
            paddingTop: baseInsetPadding,
            paddingBottom: baseInsetPadding,
          }}
          edges={{ top: 'additive', bottom: 'additive' }}
        >
          <StatusBar barStyle="dark-content" />
          <PortalProvider shouldAddRootHost>
            <QueryClientProvider client={queryClient}>
              <ToastProvider>
                <NavigationContainer>
                  <RootNavigator />
                </NavigationContainer>
              </ToastProvider>
            </QueryClientProvider>
          </PortalProvider>
        </SafeAreaView>
      </TamaguiProvider>
    </SafeAreaProvider>
  );
}

export default App;
