import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  TextInput,
} from 'react-native';
import {
  LeagueSummary,
  TableRow,
  ResultRow,
  SaveMeta,
  createLeague,
  getLeagueTable,
  advanceLeague,
  simToEnd,
  saveLeague,
  listSaves,
  restoreSave,
} from '../services/leagueService';
import { login, register } from '../services/authService';
import { useAuthStore } from '../store/authStore';

const COUNTRIES = [
  { label: 'Todos os Times', value: '' },
  { label: 'Brasileirão', value: 'BR' },
  { label: 'England', value: 'EN' },
];

// ---- Auth Modal ----

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function AuthModal({ visible, onClose, onSuccess }: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setToken = useAuthStore((s) => s.setToken);

  function reset() {
    setName('');
    setEmail('');
    setPassword('');
    setError(null);
    setLoading(false);
  }

  function switchTab(t: 'login' | 'register') {
    setTab(t);
    setError(null);
  }

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      const res = tab === 'login'
        ? await login(email.trim(), password)
        : await register(name.trim(), email.trim(), password);
      setToken(res.token);
      reset();
      onSuccess();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Erro desconhecido';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} />
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>Conta</Text>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, tab === 'login' && styles.tabActive]}
            onPress={() => switchTab('login')}
          >
            <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>Entrar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'register' && styles.tabActive]}
            onPress={() => switchTab('register')}
          >
            <Text style={[styles.tabText, tab === 'register' && styles.tabTextActive]}>Cadastrar</Text>
          </TouchableOpacity>
        </View>

        {tab === 'register' && (
          <TextInput
            style={styles.input}
            placeholder="Nome"
            placeholderTextColor="#64748b"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Senha (mín. 8 caracteres)"
          placeholderTextColor="#64748b"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={onSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#1a1a2e" />
            : <Text style={styles.btnText}>{tab === 'login' ? 'Entrar' : 'Cadastrar'}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.modalClose} onPress={onClose}>
          <Text style={styles.modalCloseText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---- Saves List ----

interface SavesListProps {
  onRestore: (leagueId: string, leagueSummary: LeagueSummary, table: TableRow[]) => void;
}

function SavesList({ onRestore }: SavesListProps) {
  const token = useAuthStore((s) => s.token);
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchSaves = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setSaves(await listSaves());
    } catch {
      setError('Não foi possível carregar os saves.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSaves();
  }, [fetchSaves]);

  async function onLoad(saveId: string) {
    setRestoringId(saveId);
    setError(null);
    try {
      const res = await restoreSave(saveId);
      const tableRes = await getLeagueTable(res.league_id);
      onRestore(res.league_id, tableRes.league, tableRes.table);
    } catch {
      setError('Falha ao carregar o save.');
    } finally {
      setRestoringId(null);
    }
  }

  if (!token) {
    return (
      <Text style={[styles.muted, { marginTop: 4 }]}>
        Faça login acima para ver seus saves.
      </Text>
    );
  }

  if (loading) {
    return <ActivityIndicator color="#e2b96f" style={{ marginTop: 16 }} />;
  }

  if (saves.length === 0 && !error) {
    return <Text style={[styles.muted, { marginTop: 8 }]}>Nenhum save encontrado.</Text>;
  }

  return (
    <View style={styles.card}>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {saves.map((s) => {
        const date = new Date(s.saved_at).toLocaleString('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short',
        });
        const label = s.country ? s.country : 'Global';
        return (
          <View key={s.id} style={styles.saveRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.saveLabel}>{label}</Text>
              <Text style={styles.saveDate}>{date}</Text>
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, restoringId === s.id && styles.btnDisabled]}
              onPress={() => onLoad(s.id)}
              disabled={restoringId !== null}
            >
              {restoringId === s.id
                ? <ActivityIndicator color="#e2b96f" size="small" />
                : <Text style={styles.saveBtnText}>Carregar</Text>
              }
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

// ---- Account Banner ----

interface AccountBannerProps {
  onLogin: () => void;
}

function AccountBanner({ onLogin }: AccountBannerProps) {
  const token = useAuthStore((s) => s.token);
  const clearToken = useAuthStore((s) => s.clearToken);

  if (token) {
    return (
      <View style={styles.accountBanner}>
        <Text style={styles.accountBannerText}>Conectado</Text>
        <TouchableOpacity onPress={clearToken}>
          <Text style={styles.accountBannerAction}>Sair</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.loginBanner} onPress={onLogin}>
      <Text style={styles.loginBannerText}>Entre para salvar e carregar jogos</Text>
      <Text style={styles.loginBannerAction}>Fazer login →</Text>
    </TouchableOpacity>
  );
}

// ---- Main Screen ----

export default function LeagueScreen() {
  const [league, setLeague] = useState<LeagueSummary | null>(null);
  const [table, setTable] = useState<TableRow[]>([]);
  const [lastResults, setLastResults] = useState<ResultRow[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);

  const token = useAuthStore((s) => s.token);

  async function onCreateLeague() {
    setLoading(true);
    setError(null);
    try {
      const summary = await createLeague(selectedCountry);
      const tableRes = await getLeagueTable(summary.id);
      setLeague(tableRes.league);
      setTable(tableRes.table);
      setLastResults([]);
    } catch {
      setError('Não foi possível iniciar a temporada. API está rodando?');
    } finally {
      setLoading(false);
    }
  }

  const onAdvance = useCallback(async (toEnd: boolean) => {
    if (!league) return;
    setLoading(true);
    setError(null);
    setSaveMsg(null);
    try {
      const res = toEnd
        ? await simToEnd(league.id)
        : await advanceLeague(league.id);
      setLeague(res.league);
      setTable(res.table);
      setLastResults(res.results);
    } catch {
      setError('Falha ao avançar a temporada.');
    } finally {
      setLoading(false);
    }
  }, [league]);

  async function onSave() {
    if (!league) return;
    if (!token) {
      setPendingSave(true);
      setAuthModalVisible(true);
      return;
    }
    setSaveLoading(true);
    setSaveMsg(null);
    setError(null);
    try {
      await saveLeague(league.id);
      setSaveMsg('Save criado!');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Falha ao salvar.';
      setError(msg);
    } finally {
      setSaveLoading(false);
    }
  }

  function onAuthSuccess() {
    setAuthModalVisible(false);
    if (pendingSave) {
      setPendingSave(false);
      onSave();
    }
  }

  function onRestoreSuccess(leagueId: string, leagueSummary: LeagueSummary, restoredTable: TableRow[]) {
    setLeague({ ...leagueSummary, id: leagueId });
    setTable(restoredTable);
    setLastResults([]);
    setError(null);
    setSaveMsg(null);
  }

  if (!league) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.header}>Nova Temporada</Text>

          <AccountBanner onLogin={() => setAuthModalVisible(true)} />

          <Text style={styles.sectionLabel}>Escolha a liga</Text>
          <View style={styles.chipRow}>
            {COUNTRIES.map((c) => (
              <TouchableOpacity
                key={c.value}
                style={[styles.chip, selectedCountry === c.value && styles.chipActive]}
                onPress={() => setSelectedCountry(c.value)}
              >
                <Text style={[styles.chipText, selectedCountry === c.value && styles.chipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={onCreateLeague}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#1a1a2e" />
              : <Text style={styles.btnText}>Iniciar Temporada</Text>
            }
          </TouchableOpacity>

          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Carregar Save</Text>
          <SavesList
            onRestore={onRestoreSuccess}
          />
        </ScrollView>

        <AuthModal
          visible={authModalVisible}
          onClose={() => { setAuthModalVisible(false); setPendingSave(false); }}
          onSuccess={onAuthSuccess}
        />
      </SafeAreaView>
    );
  }

  const roundLabel = league.done
    ? 'Temporada concluída'
    : `Rodada ${league.next_round - 1 > 0 ? league.next_round - 1 : '—'} / ${league.total_rounds}`;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.seasonHeader}>
          <View>
            <Text style={styles.header}>
              {league.country ? league.country : 'Liga'}
            </Text>
            <Text style={styles.subheader}>{roundLabel}</Text>
          </View>
          <View style={styles.headerBtns}>
            {!token && (
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={() => setAuthModalVisible(true)}
              >
                <Text style={[styles.resetBtnText, { color: '#e2b96f' }]}>Login</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.saveHeaderBtn, saveLoading && styles.btnDisabled]}
              onPress={onSave}
              disabled={saveLoading}
            >
              {saveLoading
                ? <ActivityIndicator color="#e2b96f" size="small" />
                : <Text style={styles.saveHeaderBtnText}>Salvar</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={() => { setLeague(null); setSaveMsg(null); setError(null); }}
            >
              <Text style={styles.resetBtnText}>Nova</Text>
            </TouchableOpacity>
          </View>
        </View>

        {saveMsg && <Text style={styles.successText}>{saveMsg}</Text>}

        {/* Advance controls */}
        {!league.done && (
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btn, styles.btnHalf, loading && styles.btnDisabled]}
              onPress={() => onAdvance(false)}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#1a1a2e" />
                : <Text style={styles.btnText}>Jogar Rodada</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnHalf, styles.btnOutline, loading && styles.btnDisabled]}
              onPress={() => onAdvance(true)}
              disabled={loading}
            >
              <Text style={[styles.btnText, styles.btnOutlineText]}>Sim. Temporada</Text>
            </TouchableOpacity>
          </View>
        )}

        {league.done && (
          <View style={styles.doneCard}>
            <Text style={styles.doneText}>Temporada encerrada!</Text>
            <Text style={styles.doneSubtext}>
              {table[0]?.name} vence o título
            </Text>
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Last round results */}
        {lastResults.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>
              Resultados — Rodada {lastResults[0]?.round}
            </Text>
            <View style={styles.card}>
              {lastResults.map((r, i) => (
                <MatchResultRow key={i} result={r} />
              ))}
            </View>
          </>
        )}

        {/* Standings table */}
        <Text style={styles.sectionLabel}>Classificação</Text>
        <View style={styles.card}>
          <StandingsHeader />
          {table.map((row) => (
            <StandingRow key={row.team_id} row={row} />
          ))}
          {table.length === 0 && (
            <Text style={styles.muted}>Sem resultados ainda.</Text>
          )}
        </View>
      </ScrollView>

      <AuthModal
        visible={authModalVisible}
        onClose={() => { setAuthModalVisible(false); setPendingSave(false); }}
        onSuccess={onAuthSuccess}
      />
    </SafeAreaView>
  );
}

function StandingsHeader() {
  return (
    <View style={[styles.tableRow, styles.tableHeaderRow]}>
      <Text style={[styles.colPos, styles.colHeader]}>#</Text>
      <Text style={[styles.colName, styles.colHeader]}>Time</Text>
      <Text style={[styles.colStat, styles.colHeader]}>P</Text>
      <Text style={[styles.colStat, styles.colHeader]}>V</Text>
      <Text style={[styles.colStat, styles.colHeader]}>E</Text>
      <Text style={[styles.colStat, styles.colHeader]}>D</Text>
      <Text style={[styles.colStat, styles.colHeader]}>SG</Text>
      <Text style={[styles.colPts, styles.colHeader]}>Pts</Text>
    </View>
  );
}

function StandingRow({ row }: { row: TableRow }) {
  const isTop = row.position <= 4;
  return (
    <View style={[styles.tableRow, isTop && styles.tableRowTop]}>
      <Text style={[styles.colPos, styles.cellText]}>{row.position}</Text>
      <Text style={[styles.colName, styles.cellText]} numberOfLines={1}>{row.name}</Text>
      <Text style={[styles.colStat, styles.cellText]}>{row.played}</Text>
      <Text style={[styles.colStat, styles.cellText]}>{row.won}</Text>
      <Text style={[styles.colStat, styles.cellText]}>{row.drawn}</Text>
      <Text style={[styles.colStat, styles.cellText]}>{row.lost}</Text>
      <Text style={[styles.colStat, styles.cellText]}>
        {row.goal_diff > 0 ? `+${row.goal_diff}` : row.goal_diff}
      </Text>
      <Text style={[styles.colPts, styles.cellPts]}>{row.points}</Text>
    </View>
  );
}

function MatchResultRow({ result }: { result: ResultRow }) {
  const homeWin = result.home_goals > result.away_goals;
  const awayWin = result.away_goals > result.home_goals;
  return (
    <View style={styles.resultRow}>
      <Text style={[styles.resultTeam, homeWin && styles.resultWinner]} numberOfLines={1}>
        {result.home_name}
      </Text>
      <Text style={styles.resultScore}>
        {result.home_goals} – {result.away_goals}
      </Text>
      <Text style={[styles.resultTeam, styles.resultTeamRight, awayWin && styles.resultWinner]} numberOfLines={1}>
        {result.away_name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1a1a2e', position: 'relative' },
  container: { padding: 16, paddingBottom: 48 },

  header: { color: '#f1f5f9', fontSize: 26, fontWeight: 'bold' },
  subheader: { color: '#94a3b8', fontSize: 13, marginTop: 2 },

  seasonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  sectionLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#16213e',
  },
  chipActive: { backgroundColor: '#e2b96f' },
  chipText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: '#1a1a2e' },

  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  btn: {
    backgroundColor: '#e2b96f',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  btnHalf: { flex: 1 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#1a1a2e', fontSize: 15, fontWeight: 'bold' },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#e2b96f',
  },
  btnOutlineText: { color: '#e2b96f' },

  resetBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  resetBtnText: { color: '#94a3b8', fontSize: 13 },

  saveHeaderBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2b96f',
    minWidth: 64,
    alignItems: 'center',
  },
  saveHeaderBtnText: { color: '#e2b96f', fontSize: 13, fontWeight: '600' },

  doneCard: {
    backgroundColor: '#0f3460',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  doneText: { color: '#e2b96f', fontSize: 18, fontWeight: 'bold' },
  doneSubtext: { color: '#f1f5f9', fontSize: 14, marginTop: 4 },

  errorText: { color: '#ef4444', textAlign: 'center', marginVertical: 8, fontSize: 14 },
  successText: { color: '#4ade80', textAlign: 'center', marginVertical: 8, fontSize: 14 },
  muted: { color: '#64748b', fontSize: 14, paddingVertical: 8 },

  card: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Standings table
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  tableHeaderRow: { backgroundColor: '#0f3460' },
  tableRowTop: { borderLeftWidth: 3, borderLeftColor: '#e2b96f' },

  colPos: { width: 22, textAlign: 'center' },
  colName: { flex: 1, paddingHorizontal: 6 },
  colStat: { width: 28, textAlign: 'center' },
  colPts: { width: 34, textAlign: 'center' },

  colHeader: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  cellText: { color: '#f1f5f9', fontSize: 13 },
  cellPts: { color: '#e2b96f', fontSize: 13, fontWeight: 'bold' },

  // Results
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  resultTeam: { flex: 1, color: '#94a3b8', fontSize: 13 },
  resultTeamRight: { textAlign: 'right' },
  resultWinner: { color: '#f1f5f9', fontWeight: '700' },
  resultScore: {
    color: '#e2b96f',
    fontSize: 15,
    fontWeight: 'bold',
    paddingHorizontal: 12,
    minWidth: 60,
    textAlign: 'center',
  },

  // Auth modal
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 100,
  },
  modalCard: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#f1f5f9',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#0f3460',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#e2b96f' },
  tabText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#1a1a2e' },
  input: {
    backgroundColor: '#0f3460',
    color: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  modalClose: { marginTop: 10, alignItems: 'center' },
  modalCloseText: { color: '#64748b', fontSize: 14 },

  // Account banner
  loginBanner: {
    backgroundColor: '#0f3460',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loginBannerText: { color: '#94a3b8', fontSize: 13, flex: 1 },
  loginBannerAction: { color: '#e2b96f', fontSize: 13, fontWeight: '700', marginLeft: 8 },

  accountBanner: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountBannerText: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
  accountBannerAction: { color: '#94a3b8', fontSize: 13 },

  // Saves list
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  saveLabel: { color: '#f1f5f9', fontSize: 14, fontWeight: '600' },
  saveDate: { color: '#64748b', fontSize: 12, marginTop: 2 },
  saveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2b96f',
    minWidth: 80,
    alignItems: 'center',
  },
  saveBtnText: { color: '#e2b96f', fontSize: 13, fontWeight: '600' },
});
