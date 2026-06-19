import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { C } from '../../constants/theme';

export default function AcademyScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.icon}>🏫</Text>
        <Text style={styles.title}>Categoria de Base</Text>
        <Text style={styles.sub}>
          Em breve: revele jovens talentos, desenvolva jogadores e construa o futuro do clube.
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Em desenvolvimento</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  icon: { fontSize: 56, marginBottom: 20 },
  title: { color: C.textPrimary, fontSize: 24, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  sub: { color: C.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 24 },
  badge: { backgroundColor: C.bgCard, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: C.border },
  badgeText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
});
