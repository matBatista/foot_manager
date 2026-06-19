import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useTeamStore } from '../../store/teamStore';
import { useMatchResultStore } from '../../store/matchStore';
import {
  getCareer, startCareer, divisionLabel,
  type Career,
} from '../../services/careerService';
import {
  getLeagueTable, advanceLeague,
  type LeagueSummary, type TableRow,
} from '../../services/leagueService';
import { formatBudget } from '../../services/teamService';
import AuthModal from '../../components/AuthModal';
import MatchDetailsModal from '../../components/MatchDetailsModal';
import { C } from '../../constants/theme';
import type { ResultRow } from '../../services/leagueService';

export default function CareerHubScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const selectedTeam = useTeamStore((s) => s.selectedTeam);
  const { roundResults, setRoundResults } = useMatchResultStore();

  const [career, setCareer] = useState<Career | null>(null);
  const [league, setLeague] = useState<LeagueSummary | null>(null);
  const [table, setTable] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authVisible, setAuthVisible] = useState(false);
  const [selectedResult, setSelectedResult] = useState<ResultRow | null>(null);

  const loadCareer = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const state = await getCareer();
      setCareer(state.career);
      if (state.league) {
        setLeague(state.league);
        const tableRes = await getLeagueTable(state.league.id);
        setTable(tableRes.table);
      }
    } catch (e: any) {
      if (e?.response?.status !== 404) {
        setError('Não foi possível carregar a carreira.');
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) loadCareer();
    else { setCareer(null); setLeague(null); setTable([]); }
  }, [token, loadCareer]);

  const handleStartCareer = async () => {
    if (!token) { setAuthVisible(true); return; }
    if (!selectedTeam) { router.push('/select-team'); return; }
    setActionLoading(true);
    setError(null);
    try {
      const res = await startCareer();
      setCareer(res.career);
      setLeague(res.league);
      const tableRes = await getLeagueTable(res.league.id);
      setTable(tableRes.table);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Não foi possível iniciar a carreira.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePlayRound = async () => {
    if (!league) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await advanceLeague(league.id);
      setLeague(res.league);
      setTable(res.table);
      const roundNum = (league.next_round ?? 1);
      setRoundResults(res.results, res.league, selectedTeam?.id ?? null, roundNum);
      router.push('/match');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Falha ao avançar rodada.');
    } finally {
      setActionLoading(false);
    }
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.stateIcon}>🔐</Text>
          <Text style={styles.stateTitle}>Entre para jogar</Text>
          <Text style={styles.stateSub}>Faça login para gerenciar sua carreira</Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => setAuthVisible(true)}>
            <Text style={styles.ctaBtnText}>Fazer Login</Text>
          </TouchableOpacity>
        </View>
        <AuthModal
          visible={authVisible}
          onClose={() => setAuthVisible(false)}
          onSuccess={() => setAuthVisible(false)}
        />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={C.green} size="large" />
          <Text style={[styles.stateSub, { marginTop: 12 }]}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!selectedTeam) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.stateIcon}>⚽</Text>
          <Text style={styles.stateTitle}>Escolha seu time</Text>
          <Text style={styles.stateSub}>Selecione o clube que você vai gerenciar</Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/select-team')}>
            <Text style={styles.ctaBtnText}>Escolher Time</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!career) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container}>
          <ClubHeader team={selectedTeam} />
          <View style={styles.noCareerCard}>
            <Text style={styles.noCareerTitle}>Iniciar Carreira</Text>
            <Text style={styles.noCareerSub}>
              Comece com o {selectedTeam.name} e dispute múltiplas temporadas com
              promoção e rebaixamento entre Série A e Série B.
            </Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.ctaBtn, { marginTop: 16 }, actionLoading && styles.ctaBtnDisabled]}
              onPress={handleStartCareer}
              disabled={actionLoading}
            >
              {actionLoading
                ? <ActivityIndicator color={C.bg} />
                : <Text style={styles.ctaBtnText}>⚽  Iniciar Carreira</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const myRow = table.find((r) => r.team_id === selectedTeam.id);
  const roundLabel = league?.done
    ? 'Temporada encerrada'
    : league
      ? `Rodada ${Math.max(0, (league.next_round ?? 1) - 1)} / ${league.total_rounds}`
      : '—';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <ClubHeader
          team={selectedTeam}
          position={myRow?.position}
          points={myRow?.points}
          division={divisionLabel(career.division)}
          season={career.season_number}
        />

        {league && (
          <View style={styles.seasonCard}>
            <View style={styles.seasonRow}>
              <Text style={styles.seasonTitle}>{divisionLabel(career.division)} · Temp. {career.season_number}</Text>
              <Text style={styles.seasonRound}>{roundLabel}</Text>
            </View>
            {!league.done && (
              <View style={styles.progressBar}>
                <View style={[
                  styles.progressFill,
                  { width: `${Math.min(100, ((league.next_round - 1) / league.total_rounds) * 100)}%` as any }
                ]} />
              </View>
            )}
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {league && !league.done && (
          <TouchableOpacity
            style={[styles.playBtn, actionLoading && styles.ctaBtnDisabled]}
            onPress={handlePlayRound}
            disabled={actionLoading}
            activeOpacity={0.85}
          >
            {actionLoading ? (
              <ActivityIndicator color={C.bg} />
            ) : (
              <View style={styles.playBtnInner}>
                <Text style={styles.playBtnIcon}>▶</Text>
                <View>
                  <Text style={styles.playBtnLabel}>Jogar Próxima Rodada</Text>
                  {league && <Text style={styles.playBtnSub}>Rodada {league.next_round} de {league.total_rounds}</Text>}
                </View>
              </View>
            )}
          </TouchableOpacity>
        )}

        {league?.done && (
          <View style={styles.doneCard}>
            <Text style={styles.doneTitle}>🏆 Temporada Encerrada!</Text>
            <Text style={styles.doneSub}>{table[0]?.name} vence o título</Text>
            <TouchableOpacity style={[styles.ctaBtn, { marginTop: 12 }]} onPress={() => router.push('/(career)/league')}>
              <Text style={styles.ctaBtnText}>Ver Liga</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionLabel}>GESTÃO</Text>
        <View style={styles.menuGrid}>
          <MenuCard icon="👥" title="Elenco" sub="Gerenciar jogadores" onPress={() => router.push('/(career)/squad')} />
          <MenuCard icon="💸" title="Mercado" sub="Comprar e vender" onPress={() => router.push('/(career)/market')} />
          <MenuCard icon="🏆" title="Liga" sub="Tabela e resultados" onPress={() => router.push('/(career)/league')} />
          <MenuCard icon="🏫" title="Base" sub="Em breve" onPress={() => router.push('/(career)/academy')} dimmed />
        </View>

        {roundResults.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>ÚLTIMA RODADA</Text>
            <View style={styles.card}>
              {roundResults.slice(0, 5).map((r, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.resultRow, i > 0 && styles.resultRowBorder]}
                  onPress={() => setSelectedResult(r)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.resultTeam, r.home_goals > r.away_goals && styles.resultWinner]}
                    numberOfLines={1}
                  >
                    {r.home_name}
                  </Text>
                  <View style={styles.resultScoreWrap}>
                    <Text style={styles.resultScore}>{r.home_goals} – {r.away_goals}</Text>
                  </View>
                  <Text
                    style={[styles.resultTeam, styles.resultTeamRight, r.away_goals > r.home_goals && styles.resultWinner]}
                    numberOfLines={1}
                  >
                    {r.away_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {table.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>CLASSIFICAÇÃO</Text>
            <View style={styles.card}>
              {table.slice(0, 5).map((row) => {
                const isMine = row.team_id === selectedTeam.id;
                return (
                  <View key={row.team_id} style={[styles.tableRow, isMine && styles.tableRowMine]}>
                    <Text style={styles.tablePos}>{row.position}</Text>
                    <Text style={[styles.tableName, isMine && styles.tableNameMine]} numberOfLines={1}>
                      {row.name}
                    </Text>
                    <Text style={styles.tablePts}>{row.points}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <MatchDetailsModal
        visible={selectedResult !== null}
        result={selectedResult}
        onClose={() => setSelectedResult(null)}
      />
      <AuthModal
        visible={authVisible}
        onClose={() => setAuthVisible(false)}
        onSuccess={() => setAuthVisible(false)}
      />
    </SafeAreaView>
  );
}

function ClubHeader({
  team, position, points, division, season,
}: {
  team: { shortName: string; name: string; division: string; budget: number };
  position?: number;
  points?: number;
  division?: string;
  season?: number;
}) {
  return (
    <View style={styles.clubHeader}>
      <View style={styles.clubBadge}>
        <Text style={styles.clubBadgeText}>{team.shortName}</Text>
      </View>
      <View style={styles.clubInfo}>
        <Text style={styles.clubName}>{team.name}</Text>
        <Text style={styles.clubMeta}>
          {division ?? (team.division === 'serie_a' ? 'Série A' : 'Série B')}
          {season ? ` · Temp. ${season}` : ''}
          {' · '}{formatBudget(team.budget)}
        </Text>
      </View>
      {position !== undefined && (
        <View style={styles.clubStat}>
          <Text style={styles.clubStatNum}>{position}º</Text>
          <Text style={styles.clubStatLabel}>{points ?? 0} pts</Text>
        </View>
      )}
    </View>
  );
}

function MenuCard({
  icon, title, sub, onPress, dimmed,
}: {
  icon: string; title: string; sub: string; onPress: () => void; dimmed?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuCard, dimmed && { opacity: 0.45 }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={styles.menuTitle}>{title}</Text>
      <Text style={styles.menuSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { padding: 16, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  stateIcon: { fontSize: 48, marginBottom: 16 },
  stateTitle: { color: C.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  stateSub: { color: C.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  ctaBtn: { backgroundColor: C.green, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, alignItems: 'center', minWidth: 180 },
  ctaBtnDisabled: { opacity: 0.5 },
  ctaBtnText: { color: C.bg, fontSize: 16, fontWeight: '800' },
  clubHeader: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard,
    borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border,
  },
  clubBadge: {
    width: 48, height: 48, borderRadius: 10, backgroundColor: C.greenMuted,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
    borderWidth: 2, borderColor: C.green,
  },
  clubBadgeText: { color: C.textPrimary, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  clubInfo: { flex: 1 },
  clubName: { color: C.textPrimary, fontSize: 16, fontWeight: '700' },
  clubMeta: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  clubStat: { alignItems: 'flex-end' },
  clubStatNum: { color: C.gold, fontSize: 20, fontWeight: '900' },
  clubStatLabel: { color: C.textMuted, fontSize: 11 },
  seasonCard: {
    backgroundColor: C.bgCard, borderRadius: 12, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: C.border,
  },
  seasonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seasonTitle: { color: C.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  seasonRound: { color: C.textMuted, fontSize: 12 },
  progressBar: { height: 4, backgroundColor: C.border, borderRadius: 2, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.green, borderRadius: 2 },
  playBtn: {
    backgroundColor: C.green, borderRadius: 14, padding: 18, marginBottom: 20,
    minHeight: 64, justifyContent: 'center',
  },
  playBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  playBtnIcon: { fontSize: 22, color: C.bg },
  playBtnLabel: { color: C.bg, fontSize: 17, fontWeight: '800' },
  playBtnSub: { color: C.bg, fontSize: 12, opacity: 0.7, marginTop: 2 },
  sectionLabel: {
    color: C.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 10, marginTop: 8,
  },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  menuCard: {
    width: '47.5%', backgroundColor: C.bgCard, borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: C.border,
  },
  menuIcon: { fontSize: 24, marginBottom: 8 },
  menuTitle: { color: C.textPrimary, fontSize: 15, fontWeight: '700' },
  menuSub: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  card: { backgroundColor: C.bgCard, borderRadius: 12, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: C.border },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12 },
  resultRowBorder: { borderTopWidth: 1, borderTopColor: C.border },
  resultTeam: { flex: 1, color: C.textMuted, fontSize: 13 },
  resultTeamRight: { textAlign: 'right' },
  resultWinner: { color: C.textPrimary, fontWeight: '700' },
  resultScoreWrap: { paddingHorizontal: 12, minWidth: 68, alignItems: 'center' },
  resultScore: { color: C.gold, fontSize: 15, fontWeight: '900' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: C.border },
  tableRowMine: { backgroundColor: `${C.green}18` },
  tablePos: { color: C.textMuted, fontSize: 13, width: 22, textAlign: 'center' },
  tableName: { flex: 1, color: C.textPrimary, fontSize: 13, paddingHorizontal: 8 },
  tableNameMine: { color: C.green, fontWeight: '700' },
  tablePts: { color: C.gold, fontSize: 13, fontWeight: '700', minWidth: 30, textAlign: 'right' },
  noCareerCard: {
    backgroundColor: C.bgCard, borderRadius: 14, padding: 20,
    borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  noCareerTitle: { color: C.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  noCareerSub: { color: C.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  doneCard: {
    backgroundColor: C.bgSurface, borderRadius: 14, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: C.greenDim, marginBottom: 20,
  },
  doneTitle: { color: C.gold, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  doneSub: { color: C.textPrimary, fontSize: 14 },
  errorText: { color: C.red, textAlign: 'center', fontSize: 14, marginVertical: 10 },
});
