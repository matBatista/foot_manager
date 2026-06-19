import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import AuthModal from '../components/AuthModal';
import { C } from '../constants/theme';

export default function HomeScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const clearToken = useAuthStore((s) => s.clearToken);
  const [authVisible, setAuthVisible] = useState(false);

  const handleNewCareer = () => {
    router.push('/select-team');
  };

  const handleLoadCareer = () => {
    if (!token) {
      setAuthVisible(true);
    } else {
      router.push('/(career)');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>MFC</Text>
          </View>
          <Text style={styles.title}>ManagerFC</Text>
          <Text style={styles.subtitle}>Sua carreira de treinador</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnPrimary} onPress={handleNewCareer} activeOpacity={0.85}>
            <Text style={styles.btnPrimaryText}>⚽  Nova Carreira</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={handleLoadCareer} activeOpacity={0.85}>
            <Text style={styles.btnSecondaryText}>▶  Carregar Carreira</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          {token ? (
            <View style={styles.connectedRow}>
              <Text style={styles.connectedText}>● Conectado</Text>
              <TouchableOpacity onPress={clearToken}>
                <Text style={styles.logoutText}>Sair</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setAuthVisible(true)}>
              <Text style={styles.loginHint}>Entrar com sua conta →</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <AuthModal
        visible={authVisible}
        onClose={() => setAuthVisible(false)}
        onSuccess={() => {
          setAuthVisible(false);
          router.push('/(career)');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  hero: { alignItems: 'center', paddingTop: 40 },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 20,
    backgroundColor: C.greenDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: C.green,
  },
  badgeText: { color: C.textPrimary, fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 44, fontWeight: '900', color: C.textPrimary, letterSpacing: -1 },
  subtitle: { fontSize: 16, color: C.textMuted, marginTop: 8, letterSpacing: 0.5 },
  actions: { gap: 16 },
  btnPrimary: {
    backgroundColor: C.green,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnPrimaryText: { color: C.bg, fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  btnSecondary: {
    backgroundColor: C.bgCard,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
  },
  btnSecondaryText: { color: C.textPrimary, fontSize: 18, fontWeight: '700' },
  footer: { alignItems: 'center' },
  connectedRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  connectedText: { color: C.green, fontSize: 14, fontWeight: '600' },
  logoutText: { color: C.textMuted, fontSize: 14 },
  loginHint: { color: C.textMuted, fontSize: 15, fontWeight: '500' },
});
