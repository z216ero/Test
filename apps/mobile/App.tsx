import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import messaging from '@react-native-firebase/messaging';
import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { enableScreens } from 'react-native-screens';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PortalProvider } from '@tamagui/portal';
import { RootNavigator } from '@app/navigation/RootNavigator';
import { queryClient } from '@query/queryClient';
import { ToastProvider } from '@ui/feedback/ToastProvider';
import { handlePushMessage } from '@notifications/pushHandlers';
import {
  registerPushTokenIfPossible,
  registerPushTokenRefreshListener,
} from '@notifications/pushRegistration';
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
  useEffect(() => {
    const unsubscribeMessage = messaging().onMessage(handlePushMessage);
    const unsubscribeToken = registerPushTokenRefreshListener();
    registerPushTokenIfPossible();

    return () => {
      unsubscribeMessage();
      unsubscribeToken();
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
