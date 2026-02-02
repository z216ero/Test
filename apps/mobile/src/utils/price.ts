const GROUP_RE = /\B(?=(\d{3})+(?!\d))/g;

const formatInteger = (value: number): string =>
  value.toString().replace(GROUP_RE, ' ');

export const formatPrice = (valueMinor?: number | null): string | null => {
  if (valueMinor === null || valueMinor === undefined) {
    return null;
  }

  const sign = valueMinor < 0 ? '-' : '';
  const absolute = Math.abs(valueMinor);
  const rubles = Math.floor(absolute / 100);
  const kopecks = absolute % 100;
  const rublesLabel = formatInteger(rubles);

  if (kopecks === 0) {
    return `${sign}${rublesLabel} ₽`;
  }

  return `${sign}${rublesLabel},${kopecks.toString().padStart(2, '0')} ₽`;
};
