import { getApp } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import { handleRemoteMessage } from '@shared/push/handleRemoteMessage';

const messaging = getMessaging(getApp());

setBackgroundMessageHandler(messaging, async (remoteMessage) => {
  await handleRemoteMessage(remoteMessage, { source: 'background' });
});
