import { useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '@auth/tokenStorage';
import { buildAbsoluteUrl } from '@utils/url';

type AvatarSource = {
  uri: string;
  headers?: Record<string, string>;
};

type UseAuthorizedImageSourceOptions = {
  token?: string | null;
  requireAuth?: boolean;
};

export function useAuthorizedImageSource(
  avatarUrl?: string | null,
  { token, requireAuth = true }: UseAuthorizedImageSourceOptions = {}
): AvatarSource | null {
  const [resolvedToken, setResolvedToken] = useState<string | null>(token ?? null);

  useEffect(() => {
    if (token !== undefined) {
      setResolvedToken(token);
      return;
    }

    if (!requireAuth || !avatarUrl) {
      setResolvedToken(null);
      return;
    }

    let cancelled = false;
    getAccessToken().then((nextToken) => {
      if (!cancelled) {
        setResolvedToken(nextToken);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [avatarUrl, requireAuth, token]);

  const resolvedAvatarUrl = useMemo(() => {
    if (!avatarUrl) {
      return null;
    }
    return buildAbsoluteUrl(avatarUrl);
  }, [avatarUrl]);

  return useMemo(() => {
    if (!resolvedAvatarUrl) {
      return null;
    }

    if (!requireAuth) {
      return { uri: resolvedAvatarUrl };
    }

    if (!resolvedToken) {
      return null;
    }

    return {
      uri: resolvedAvatarUrl,
      headers: { Authorization: `Bearer ${resolvedToken}` },
    };
  }, [requireAuth, resolvedAvatarUrl, resolvedToken]);
}
