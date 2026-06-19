import { Stack } from 'expo-router';
import { C } from '../constants/theme';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: C.bgCard },
        headerTintColor: C.textPrimary,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: C.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="select-team" options={{ title: 'Escolha seu time', headerBackTitle: '' }} />
      <Stack.Screen name="(career)" options={{ headerShown: false }} />
      <Stack.Screen name="match" options={{ title: 'Partida', headerBackTitle: '' }} />
    </Stack>
  );
}
