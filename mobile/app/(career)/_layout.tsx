import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { C } from '../../constants/theme';

export default function CareerLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: C.bgCard,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: C.green,
        tabBarInactiveTintColor: C.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: C.bgCard },
        headerTintColor: C.textPrimary,
        headerTitleStyle: { fontWeight: '800', fontSize: 18 },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ManagerFC',
          tabBarLabel: 'Hub',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>🏟</Text>,
        }}
      />
      <Tabs.Screen
        name="squad"
        options={{
          title: 'Elenco',
          tabBarLabel: 'Elenco',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>👥</Text>,
        }}
      />
      <Tabs.Screen
        name="league"
        options={{
          title: 'Liga',
          tabBarLabel: 'Liga',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>🏆</Text>,
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: 'Mercado',
          tabBarLabel: 'Mercado',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>💸</Text>,
        }}
      />
      <Tabs.Screen
        name="academy"
        options={{
          title: 'Base',
          tabBarLabel: 'Base',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>🏫</Text>,
        }}
      />
    </Tabs>
  );
}
