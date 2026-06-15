import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#16213e', borderTopColor: '#0f3460' },
        tabBarActiveTintColor: '#e2b96f',
        tabBarInactiveTintColor: '#64748b',
        headerStyle: { backgroundColor: '#1a1a2e' },
        headerTintColor: '#f1f5f9',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarLabel: 'Home' }} />
      <Tabs.Screen name="squad" options={{ title: 'Squad', tabBarLabel: 'Squad' }} />
      <Tabs.Screen name="match" options={{ title: 'Match Day', tabBarLabel: 'Match' }} />
      <Tabs.Screen name="league" options={{ title: 'League', tabBarLabel: 'League' }} />
    </Tabs>
  );
}
