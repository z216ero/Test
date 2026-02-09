import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

export type AppThemeName = 'light' | 'dark';

type AppThemeContextValue = {
  themeName: AppThemeName;
  isDark: boolean;
  setThemeName: (next: AppThemeName) => void;
  toggleTheme: () => void;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);
const APP_THEME_STORAGE_KEY = 'app_theme_name';

const isAppThemeName = (value: string | null): value is AppThemeName =>
  value === 'light' || value === 'dark';

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemColorScheme = useColorScheme();
  const [themeName, setThemeNameState] = useState<AppThemeName>(
    systemColorScheme === 'dark' ? 'dark' : 'light'
  );

  const setThemeName = useCallback((next: AppThemeName) => {
    setThemeNameState(next);
    AsyncStorage.setItem(APP_THEME_STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeNameState((current) => {
      const next = current === 'light' ? 'dark' : 'light';
      AsyncStorage.setItem(APP_THEME_STORAGE_KEY, next).catch(() => undefined);
      return next;
    });
  }, []);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(APP_THEME_STORAGE_KEY)
      .then((storedTheme) => {
        if (!active || !isAppThemeName(storedTheme)) {
          return;
        }
        setThemeNameState(storedTheme);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      themeName,
      isDark: themeName === 'dark',
      setThemeName,
      toggleTheme,
    }),
    [setThemeName, themeName, toggleTheme]
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export const useAppTheme = () => {
  const value = useContext(AppThemeContext);
  if (!value) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }
  return value;
};
