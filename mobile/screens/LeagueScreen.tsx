import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import {
  LeagueSummary,
  TableRow,
  ResultRow,
  TeamAnalytics,
  SaveMeta,
  createLeague,
  getLeagueTable,
  advanceLeague,
  simToEnd,
  saveLeague,
  listSaves,
  restoreSave,
  getLeagueAnalytics,
} from '../services/leagueService';
import MatchDetailsModal from '../components/MatchDetailsModal';
import {
  Career,
  SeasonRecord,
  CareerState,
  NextSeasonResponse,
  getCareer,
  startCareer,
  nextSeason,
  getCareerHistory,
  divisionLabel,
} from '../services/careerService';
import { useAuthStore } from '../store/authStore';
import AuthModal from '../components/AuthModal';
import { C } from '../constants/theme';

const COUNTRIES = [
  { label: 'Todos os Times', value: '' },
  { label: 'Brasileirão', value: 'BR' },
  { label: 'England', value: 'EN' },
];

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
    return <ActivityIndicator color={C.green} style={{ marginTop: 16 }} />;
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
                ? <ActivityIndicator color={C.green} size="small" />
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

// ---- Season History ----

function SeasonHistory({ records }: { records: SeasonRecord[] }) {
  if (records.length === 0) return null;

  return (
    <>
      <Text style={styles.sectionLabel}>Histórico de Temporadas</Text>
      <View style={styles.card}>
        {records.map((r) => (
          <View key={r.id} style={styles.historyRow}>
            <View style={styles.historyLeft}>
              <Text style={styles.historyTitle}>Temp. {r.season_number} — {divisionLabel(r.division)}</Text>
              {r.champion_name ? (
                <Text style={styles.historyChampion}>🏆 {r.champion_name}</Text>
              ) : null}
              {r.manager_position > 0 && (
                <Text style={styles.historyPos}>Seu clube: {r.manager_position}º lugar</Text>
              )}
            </View>
            <View style={styles.historyRight}>
              {r.relegated_ids.length > 0 && (
                <Text style={styles.historyRelLabel}>↓ {r.relegated_ids.length} rebaixados</Text>
              )}
              {r.promoted_ids.length > 0 && (
                <Text style={styles.historyProLabel}>↑ {r.promoted_ids.length} promovidos</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

// ---- Promotion/Relegation Card ----

interface PromRelCardProps {
  result: NextSeasonResponse;
}

function PromRelCard({ result }: PromRelCardProps) {
  return (
    <View style={styles.promRelCard}>
      <Text style={styles.promRelTitle}>Fim de Temporada</Text>
      {result.champion_name ? (
        <Text style={styles.promRelChampion}>🏆 Campeão: {result.champion_name}</Text>
      ) : null}
      {result.relegated.length > 0 && (
        <Text style={styles.promRelRelText}>↓ {result.relegated.length} clubes rebaixados</Text>
      )}
      {result.promoted.length > 0 && (
        <Text style={styles.promRelProText}>↑ {result.promoted.length} clubes promovidos</Text>
      )}
      <Text style={styles.promRelNew}>
        Nova temporada: {divisionLabel(result.career.division)}
      </Text>
    </View>
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

  // Match details modal
  const [selectedResult, setSelectedResult] = useState<ResultRow | null>(null);

  // Analytics
  const [analytics, setAnalytics] = useState<TeamAnalytics[] | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Career state
  const [career, setCareer] = useState<Career | null>(null);
  const [careerLoading, setCareerLoading] = useState(false);
  const [history, setHistory] = useState<SeasonRecord[]>([]);
  const [lastNextSeason, setLastNextSeason] = useState<NextSeasonResponse | null>(null);

  const token = useAuthStore((s) => s.token);

  // When token changes, check for existing career.
  useEffect(() => {
    if (!token) {
      setCareer(null);
      setHistory([]);
      return;
    }
    loadCareer();
  }, [token]);

  const loadCareer = useCallback(async () => {
    setCareerLoading(true);
    try {
      const state: CareerState = await getCareer();
      setCareer(state.career);
      if (state.league) {
        setLeague(state.league);
        const tableRes = await getLeagueTable(state.league.id);
        setTable(tableRes.table);
      }
      const hist = await getCareerHistory();
      setHistory(hist);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setCareer(null); // no career yet
      }
    } finally {
      setCareerLoading(false);
    }
  }, []);

  async function onStartCareer() {
    setLoading(true);
    setError(null);
    try {
      const res = await startCareer();
      setCareer(res.career);
      setLeague(res.league);
      setTable([]);
      setLastResults([]);
      setLastNextSeason(null);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Não foi possível iniciar a carreira.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function onNextSeason() {
    setLoading(true);
    setError(null);
    setSaveMsg(null);
    try {
      const res = await nextSeason();
      setCareer(res.career);
      setLeague(res.league);
      setTable([]);
      setLastResults([]);
      setLastNextSeason(res);
      const hist = await getCareerHistory();
      setHistory(hist);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Falha ao avançar temporada.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

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
    setLastNextSeason(null);
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

  async function onLoadAnalytics() {
    if (!league) return;
    setAnalyticsLoading(true);
    try {
      const res = await getLeagueAnalytics(league.id);
      setAnalytics(res.teams);
    } catch {
      // silently ignore; analytics are non-critical
    } finally {
      setAnalyticsLoading(false);
    }
  }

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

  // ---- No league state ----
  if (!league) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.header}>Liga</Text>

          <AccountBanner onLogin={() => setAuthModalVisible(true)} />

          {careerLoading && <ActivityIndicator color={C.green} style={{ marginBottom: 16 }} />}

          {/* Career mode block */}
          {token && !careerLoading && (
            career ? (
              <View style={styles.careerBanner}>
                <Text style={styles.careerBannerTitle}>
                  Carreira · Temp. {career.season_number} · {divisionLabel(career.division)}
                </Text>
                <Text style={styles.careerBannerSub}>Liga ainda não carregada</Text>
                <TouchableOpacity
                  style={[styles.btn, loading && styles.btnDisabled, { marginTop: 8 }]}
                  onPress={loadCareer}
                  disabled={loading}
                >
                  <Text style={styles.btnText}>Carregar Temporada</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.careerBanner}>
                <Text style={styles.careerBannerTitle}>Modo Carreira</Text>
                <Text style={styles.careerBannerSub}>
                  Jogue múltiplas temporadas com promoção e rebaixamento entre Série A e Série B.
                </Text>
                <TouchableOpacity
                  style={[styles.btn, loading && styles.btnDisabled, { marginTop: 8 }]}
                  onPress={onStartCareer}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color={C.bg} />
                    : <Text style={styles.btnText}>Iniciar Carreira</Text>
                  }
                </TouchableOpacity>
              </View>
            )
          )}

          {/* Partida rápida */}
          <Text style={styles.sectionLabel}>Partida Rápida</Text>
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
            style={[styles.btn, styles.btnOutline, loading && styles.btnDisabled]}
            onPress={onCreateLeague}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={C.green} />
              : <Text style={[styles.btnText, styles.btnOutlineText]}>Jogar Partida Rápida</Text>
            }
          </TouchableOpacity>

          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Carregar Save</Text>
          <SavesList onRestore={onRestoreSuccess} />

          <SeasonHistory records={history} />
        </ScrollView>

        <AuthModal
          visible={authModalVisible}
          onClose={() => { setAuthModalVisible(false); setPendingSave(false); }}
          onSuccess={onAuthSuccess}
        />
      </SafeAreaView>
    );
  }

  // ---- Has league state ----

  const isCareerLeague = !!career;
  const divName = career ? divisionLabel(career.division) : (league.country ?? 'Liga');
  const seasonNum = career ? `Temp. ${career.season_number}` : '';

  const roundLabel = league.done
    ? 'Temporada concluída'
    : `Rodada ${league.next_round - 1 > 0 ? league.next_round - 1 : '—'} / ${league.total_rounds}`;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.seasonHeader}>
          <View>
            <Text style={styles.header}>{divName}</Text>
            <Text style={styles.subheader}>
              {seasonNum ? `${seasonNum} · ` : ''}{roundLabel}
            </Text>
          </View>
          <View style={styles.headerBtns}>
            {!token && (
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={() => setAuthModalVisible(true)}
              >
                <Text style={[styles.resetBtnText, { color: C.green }]}>Login</Text>
              </TouchableOpacity>
            )}
            {!isCareerLeague && (
              <TouchableOpacity
                style={[styles.saveHeaderBtn, saveLoading && styles.btnDisabled]}
                onPress={onSave}
                disabled={saveLoading}
              >
                {saveLoading
                  ? <ActivityIndicator color={C.green} size="small" />
                  : <Text style={styles.saveHeaderBtnText}>Salvar</Text>
                }
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={() => { setLeague(null); setSaveMsg(null); setError(null); setLastNextSeason(null); setAnalytics(null); }}
            >
              <Text style={styles.resetBtnText}>{isCareerLeague ? 'Menu' : 'Nova'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {saveMsg && <Text style={styles.successText}>{saveMsg}</Text>}

        {/* Post-next-season summary card */}
        {lastNextSeason && <PromRelCard result={lastNextSeason} />}

        {/* Advance controls */}
        {!league.done && (
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btn, styles.btnHalf, loading && styles.btnDisabled]}
              onPress={() => onAdvance(false)}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={C.bg} />
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
            {isCareerLeague && (
              <TouchableOpacity
                style={[styles.nextSeasonBtn, loading && styles.btnDisabled]}
                onPress={onNextSeason}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color={C.bg} />
                  : <Text style={styles.nextSeasonBtnText}>Próxima Temporada →</Text>
                }
              </TouchableOpacity>
            )}
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
                <MatchResultRow key={i} result={r} onPress={() => setSelectedResult(r)} />
              ))}
            </View>
          </>
        )}

        {/* Standings table */}
        <Text style={styles.sectionLabel}>Classificação</Text>
        <View style={styles.card}>
          <StandingsHeader />
          {table.map((row) => (
            <StandingRow key={row.team_id} row={row} isDone={league.done} />
          ))}
          {table.length === 0 && (
            <Text style={styles.muted}>Sem resultados ainda.</Text>
          )}
        </View>

        {/* Analytics section */}
        {league.next_round > 2 && (
          <>
            <Text style={styles.sectionLabel}>Análise da Temporada</Text>
            {!analytics && (
              <TouchableOpacity
                style={[styles.btn, styles.btnOutline, analyticsLoading && styles.btnDisabled]}
                onPress={onLoadAnalytics}
                disabled={analyticsLoading}
              >
                <Text style={[styles.btnText, styles.btnOutlineText]}>
                  {analyticsLoading ? 'Carregando…' : 'Ver Análise'}
                </Text>
              </TouchableOpacity>
            )}
            {analytics && <AnalyticsTable teams={analytics} />}
          </>
        )}

        {/* Season history inline */}
        <SeasonHistory records={history} />
      </ScrollView>

      <AuthModal
        visible={authModalVisible}
        onClose={() => { setAuthModalVisible(false); setPendingSave(false); }}
        onSuccess={onAuthSuccess}
      />

      <MatchDetailsModal
        visible={selectedResult !== null}
        result={selectedResult}
        onClose={() => setSelectedResult(null)}
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

function StandingRow({ row, isDone }: { row: TableRow; isDone: boolean }) {
  const isTop4 = row.position <= 4;
  const isBottom4 = isDone && row.position >= (20 - 4 + 1); // 17-20
  return (
    <View style={[
      styles.tableRow,
      isTop4 && styles.tableRowTop,
      isBottom4 && styles.tableRowBottom,
    ]}>
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

function MatchResultRow({ result, onPress }: { result: ResultRow; onPress?: () => void }) {
  const homeWin = result.home_goals > result.away_goals;
  const awayWin = result.away_goals > result.home_goals;
  const hasStats = !!(result.home_stats && result.away_stats);
  return (
    <TouchableOpacity style={styles.resultRow} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <Text style={[styles.resultTeam, homeWin && styles.resultWinner]} numberOfLines={1}>
        {result.home_name}
      </Text>
      <View style={styles.resultScoreWrap}>
        <Text style={styles.resultScore}>
          {result.home_goals} – {result.away_goals}
        </Text>
        {hasStats && <Text style={styles.resultStatsHint}>ver stats</Text>}
      </View>
      <Text style={[styles.resultTeam, styles.resultTeamRight, awayWin && styles.resultWinner]} numberOfLines={1}>
        {result.away_name}
      </Text>
    </TouchableOpacity>
  );
}

function AnalyticsTable({ teams }: { teams: TeamAnalytics[] }) {
  return (
    <View style={styles.card}>
      <View style={[styles.tableRow, styles.tableHeaderRow]}>
        <Text style={[styles.colName, styles.colHeader]}>Time</Text>
        <Text style={[styles.colStat, styles.colHeader]}>J</Text>
        <Text style={[styles.colStat, styles.colHeader]}>xG</Text>
        <Text style={[styles.colStat, styles.colHeader]}>xGC</Text>
        <Text style={[styles.colStat, styles.colHeader]}>Pos%</Text>
        <Text style={[styles.colStat, styles.colHeader]}>Chut</Text>
      </View>
      {teams.map((t) => (
        <View key={t.team_id} style={styles.tableRow}>
          <Text style={[styles.colName, styles.cellText]} numberOfLines={1}>{t.name}</Text>
          <Text style={[styles.colStat, styles.cellText]}>{t.played}</Text>
          <Text style={[styles.colStat, styles.cellText]}>{t.total_xg_for.toFixed(1)}</Text>
          <Text style={[styles.colStat, styles.cellText]}>{t.total_xg_against.toFixed(1)}</Text>
          <Text style={[styles.colStat, styles.cellText]}>{t.avg_possession.toFixed(0)}</Text>
          <Text style={[styles.colStat, styles.cellText]}>{t.avg_shots.toFixed(1)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg, position: 'relative' },
  container: { padding: 16, paddingBottom: 48 },

  header: { color: C.textPrimary, fontSize: 26, fontWeight: 'bold' },
  subheader: { color: C.textMuted, fontSize: 13, marginTop: 2 },

  seasonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  sectionLabel: {
    color: C.textMuted,
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
    backgroundColor: C.bgCard,
  },
  chipActive: { backgroundColor: C.green },
  chipText: { color: C.textMuted, fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: C.bg },

  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  btn: {
    backgroundColor: C.green,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  btnHalf: { flex: 1 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: C.bg, fontSize: 15, fontWeight: 'bold' },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: C.green,
  },
  btnOutlineText: { color: C.green },

  resetBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  resetBtnText: { color: C.textMuted, fontSize: 13 },

  saveHeaderBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.green,
    minWidth: 64,
    alignItems: 'center',
  },
  saveHeaderBtnText: { color: C.green, fontSize: 13, fontWeight: '600' },

  doneCard: {
    backgroundColor: C.bgSurface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.greenDim,
  },
  doneText: { color: C.gold, fontSize: 18, fontWeight: 'bold' },
  doneSubtext: { color: C.textPrimary, fontSize: 14, marginTop: 4 },

  nextSeasonBtn: {
    marginTop: 14,
    backgroundColor: C.green,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  nextSeasonBtnText: { color: C.bg, fontSize: 15, fontWeight: 'bold' },

  // Career banner
  careerBanner: {
    backgroundColor: C.bgSurface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  careerBannerTitle: { color: C.green, fontSize: 16, fontWeight: 'bold' },
  careerBannerSub: { color: C.textMuted, fontSize: 13, marginTop: 4, lineHeight: 18 },

  // Promotion/Relegation card
  promRelCard: {
    backgroundColor: C.bgSurface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.greenDim,
  },
  promRelTitle: { color: C.gold, fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  promRelChampion: { color: C.textPrimary, fontSize: 14, marginBottom: 2 },
  promRelRelText: { color: C.red, fontSize: 13, marginBottom: 2 },
  promRelProText: { color: C.green, fontSize: 13, marginBottom: 2 },
  promRelNew: { color: C.textMuted, fontSize: 12, marginTop: 4 },

  // Season history
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  historyLeft: { flex: 1 },
  historyRight: { alignItems: 'flex-end' },
  historyTitle: { color: C.textPrimary, fontSize: 14, fontWeight: '600' },
  historyChampion: { color: C.gold, fontSize: 13, marginTop: 2 },
  historyPos: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  historyRelLabel: { color: C.red, fontSize: 12 },
  historyProLabel: { color: C.green, fontSize: 12 },

  errorText: { color: C.red, textAlign: 'center', marginVertical: 8, fontSize: 14 },
  successText: { color: C.green, textAlign: 'center', marginVertical: 8, fontSize: 14 },
  muted: { color: C.textMuted, fontSize: 14, paddingVertical: 8 },

  card: {
    backgroundColor: C.bgCard,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },

  // Standings table
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tableHeaderRow: { backgroundColor: C.bgSurface },
  tableRowTop: { borderLeftWidth: 3, borderLeftColor: C.green },
  tableRowBottom: { borderLeftWidth: 3, borderLeftColor: C.red },

  colPos: { width: 22, textAlign: 'center' },
  colName: { flex: 1, paddingHorizontal: 6 },
  colStat: { width: 28, textAlign: 'center' },
  colPts: { width: 34, textAlign: 'center' },

  colHeader: { color: C.textMuted, fontSize: 11, fontWeight: '700' },
  cellText: { color: C.textPrimary, fontSize: 13 },
  cellPts: { color: C.gold, fontSize: 13, fontWeight: 'bold' },

  // Results
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  resultTeam: { flex: 1, color: C.textMuted, fontSize: 13 },
  resultTeamRight: { textAlign: 'right' },
  resultWinner: { color: C.textPrimary, fontWeight: '700' },
  resultScoreWrap: { alignItems: 'center', paddingHorizontal: 12, minWidth: 70 },
  resultScore: {
    color: C.gold,
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resultStatsHint: { color: C.borderLight, fontSize: 10, marginTop: 2 },

  // Account banner
  loginBanner: {
    backgroundColor: C.bgSurface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  loginBannerText: { color: C.textMuted, fontSize: 13, flex: 1 },
  loginBannerAction: { color: C.green, fontSize: 13, fontWeight: '700', marginLeft: 8 },

  accountBanner: {
    backgroundColor: C.bgCard,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  accountBannerText: { color: C.green, fontSize: 13, fontWeight: '600' },
  accountBannerAction: { color: C.textMuted, fontSize: 13 },

  // Saves list
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  saveLabel: { color: C.textPrimary, fontSize: 14, fontWeight: '600' },
  saveDate: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  saveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.green,
    minWidth: 80,
    alignItems: 'center',
  },
  saveBtnText: { color: C.green, fontSize: 13, fontWeight: '600' },
});
