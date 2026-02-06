import type { LookupItem } from '@api/lookupsApi';

export const getDefaultLookupCode = (items: LookupItem[]): string => (
  items.find((item) => item.isDefault)?.code ?? items[0]?.code ?? ''
);

export const getAnyLookupCode = (items: LookupItem[]): string => (
  items.find((item) => item.isAny)?.code ?? ''
);

export const buildLookupMap = (items: LookupItem[]): Map<string, string> => (
  new Map(items.map((item) => [item.code, item.label]))
);

export const formatLookupList = (
  codes: string[] | null | undefined,
  labels: Map<string, string>
): string => {
  if (!codes || codes.length === 0) {
    return '';
  }
  return codes
    .map((code) => labels.get(code) ?? code)
    .filter((value) => value.trim().length > 0)
    .join(', ');
};
