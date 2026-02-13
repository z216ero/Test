import { DarkTheme, DefaultTheme, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { getApp } from '@react-native-firebase/app';
import {
  getInitialNotification,
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
} from '@react-native-firebase/messaging';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, StatusBar } from 'react-native';
import { enableScreens } from 'react-native-screens';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PortalProvider } from '@tamagui/portal';
import { RootNavigator } from '@app/navigation/RootNavigator';
import type { RootStackParamList } from '@app/navigation/types';
import { AppThemeProvider, useAppTheme } from '@app/theme/AppThemeContext';
import { queryClient } from '@query/queryClient';
import { keys } from '@query/keys';
import { ToastProvider } from '@ui/feedback/ToastProvider';
import { handleRemoteMessage } from '@shared/push/handleRemoteMessage';
import {
  registerPushTokenIfPossible,
  registerPushTokenRefreshListener,
} from '@notifications/pushRegistration';
import { hydratePushIndicators } from '@notifications/pushIndicators';
import { getAccessToken } from '@auth/tokenStorage';
import { performLocalLogout } from '@auth/sessionManager';
import { me } from '@api/authApi';
import { ApiError } from '@api/core';
import { ApiHttpError } from '@api/fetcher';
import config from './tamagui.config.cjs';
import { TamaguiProvider, Theme } from '@tamagui/core';

enableScreens();

const tokens = config.tokens;
type TokenValue<T> = { val: T } | T;
const isTokenValue = <T,>(value: TokenValue<T>): value is { val: T } =>
  typeof value === 'object' && value !== null && 'val' in value;
const getTokenValue = <T,>(token: TokenValue<T> | undefined): T | undefined =>
  token && isTokenValue(token) ? token.val : token;

const baseInsetPadding = (getTokenValue(tokens.space[2]) as number) ?? 8;
const safeAreaBackground = (getTokenValue(tokens.color.background) as string) ?? '#ffffff';
const safeAreaBackgroundDark = '#0B1220';
const navigationRef = createNavigationContainerRef<RootStackParamList>();

function AppContent() {
  const { isDark, themeName } = useAppTheme();
  const resumeInvalidateRef = useRef(0);
  const navigationTheme = isDark ? DarkTheme : DefaultTheme;

  const redirectToAuth = useCallback(() => {
    if (!navigationRef.isReady()) {
      return;
    }
    navigationRef.resetRoot({ index: 0, routes: [{ name: 'Auth' }] });
  }, []);

  const ensureSessionIsValid = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      return;
    }

    try {
      await me();
    } catch (error) {
      if (
        (error instanceof ApiError || error instanceof ApiHttpError)
        && (error.status === 401 || error.status === 404)
      ) {
        await performLocalLogout();
        redirectToAuth();
      }
    }
  }, [redirectToAuth]);

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
      ensureSessionIsValid().catch(() => {});
    });

    ensureSessionIsValid().catch(() => {});

    return () => {
      unsubscribeMessage();
      unsubscribeOpened();
      unsubscribeToken();
      resumeSubscription.remove();
    };
  }, [ensureSessionIsValid]);

  return (
    <SafeAreaProvider>
      <TamaguiProvider config={config} defaultTheme="light">
        <Theme name={themeName}>
          <SafeAreaView
            style={{
              flex: 1,
              backgroundColor: isDark ? safeAreaBackgroundDark : safeAreaBackground,
              paddingTop: baseInsetPadding,
              paddingBottom: baseInsetPadding,
            }}
            edges={{ top: 'additive', bottom: 'additive' }}
          >
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
            <PortalProvider shouldAddRootHost>
              <QueryClientProvider client={queryClient}>
                <ToastProvider>
                  <NavigationContainer ref={navigationRef} theme={navigationTheme}>
                    <RootNavigator />
                  </NavigationContainer>
                </ToastProvider>
              </QueryClientProvider>
            </PortalProvider>
          </SafeAreaView>
        </Theme>
      </TamaguiProvider>
    </SafeAreaProvider>
  );
}

function App() {
  return (
    <AppThemeProvider>
      <AppContent />
    </AppThemeProvider>
  );
}

export default App;
