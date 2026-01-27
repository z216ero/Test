import { en } from './en';
import { ru } from './ru';
import type { TranslationKey } from './types';

type Locale = 'ru' | 'en';

const dictionaries: Record<Locale, Record<string, string>> = {
  ru,
  en,
};

let currentLocale: Locale = 'ru';

export const getLocale = () => currentLocale;

export const setLocale = (locale: Locale) => {
  currentLocale = locale;
};

const format = (template: string, params?: Record<string, string | number>) => {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key];
    if (value === undefined || value === null) {
      return match;
    }
    return String(value);
  });
};

export const t = (
  key: TranslationKey,
  params?: Record<string, string | number>
) => {
  const dictionary = dictionaries[currentLocale];
  const value = dictionary[key];
  if (!value) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(`Missing translation: ${key}`);
    }
    return key;
  }
  return format(value, params);
};

export type { TranslationKey };
