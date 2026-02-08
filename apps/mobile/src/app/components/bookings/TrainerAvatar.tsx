import { Avatar, useAuthorizedImageSource } from '@ui/components';

type TrainerAvatarProps = {
  name?: string | null;
  avatarUrl?: string | null;
  size?: number | string;
};

export function TrainerAvatar({ name, avatarUrl, size = '$9' }: TrainerAvatarProps) {
  const avatarSource = useAuthorizedImageSource(avatarUrl);

  return (
    <Avatar
      name={name}
      source={avatarSource}
      size={size}
      borderRadius="$6"
      textSize="$4"
    />
  );
}


