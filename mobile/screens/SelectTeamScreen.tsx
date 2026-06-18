import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  SectionList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTeamStore } from '../store/teamStore';
import { useAuthStore } from '../store/authStore';
import AuthModal from '../components/AuthModal';
import {
  TeamForSelection,
  fetchTeamsForSelection,
  selectTeamOnServer,
  teamForSelectionToStore,
  formatBudget,
} from '../services/teamService';

type Section = { title: string; data: TeamForSelection[] };

function buildSections(teams: TeamForSelection[]): Section[] {
  const a = teams.filter((t) => t.division === 'serie_a');
  const b = teams.filter((t) => t.division === 'serie_b');
  const sections: Section[] = [];
  if (a.length > 0) sections.push({ title: 'Série A', data: a });
  if (b.length > 0) sections.push({ title: 'Série B', data: b });
  return sections;
}

export default function SelectTeamScreen() {
  const router = useRouter();
  const setTeam = useTeamStore((s) => s.setTeam);
  const token = useAuthStore((s) => s.token);

  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [pendingTeam, setPendingTeam] = useState<TeamForSelection | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const teams = await fetchTeamsForSelection();
      setSections(buildSections(teams));
    } catch {
      setError('Não foi possível carregar os times. A API está rodando?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Calls backend to persist team, then saves locally and navigates home.
  const doSelect = async (team: TeamForSelection) => {
    setSelecting(team.id);
    setError(null);
    try {
      await selectTeamOnServer(team.id);
      setTeam(teamForSelectionToStore(team));
      router.replace('/');
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setError(
          'Não é possível trocar de time durante uma carreira ativa. Conclua ou abandone a carreira atual primeiro.',
        );
      } else {
        setError('Erro ao selecionar o time. Tente novamente.');
      }
    } finally {
      setSelecting(null);
    }
  };

  const handleSelect = (team: TeamForSelection) => {
    if (!token) {
      // Require auth so the selection is persisted to the server.
      setPendingTeam(team);
      setAuthModalVisible(true);
      return;
    }
    doSelect(team);
  };

  // After login/register, retry the pending team selection.
  const onAuthSuccess = () => {
    setAuthModalVisible(false);
    if (pendingTeam) {
      const team = pendingTeam;
      setPendingTeam(null);
      doSelect(team);
    }
  };

  const onAuthClose = () => {
    setAuthModalVisible(false);
    setPendingTeam(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.header}>Escolha seu time</Text>
        <Text style={styles.sub}>
          {token
            ? 'Selecione o clube que você vai gerenciar'
            : 'Faça login para salvar sua escolha no servidor'}
        </Text>

        {loading && <ActivityIndicator color="#e2b96f" style={{ marginTop: 40 }} />}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            {!error.includes('carreira ativa') && (
              <TouchableOpacity style={styles.retryBtn} onPress={load}>
                <Text style={styles.retryText}>Tentar novamente</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {!loading && !error && (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            stickySectionHeadersEnabled
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => handleSelect(item)}
                disabled={selecting !== null}
                activeOpacity={0.75}
              >
                <View style={styles.cardLeft}>
                  <Text style={styles.shortName}>{item.short_name}</Text>
                </View>
                <View style={styles.cardCenter}>
                  <Text style={styles.teamName}>{item.name}</Text>
                  <Text style={styles.teamMeta}>
                    OVR {item.avg_overall} · {formatBudget(item.budget)}
                  </Text>
                </View>
                <View style={styles.cardRight}>
                  {selecting === item.id ? (
                    <ActivityIndicator size="small" color="#e2b96f" />
                  ) : (
                    <Text style={styles.chevron}>›</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      <AuthModal
        visible={authModalVisible}
        onClose={onAuthClose}
        onSuccess={onAuthSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    color: '#f1f5f9',
    fontSize: 26,
    fontWeight: 'bold',
  },
  sub: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 20,
  },
  list: {
    paddingBottom: 32,
  },
  sectionHeader: {
    backgroundColor: '#1a1a2e',
    paddingVertical: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    color: '#e2b96f',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0f3460',
  },
  cardLeft: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#0f3460',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  shortName: {
    color: '#e2b96f',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardCenter: {
    flex: 1,
  },
  teamName: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700',
  },
  teamMeta: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  cardRight: {
    width: 28,
    alignItems: 'center',
  },
  chevron: {
    color: '#64748b',
    fontSize: 22,
    fontWeight: '300',
  },
  errorBox: {
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 8,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: '#16213e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#e2b96f',
    fontWeight: '600',
  },
});
