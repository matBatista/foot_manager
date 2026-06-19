import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useCareerStore } from '../store/careerStore';
import AuthModal from '../components/AuthModal';
import { C } from '../constants/theme';
import { listCareers, deleteCareer, divisionLabel, type Career } from '../services/careerService';

export default function HomeScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const clearToken = useAuthStore((s) => s.clearToken);
  const { setActiveCareer } = useCareerStore();

  const [authVisible, setAuthVisible] = useState(false);
  const [careers, setCareers] = useState<Career[]>([]);
  const [loadingCareers, setLoadingCareers] = useState(false);

  const fetchCareers = useCallback(async () => {
    if (!token) return;
    setLoadingCareers(true);
    try {
      const list = await listCareers();
      setCareers(list);
    } catch {
      setCareers([]);
    } finally {
      setLoadingCareers(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCareers();
  }, [fetchCareers]);

  const handleLoadCareer = (career: Career) => {
    setActiveCareer(career);
    router.push('/(career)');
  };

  const handleNewCareer = () => {
    if (!token) {
      setAuthVisible(true);
    } else {
      setActiveCareer(null);
      router.push('/select-team');
    }
  };

  const handleDeleteCareer = (career: Career) => {
    Alert.alert(
      'Aposentar',
      `Encerrar carreira com ${career.team_name ?? career.team_abbr ?? 'seu time'}? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aposentar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCareer(career.id);
              setCareers((prev) => prev.filter((c) => c.id !== career.id));
            } catch {
              Alert.alert('Erro', 'Não foi possível encerrar a carreira.');
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>MFC</Text>
          </View>
          <Text style={styles.title}>ManagerFC</Text>
          <Text style={styles.subtitle}>Sua carreira de treinador</Text>
        </View>

        {/* Career list (only when logged in) */}
        {token && (
          <View style={styles.careersSection}>
            {loadingCareers ? (
              <ActivityIndicator color={C.green} />
            ) : careers.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>SUAS CARREIRAS</Text>
                <FlatList
                  data={careers}
                  keyExtractor={(c) => c.id}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <CareerCard
                      career={item}
                      onLoad={() => handleLoadCareer(item)}
                      onDelete={() => handleDeleteCareer(item)}
                    />
                  )}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
              </>
            ) : null}
          </View>
        )}

        {/* Primary actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnPrimary} onPress={handleNewCareer} activeOpacity={0.85}>
            <Text style={styles.btnPrimaryText}>⚽  Nova Carreira</Text>
          </TouchableOpacity>

          {!token && (
            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={() => setAuthVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.btnSecondaryText}>▶  Entrar e Carregar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          {token ? (
            <View style={styles.connectedRow}>
              <Text style={styles.connectedText}>● Conectado</Text>
              <TouchableOpacity onPress={() => { clearToken(); setCareers([]); }}>
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
          fetchCareers();
        }}
      />
    </SafeAreaView>
  );
}

function CareerCard({
  career, onLoad, onDelete,
}: {
  career: Career;
  onLoad: () => void;
  onDelete: () => void;
}) {
  const teamLabel = career.team_name ?? career.team_abbr ?? '—';
  const divLabel = divisionLabel(career.division);
  const label = career.nickname || teamLabel;

  return (
    <View style={styles.careerCard}>
      <TouchableOpacity style={styles.careerCardMain} onPress={onLoad} activeOpacity={0.8}>
        <View style={styles.careerBadge}>
          <Text style={styles.careerBadgeText}>
            {career.team_abbr ?? teamLabel.slice(0, 3).toUpperCase()}
          </Text>
        </View>
        <View style={styles.careerInfo}>
          <Text style={styles.careerLabel} numberOfLines={1}>{label}</Text>
          <Text style={styles.careerMeta}>
            {divLabel} · Temp. {career.season_number}
          </Text>
        </View>
        <Text style={styles.careerArrow}>▶</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.careerDelete} onPress={onDelete} activeOpacity={0.7}>
        <Text style={styles.careerDeleteText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 28,
    justifyContent: 'space-between',
  },
  hero: { alignItems: 'center', paddingTop: 24 },
  badge: {
    width: 80,
    height: 80,
    borderRadius: 18,
    backgroundColor: C.greenDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 3,
    borderColor: C.green,
  },
  badgeText: { color: C.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 40, fontWeight: '900', color: C.textPrimary, letterSpacing: -1 },
  subtitle: { fontSize: 15, color: C.textMuted, marginTop: 6, letterSpacing: 0.5 },

  careersSection: { marginTop: 8 },
  sectionLabel: {
    color: C.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 10,
  },
  separator: { height: 8 },

  careerCard: {
    flexDirection: 'row',
    backgroundColor: C.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  careerCardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  careerBadge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: C.greenMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: C.green,
  },
  careerBadgeText: { color: C.textPrimary, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  careerInfo: { flex: 1 },
  careerLabel: { color: C.textPrimary, fontSize: 14, fontWeight: '700' },
  careerMeta: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  careerArrow: { color: C.green, fontSize: 14, marginLeft: 8 },
  careerDelete: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: C.border,
  },
  careerDeleteText: { color: C.textMuted, fontSize: 14 },

  actions: { gap: 14 },
  btnPrimary: {
    backgroundColor: C.green,
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnPrimaryText: { color: C.bg, fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  btnSecondary: {
    backgroundColor: C.bgCard,
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
  },
  btnSecondaryText: { color: C.textPrimary, fontSize: 17, fontWeight: '700' },

  footer: { alignItems: 'center' },
  connectedRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  connectedText: { color: C.green, fontSize: 14, fontWeight: '600' },
  logoutText: { color: C.textMuted, fontSize: 14 },
  loginHint: { color: C.textMuted, fontSize: 15, fontWeight: '500' },
});
