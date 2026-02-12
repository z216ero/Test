const RUS_PREFIX = '+7';
const LOCAL_DIGITS_MAX = 10;

const onlyDigits = (value: string) => value.replace(/\D/g, '');

const toLocalDigits = (value: string): string => {
  const digits = onlyDigits(value);
  if (digits.length === 0) {
    return '';
  }

  if (digits.startsWith('7') || digits.startsWith('8')) {
    return digits.slice(1, 1 + LOCAL_DIGITS_MAX);
  }

  return digits.slice(0, LOCAL_DIGITS_MAX);
};

const formatWithPrefix = (localDigits: string): string => {
  if (!localDigits) {
    return RUS_PREFIX;
  }

  const p1 = localDigits.slice(0, 3);
  const p2 = localDigits.slice(3, 6);
  const p3 = localDigits.slice(6, 8);
  const p4 = localDigits.slice(8, 10);

  let value = `${RUS_PREFIX} ${p1}`;
  if (p2) {
    value += ` ${p2}`;
  }
  if (p3) {
    value += `-${p3}`;
  }
  if (p4) {
    value += `-${p4}`;
  }

  return value;
};

export const normalizeRussianPhoneInput = (value: string): string => {
  const localDigits = toLocalDigits(value);
  return formatWithPrefix(localDigits);
};

export const russianPhoneToE164 = (value: string): string | null => {
  const localDigits = toLocalDigits(value);
  if (localDigits.length !== LOCAL_DIGITS_MAX) {
    return null;
  }

  return `${RUS_PREFIX}${localDigits}`;
};
