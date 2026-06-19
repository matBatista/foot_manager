import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMatchResultStore } from '../store/matchStore';
import { useTeamStore } from '../store/teamStore';
import {
  Team, MatchResult, MatchEvent, fetchTeams, simulateMatch,
} from '../services/matchService';
import { ResultRow } from '../services/leagueService';
import MatchDetailsModal from '../components/MatchDetailsModal';
import { C } from '../constants/theme';

export default function MatchScreen() {
  const router = useRouter();
  const { roundResults, managerTeamId, roundNumber, clear } = useMatchResultStore();

  if (roundResults.length > 0) {
    return (
      <CareerRoundView
        results={roundResults}
        managerTeamId={managerTeamId}
        roundNumber={roundNumber}
        onBack={() => { clear(); router.back(); }}
      />
    );
  }

  return <StandaloneMatchView />;
}

// ---- Career Round View ----

function CareerRoundView({
  results, managerTeamId, roundNumber, onBack,
}: {
  results: ResultRow[];
  managerTeamId: string | null;
  roundNumber: number;
  onBack: () => void;
}) {
  const myMatch = results.find(
    (r) => r.home_team_id === managerTeamId || r.away_team_id === managerTeamId,
  );
  const [selectedResult, setSelectedResult] = useState<ResultRow | null>(null);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.roundBadge}>Rodada {roundNumber}</Text>

        {myMatch && (
          <>
            <Text style={styles.sectionLabel}>SUA PARTIDA</Text>
            <MainMatchCard match={myMatch} managerTeamId={managerTeamId} />
            {(myMatch.home_stats || myMatch.away_stats) && (
              <StatsBlock
                home={myMatch.home_stats!}
                away={myMatch.away_stats!}
                homeLabel={myMatch.home_name}
                awayLabel={myMatch.away_name}
              />
            )}
          </>
        )}

        <Text style={styles.sectionLabel}>TODOS OS RESULTADOS</Text>
        <View style={styles.card}>
          {results.map((r, i) => (
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
              <View style={styles.scoreWrap}>
                <Text style={styles.resultScore}>{r.home_goals} – {r.away_goals}</Text>
                {(r.home_stats || r.away_stats) && <Text style={styles.statsHint}>stats</Text>}
              </View>
              <Text
                style={[styles.resultTeam, styles.resultRight, r.away_goals > r.home_goals && styles.resultWinner]}
                numberOfLines={1}
              >
                {r.away_name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Voltar ao Hub</Text>
        </TouchableOpacity>
      </ScrollView>

      <MatchDetailsModal
        visible={selectedResult !== null}
        result={selectedResult}
        onClose={() => setSelectedResult(null)}
      />
    </SafeAreaView>
  );
}

function MainMatchCard({
  match, managerTeamId,
}: {
  match: ResultRow;
  managerTeamId: string | null;
}) {
  const isHome = match.home_team_id === managerTeamId;
  const myGoals = isHome ? match.home_goals : match.away_goals;
  const oppGoals = isHome ? match.away_goals : match.home_goals;
  const myName = isHome ? match.home_name : match.away_name;
  const oppName = isHome ? match.away_name : match.home_name;

  const result = myGoals > oppGoals ? 'V' : myGoals < oppGoals ? 'D' : 'E';
  const resultColor = result === 'V' ? C.green : result === 'D' ? C.red : C.gold;

  return (
    <View style={styles.mainMatchCard}>
      <FootballField homeTeam={myName} awayTeam={oppName} />
      <View style={styles.scoreCard}>
        <Text style={styles.scoreTeamHome} numberOfLines={1}>{myName}</Text>
        <View style={styles.scoreCenterCol}>
          <Text style={styles.scoreBig}>{myGoals} – {oppGoals}</Text>
          <View style={[styles.resultTag, { backgroundColor: resultColor }]}>
            <Text style={styles.resultTagText}>{result === 'V' ? 'VITÓRIA' : result === 'D' ? 'DERROTA' : 'EMPATE'}</Text>
          </View>
        </View>
        <Text style={styles.scoreTeamAway} numberOfLines={1}>{oppName}</Text>
      </View>
    </View>
  );
}

function FootballField({ homeTeam, awayTeam }: { homeTeam: string; awayTeam: string }) {
  const rows442 = [
    ['FWD', 'FWD'],
    ['MID', 'MID', 'MID', 'MID'],
    ['DEF', 'DEF', 'DEF', 'DEF'],
    ['GK'],
  ];

  return (
    <View style={fieldStyles.field}>
      {/* Away section (top, inverted) */}
      <View style={fieldStyles.halfAway}>
        <Text style={fieldStyles.teamLabelAway}>{awayTeam}</Text>
        {rows442.map((row, i) => (
          <View key={`away-${i}`} style={fieldStyles.posRow}>
            {row.map((pos, j) => (
              <View key={j} style={[fieldStyles.dot, fieldStyles.dotAway]}>
                <Text style={[fieldStyles.dotText, fieldStyles.dotTextAway]}>{pos}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      {/* Center line */}
      <View style={fieldStyles.centerArea}>
        <View style={fieldStyles.centerLine} />
        <View style={fieldStyles.centerCircle} />
        <View style={fieldStyles.centerLine} />
      </View>

      {/* Home section (bottom) */}
      <View style={fieldStyles.halfHome}>
        {[...rows442].reverse().map((row, i) => (
          <View key={`home-${i}`} style={fieldStyles.posRow}>
            {row.map((pos, j) => (
              <View key={j} style={[fieldStyles.dot, fieldStyles.dotHome]}>
                <Text style={[fieldStyles.dotText, fieldStyles.dotTextHome]}>{pos}</Text>
              </View>
            ))}
          </View>
        ))}
        <Text style={fieldStyles.teamLabelHome}>{homeTeam}</Text>
      </View>
    </View>
  );
}

function StatsBlock({
  home, away, homeLabel, awayLabel,
}: {
  home: { possession: number; xg: number; shots: number; shots_on_target: number; passes: number; corners: number; fouls: number; yellow_cards: number };
  away: { possession: number; xg: number; shots: number; shots_on_target: number; passes: number; corners: number; fouls: number; yellow_cards: number };
  homeLabel: string;
  awayLabel: string;
}) {
  return (
    <View style={styles.statsBlock}>
      <Text style={styles.sectionLabel}>ESTATÍSTICAS</Text>
      <View style={styles.card}>
        <View style={styles.statsHeader}>
          <Text style={styles.statsTeamLabel} numberOfLines={1}>{homeLabel}</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.statsTeamLabel} numberOfLines={1}>{awayLabel}</Text>
        </View>
        <StatRow label="Posse" home={home.possession} away={away.possession} fmt={(v) => `${v}%`} />
        <StatRow label="xG" home={home.xg} away={away.xg} fmt={(v) => v.toFixed(2)} />
        <StatRow label="Chutes" home={home.shots} away={away.shots} />
        <StatRow label="No gol" home={home.shots_on_target} away={away.shots_on_target} />
        <StatRow label="Passes" home={home.passes} away={away.passes} />
        <StatRow label="Escanteios" home={home.corners} away={away.corners} />
        <StatRow label="Faltas" home={home.fouls} away={away.fouls} />
        <StatRow label="Amarelos" home={home.yellow_cards} away={away.yellow_cards} />
      </View>
    </View>
  );
}

function StatRow({
  label, home, away, fmt,
}: {
  label: string; home: number; away: number; fmt?: (v: number) => string;
}) {
  const total = home + away;
  const homeFlex = total > 0 ? home / total : 0.5;
  const awayFlex = total > 0 ? away / total : 0.5;
  const f = fmt ?? ((v: number) => String(v));
  return (
    <View style={styles.statRow}>
      <Text style={styles.statVal}>{f(home)}</Text>
      <View style={styles.statCenter}>
        <Text style={styles.statLabel}>{label}</Text>
        <View style={styles.statTrack}>
          <View style={[styles.statHome, { flex: homeFlex }]} />
          <View style={[styles.statAway, { flex: awayFlex }]} />
        </View>
      </View>
      <Text style={[styles.statVal, styles.statValRight]}>{f(away)}</Text>
    </View>
  );
}

// ---- Standalone Match View ----

function StandaloneMatchView() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [homeId, setHomeId] = useState<string | null>(null);
  const [awayId, setAwayId] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams()
      .then((t) => {
        setTeams(t);
        if (t[0]) setHomeId(t[0].id);
        if (t[1]) setAwayId(t[1].id);
      })
      .catch(() => setError('Não foi possível carregar os times. A API está rodando?'));
  }, []);

  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.short_name ?? '—';

  async function onSimulate() {
    if (!homeId || !awayId || homeId === awayId) return;
    setError(null);
    setLoading(true);
    try {
      setResult(await simulateMatch(homeId, awayId));
    } catch {
      setError('Simulação falhou. A API está rodando?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.standaloneTitle}>Simular Partida</Text>

        <Text style={styles.pickerLabel}>Time da Casa</Text>
        <TeamPicker teams={teams} selected={homeId} onSelect={setHomeId} />

        <Text style={styles.pickerLabel}>Time Visitante</Text>
        <TeamPicker teams={teams} selected={awayId} onSelect={setAwayId} />

        <TouchableOpacity
          style={[styles.simBtn, (!homeId || !awayId || loading) && styles.simBtnDisabled]}
          onPress={onSimulate}
          disabled={!homeId || !awayId || loading}
        >
          <Text style={styles.simBtnText}>{loading ? 'Simulando…' : '▶  Simular'}</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {loading && <ActivityIndicator color={C.green} style={{ marginTop: 24 }} />}

        {result && !loading && (
          <>
            <FootballField homeTeam={teamName(homeId)} awayTeam={teamName(awayId)} />
            <View style={styles.standaloneScoreCard}>
              <Text style={styles.standaloneScoreTeam}>{teamName(homeId)}</Text>
              <Text style={styles.standaloneScore}>{result.home.goals} – {result.away.goals}</Text>
              <Text style={styles.standaloneScoreTeam}>{teamName(awayId)}</Text>
            </View>

            <StatsBlock
              home={result.home}
              away={result.away}
              homeLabel={teamName(homeId)}
              awayLabel={teamName(awayId)}
            />

            <Text style={styles.sectionLabel}>EVENTOS</Text>
            <View style={styles.card}>
              {result.events.length === 0 && (
                <Text style={styles.mutedText}>Nenhum evento notável.</Text>
              )}
              {result.events.map((e, i) => (
                <EventRow key={i} event={e} homeId={homeId} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TeamPicker({ teams, selected, onSelect }: { teams: Team[]; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <View style={styles.pickerRow}>
      {teams.map((t) => (
        <TouchableOpacity
          key={t.id}
          style={[styles.chip, selected === t.id && styles.chipActive]}
          onPress={() => onSelect(t.id)}
        >
          <Text style={[styles.chipText, selected === t.id && styles.chipTextActive]}>{t.short_name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function EventRow({ event, homeId }: { event: MatchEvent; homeId: string | null }) {
  const isHome = event.team_id === homeId;
  const icon = event.type === 'goal' ? '⚽' : event.type === 'yellow_card' ? '🟨' : event.type === 'red_card' ? '🟥' : '•';
  return (
    <View style={[styles.eventRow, isHome ? styles.eventLeft : styles.eventRight]}>
      <Text style={styles.eventText}>
        {isHome ? `${event.minute}' ${icon} ${event.player}` : `${event.player} ${icon} ${event.minute}'`}
      </Text>
    </View>
  );
}

// ---- Styles ----

const fieldStyles = StyleSheet.create({
  field: {
    backgroundColor: C.fieldGreen,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.fieldLine,
  },
  halfAway: { paddingHorizontal: 12, paddingBottom: 4, alignItems: 'center' },
  halfHome: { paddingHorizontal: 12, paddingTop: 4, alignItems: 'center' },
  teamLabelAway: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  teamLabelHome: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 6 },
  posRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 3 },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dotHome: { backgroundColor: 'rgba(34,197,94,0.85)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  dotAway: { backgroundColor: 'rgba(239,68,68,0.75)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
  dotText: { fontSize: 7, fontWeight: '800', letterSpacing: -0.3 },
  dotTextHome: { color: '#fff' },
  dotTextAway: { color: '#fff' },
  centerArea: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 6, paddingHorizontal: 12,
  },
  centerLine: { flex: 1, height: 1, backgroundColor: C.fieldLine },
  centerCircle: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: C.fieldLine,
    marginHorizontal: 12,
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { padding: 16, paddingBottom: 48 },
  roundBadge: {
    color: C.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1.5,
    textTransform: 'uppercase', marginBottom: 16,
  },
  sectionLabel: {
    color: C.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 10, marginTop: 8,
  },
  mainMatchCard: { marginBottom: 12 },
  scoreCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard,
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.border,
  },
  scoreTeamHome: { flex: 1, color: C.textPrimary, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  scoreTeamAway: { flex: 1, color: C.textPrimary, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  scoreCenterCol: { alignItems: 'center', paddingHorizontal: 12 },
  scoreBig: { color: C.gold, fontSize: 28, fontWeight: '900' },
  resultTag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  resultTagText: { color: '#000', fontSize: 10, fontWeight: '800' },
  card: { backgroundColor: C.bgCard, borderRadius: 12, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: C.border },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12 },
  resultRowBorder: { borderTopWidth: 1, borderTopColor: C.border },
  resultTeam: { flex: 1, color: C.textMuted, fontSize: 13 },
  resultRight: { textAlign: 'right' },
  resultWinner: { color: C.textPrimary, fontWeight: '700' },
  scoreWrap: { paddingHorizontal: 12, minWidth: 68, alignItems: 'center' },
  resultScore: { color: C.gold, fontSize: 15, fontWeight: '900' },
  statsHint: { color: C.textMuted, fontSize: 10, marginTop: 2 },
  statsBlock: { marginBottom: 12 },
  statsHeader: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  statsTeamLabel: { flex: 1, color: C.textSecondary, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  statRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: C.border,
  },
  statVal: { color: C.textPrimary, fontSize: 14, fontWeight: '600', width: 48, textAlign: 'left' },
  statValRight: { textAlign: 'right' },
  statCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  statLabel: { color: C.textMuted, fontSize: 11, marginBottom: 4 },
  statTrack: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', width: '100%' },
  statHome: { backgroundColor: C.green },
  statAway: { backgroundColor: C.red },
  backBtn: { marginTop: 8, alignItems: 'center', padding: 16 },
  backBtnText: { color: C.textMuted, fontSize: 15 },
  standaloneTitle: { color: C.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  pickerLabel: { color: C.textMuted, fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: C.green, borderColor: C.green },
  chipText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: C.bg },
  simBtn: { marginTop: 20, backgroundColor: C.green, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  simBtnDisabled: { opacity: 0.5 },
  simBtnText: { color: C.bg, fontSize: 16, fontWeight: '800' },
  standaloneScoreCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard,
    borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: C.border,
  },
  standaloneScoreTeam: { flex: 1, color: C.textPrimary, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  standaloneScore: { color: C.gold, fontSize: 28, fontWeight: '900', paddingHorizontal: 12 },
  eventRow: { marginVertical: 4, maxWidth: '75%', paddingHorizontal: 12, paddingVertical: 4 },
  eventLeft: { alignSelf: 'flex-start' },
  eventRight: { alignSelf: 'flex-end' },
  eventText: { color: C.textSecondary, fontSize: 14 },
  errorText: { color: C.red, textAlign: 'center', marginTop: 16, fontSize: 14 },
  mutedText: { color: C.textMuted, fontSize: 14, padding: 16, textAlign: 'center' },
});
