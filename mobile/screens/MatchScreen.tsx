import React, { useEffect, useState } from 'react';
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
  Team,
  MatchResult,
  MatchEvent,
  fetchTeams,
  simulateMatch,
} from '../services/matchService';

export default function MatchScreen() {
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
      .catch(() => setError('Could not load teams. Is the API running?'));
  }, []);

  const teamName = (id: string | null) =>
    teams.find((t) => t.id === id)?.short_name ?? '—';

  async function onSimulate() {
    if (!homeId || !awayId) return;
    if (homeId === awayId) {
      setError('Pick two different teams.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const r = await simulateMatch(homeId, awayId);
      setResult(r);
    } catch {
      setError('Simulation failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>Match Day</Text>

        <Text style={styles.label}>Home</Text>
        <TeamPicker teams={teams} selected={homeId} onSelect={setHomeId} />

        <Text style={styles.label}>Away</Text>
        <TeamPicker teams={teams} selected={awayId} onSelect={setAwayId} />

        <TouchableOpacity
          style={[styles.simBtn, (!homeId || !awayId || loading) && styles.simBtnDisabled]}
          onPress={onSimulate}
          disabled={!homeId || !awayId || loading}
        >
          <Text style={styles.simBtnText}>
            {loading ? 'Simulating…' : 'Simulate Match'}
          </Text>
        </TouchableOpacity>

        {error && <Text style={styles.errorText}>{error}</Text>}
        {loading && <ActivityIndicator color="#e2b96f" style={{ marginTop: 24 }} />}

        {result && !loading && (
          <View style={styles.resultBlock}>
            {/* Scoreline */}
            <View style={styles.scoreRow}>
              <Text style={styles.scoreTeam}>{teamName(homeId)}</Text>
              <Text style={styles.score}>
                {result.home.goals} - {result.away.goals}
              </Text>
              <Text style={styles.scoreTeam}>{teamName(awayId)}</Text>
            </View>

            {/* Stats comparison */}
            <Text style={styles.sectionLabel}>Estatísticas</Text>
            <View style={styles.statsBlock}>
              <StatBar label="Posse" homeVal={result.home.possession} awayVal={result.away.possession} format={(v) => `${v}%`} />
              <StatBar label="xG" homeVal={result.home.xg} awayVal={result.away.xg} format={(v) => v.toFixed(2)} />
              <StatBar label="Chutes" homeVal={result.home.shots} awayVal={result.away.shots} />
              <StatBar label="No alvo" homeVal={result.home.shots_on_target} awayVal={result.away.shots_on_target} />
              <StatBar label="Passes" homeVal={result.home.passes} awayVal={result.away.passes} />
              <StatBar label="% Passes" homeVal={result.home.pass_accuracy} awayVal={result.away.pass_accuracy} format={(v) => `${v}%`} />
              <StatBar label="Escanteios" homeVal={result.home.corners} awayVal={result.away.corners} />
              <StatBar label="Faltas" homeVal={result.home.fouls} awayVal={result.away.fouls} />
              <StatBar label="Amarelos" homeVal={result.home.yellow_cards} awayVal={result.away.yellow_cards} />
            </View>

            {/* Timeline */}
            <Text style={styles.timelineHeader}>Timeline</Text>
            {result.events.length === 0 && (
              <Text style={styles.muted}>No notable events.</Text>
            )}
            {result.events.map((e, i) => (
              <EventRow key={i} event={e} homeId={homeId} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TeamPicker({
  teams,
  selected,
  onSelect,
}: {
  teams: Team[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.pickerRow}>
      {teams.map((t) => (
        <TouchableOpacity
          key={t.id}
          style={[styles.chip, selected === t.id && styles.chipActive]}
          onPress={() => onSelect(t.id)}
        >
          <Text style={[styles.chipText, selected === t.id && styles.chipTextActive]}>
            {t.short_name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// StatBar renders a symmetric two-team comparison row with a visual proportional bar.
export function StatBar({
  label,
  homeVal,
  awayVal,
  format,
}: {
  label: string;
  homeVal: number;
  awayVal: number;
  format?: (v: number) => string;
}) {
  const total = homeVal + awayVal;
  const homeFlex = total > 0 ? homeVal / total : 0.5;
  const awayFlex = total > 0 ? awayVal / total : 0.5;
  const fmt = format ?? ((v: number) => String(v));

  return (
    <View style={styles.statBarRow}>
      <Text style={styles.statBarValue}>{fmt(homeVal)}</Text>
      <View style={styles.statBarCenter}>
        <Text style={styles.statBarLabel}>{label}</Text>
        <View style={styles.statBarTrack}>
          <View style={[styles.statBarHome, { flex: homeFlex }]} />
          <View style={[styles.statBarAway, { flex: awayFlex }]} />
        </View>
      </View>
      <Text style={[styles.statBarValue, styles.statBarValueRight]}>{fmt(awayVal)}</Text>
    </View>
  );
}

function EventRow({ event, homeId }: { event: MatchEvent; homeId: string | null }) {
  const isHome = event.team_id === homeId;
  const icon =
    event.type === 'goal'
      ? '⚽'
      : event.type === 'yellow_card'
        ? '🟨'
        : event.type === 'red_card'
          ? '🟥'
          : '•';
  return (
    <View style={[styles.eventRow, isHome ? styles.eventLeft : styles.eventRight]}>
      <Text style={styles.eventText}>
        {isHome
          ? `${event.minute}' ${icon} ${event.player}`
          : `${event.player} ${icon} ${event.minute}'`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1a1a2e' },
  container: { padding: 16, paddingBottom: 48 },
  header: { color: '#f1f5f9', fontSize: 26, fontWeight: 'bold', marginBottom: 16 },
  label: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#16213e',
  },
  chipActive: { backgroundColor: '#e2b96f' },
  chipText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#1a1a2e' },
  simBtn: {
    marginTop: 24,
    backgroundColor: '#0f3460',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  simBtnDisabled: { opacity: 0.5 },
  simBtnText: { color: '#f1f5f9', fontSize: 16, fontWeight: 'bold' },
  errorText: { color: '#ef4444', textAlign: 'center', marginTop: 16, fontSize: 14 },
  resultBlock: { marginTop: 28 },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 20,
  },
  scoreTeam: { color: '#f1f5f9', fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  score: { color: '#e2b96f', fontSize: 30, fontWeight: 'bold', flex: 1, textAlign: 'center' },

  sectionLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
  },
  statsBlock: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },

  statBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  statBarValue: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
    width: 48,
    textAlign: 'left',
  },
  statBarValueRight: { textAlign: 'right' },
  statBarCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  statBarLabel: { color: '#64748b', fontSize: 11, marginBottom: 4 },
  statBarTrack: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  statBarHome: { backgroundColor: '#e2b96f', borderRadius: 3 },
  statBarAway: { backgroundColor: '#0f3460', borderRadius: 3 },

  timelineHeader: { color: '#f1f5f9', fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 12 },
  muted: { color: '#64748b', fontSize: 14 },
  eventRow: { marginVertical: 4, maxWidth: '75%' },
  eventLeft: { alignSelf: 'flex-start' },
  eventRight: { alignSelf: 'flex-end' },
  eventText: { color: '#cbd5e1', fontSize: 14 },
});
