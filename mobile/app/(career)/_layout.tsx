import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { useLayout } from '../../hooks/useLayout';
import { C } from '../../constants/theme';

const TABS = [
  { name: 'index', path: '/(career)', label: 'Hub', icon: '🏟' },
  { name: 'squad', path: '/(career)/squad', label: 'Elenco', icon: '👥' },
  { name: 'league', path: '/(career)/league', label: 'Liga', icon: '🏆' },
  { name: 'market', path: '/(career)/market', label: 'Mercado', icon: '💸' },
  { name: 'academy', path: '/(career)/academy', label: 'Base', icon: '🏫' },
];

export default function CareerLayout() {
  const { isWide } = useLayout();

  if (isWide && Platform.OS === 'web') {
    return <WideLayout />;
  }

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

// Wide / web layout: sidebar on left + content area on right
function WideLayout() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={wide.root}>
      {/* Sidebar */}
      <View style={wide.sidebar}>
        <View style={wide.brand}>
          <View style={wide.brandBadge}>
            <Text style={wide.brandText}>MFC</Text>
          </View>
          <Text style={wide.brandTitle}>ManagerFC</Text>
        </View>

        {TABS.map((tab) => {
          const active = pathname === tab.path || (tab.name === 'index' && pathname === '/(career)');
          return (
            <TouchableOpacity
              key={tab.name}
              style={[wide.navItem, active && wide.navItemActive]}
              onPress={() => router.push(tab.path as any)}
              activeOpacity={0.75}
            >
              <Text style={wide.navIcon}>{tab.icon}</Text>
              <Text style={[wide.navLabel, active && wide.navLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          style={wide.backBtn}
          onPress={() => router.push('/')}
          activeOpacity={0.75}
        >
          <Text style={wide.backIcon}>←</Text>
          <Text style={wide.backLabel}>Menu Principal</Text>
        </TouchableOpacity>
      </View>

      {/* Content — Tabs renders the child screens */}
      <View style={wide.content}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: 'none' },
          }}
        >
          <Tabs.Screen name="index" />
          <Tabs.Screen name="squad" />
          <Tabs.Screen name="league" />
          <Tabs.Screen name="market" />
          <Tabs.Screen name="academy" />
        </Tabs>
      </View>
    </View>
  );
}

const wide = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: C.bg },
  sidebar: {
    width: 220,
    backgroundColor: C.bgCard,
    borderRightWidth: 1,
    borderRightColor: C.border,
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28, paddingHorizontal: 4 },
  brandBadge: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: C.greenDark, borderWidth: 2, borderColor: C.green,
    alignItems: 'center', justifyContent: 'center',
  },
  brandText: { color: C.textPrimary, fontSize: 10, fontWeight: '900' },
  brandTitle: { color: C.textPrimary, fontSize: 16, fontWeight: '800' },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, paddingHorizontal: 12,
    borderRadius: 10, marginBottom: 4,
  },
  navItemActive: { backgroundColor: `${C.green}20` },
  navIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  navLabel: { color: C.textMuted, fontSize: 14, fontWeight: '600' },
  navLabelActive: { color: C.green },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: C.border,
  },
  backIcon: { color: C.textMuted, fontSize: 14 },
  backLabel: { color: C.textMuted, fontSize: 13 },
  content: { flex: 1 },
});
