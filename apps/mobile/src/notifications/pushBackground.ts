import messaging from '@react-native-firebase/messaging';
import { handlePushMessage } from './pushHandlers';

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  await handlePushMessage(remoteMessage);
});
