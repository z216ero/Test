// env.ts
const DEFAULT_API_URL = 'https://test-hn5h.onrender.com';

// React Native CLI: process.env.* доступен только если ты его подставляешь на этапе сборки.
// Поэтому делаем простой механизм через __DEV__.
export const API_BASE_URL =
  __DEV__ ? 'http://10.0.2.2:5253' : DEFAULT_API_URL;
