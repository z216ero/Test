import { Image } from 'react-native';
import { Text, YStack } from 'tamagui';
import { t } from '@i18n';
import { AppIcon } from '@ui/AppIcon';
import type { AppIconName } from '@ui/icons';

type AvatarSource = {
  uri: string;
  headers?: Record<string, string>;
};

type AvatarProps = {
  name?: string | null;
  fallbackText?: string;
  source?: AvatarSource | null;
  size?: number | string;
  borderRadius?: number | string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  textSize?: number | string;
  fallbackColor?: string;
  fallbackIcon?: AppIconName | null;
};

const imageFillStyle = { width: '100%', height: '100%' } as const;

const getInitials = (name?: string | null) => {
  const value = name?.trim();
  if (!value) {
    return t('common.initialsPlaceholder');
  }
  const parts = value.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return value.slice(0, 2).toUpperCase();
};

export function Avatar({
  name,
  fallbackText,
  source,
  size = '$10',
  borderRadius = '$6',
  backgroundColor = '$surfaceMuted',
  borderColor = '$border',
  borderWidth = 1,
  textSize = '$4',
  fallbackColor = '$muted',
  fallbackIcon = null,
}: AvatarProps) {
  return (
    <YStack
      width={size}
      height={size}
      borderRadius={borderRadius}
      backgroundColor={backgroundColor}
      borderWidth={borderWidth}
      borderColor={borderColor}
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
    >
      {source ? (
        <Image
          source={source}
          style={imageFillStyle}
          resizeMode="cover"
        />
      ) : fallbackIcon ? (
        <AppIcon name={fallbackIcon} size={20} color={fallbackColor} />
      ) : (
        <Text fontSize={textSize} color={fallbackColor}>
          {fallbackText ?? getInitials(name)}
        </Text>
      )}
    </YStack>
  );
}
