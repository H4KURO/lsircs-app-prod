import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import jaTranslations from './locales/ja/common.json';
import enTranslations from './locales/en/common.json';

const fallbackLng = 'ja';
const supportedLngs = ['ja', 'en'];

const detectInitialLanguage = () => {
  if (typeof window === 'undefined') {
    return fallbackLng;
  }

  const stored = window.localStorage.getItem('appLanguage');
  if (stored && supportedLngs.includes(stored)) {
    return stored;
  }

  const navigatorLang = window.navigator?.language?.split('-')[0];
  if (navigatorLang && supportedLngs.includes(navigatorLang)) {
    return navigatorLang;
  }

  return fallbackLng;
};

const initialLanguage = detectInitialLanguage();

if (typeof window !== 'undefined' && !window.localStorage.getItem('appLanguage')) {
  window.localStorage.setItem('appLanguage', initialLanguage);
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ja: { translation: jaTranslations },
      en: { translation: enTranslations },
    },
    lng: initialLanguage,
    fallbackLng,
    supportedLngs,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
