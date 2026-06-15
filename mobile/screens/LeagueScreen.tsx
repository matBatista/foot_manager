import React, { useState, useCallback } from 'react';
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
  createLeague,
  getLeagueTable,
  advanceLeague,
  simToEnd,
} from '../services/leagueService';

const COUNTRIES = [
  { label: 'All Teams', value: '' },
  { label: 'Brazil', value: 'BR' },
  { label: 'England', value: 'EN' },
];

export default function LeagueScreen() {
  const [league, setLeague] = useState<LeagueSummary | null>(null);
  const [table, setTable] = useState<TableRow[]>([]);
  const [lastResults, setLastResults] = useState<ResultRow[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError('Could not start season. Is the API running?');
    } finally {
      setLoading(false);
    }
  }

  const onAdvance = useCallback(async (toEnd: boolean) => {
    if (!league) return;
    setLoading(true);
    setError(null);
    try {
      const res = toEnd
        ? await simToEnd(league.id)
        : await advanceLeague(league.id);
      setLeague(res.league);
      setTable(res.table);
      setLastResults(res.results);
    } catch {
      setError('Failed to advance season.');
    } finally {
      setLoading(false);
    }
  }, [league]);

  if (!league) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.header}>New Season</Text>
          <Text style={styles.sectionLabel}>Choose league</Text>
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
              : <Text style={styles.btnText}>Start Season</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const roundLabel = league.done
    ? 'Season complete'
    : `Round ${league.next_round - 1 > 0 ? league.next_round - 1 : '—'} / ${league.total_rounds}`;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.seasonHeader}>
          <View>
            <Text style={styles.header}>
              {league.country ? league.country : 'League'}
            </Text>
            <Text style={styles.subheader}>{roundLabel}</Text>
          </View>
          <TouchableOpacity style={styles.resetBtn} onPress={() => setLeague(null)}>
            <Text style={styles.resetBtnText}>New</Text>
          </TouchableOpacity>
        </View>

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
                : <Text style={styles.btnText}>Play Round</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnHalf, styles.btnOutline, loading && styles.btnDisabled]}
              onPress={() => onAdvance(true)}
              disabled={loading}
            >
              <Text style={[styles.btnText, styles.btnOutlineText]}>Sim Season</Text>
            </TouchableOpacity>
          </View>
        )}

        {league.done && (
          <View style={styles.doneCard}>
            <Text style={styles.doneText}>Season finished!</Text>
            <Text style={styles.doneSubtext}>
              {table[0]?.name} wins the title
            </Text>
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Last round results */}
        {lastResults.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>
              Round {lastResults[0]?.round} Results
            </Text>
            <View style={styles.card}>
              {lastResults.map((r, i) => (
                <MatchResultRow key={i} result={r} />
              ))}
            </View>
          </>
        )}

        {/* Standings table */}
        <Text style={styles.sectionLabel}>Standings</Text>
        <View style={styles.card}>
          <StandingsHeader />
          {table.map((row) => (
            <StandingRow key={row.team_id} row={row} />
          ))}
          {table.length === 0 && (
            <Text style={styles.muted}>No results yet.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StandingsHeader() {
  return (
    <View style={[styles.tableRow, styles.tableHeaderRow]}>
      <Text style={[styles.colPos, styles.colHeader]}>#</Text>
      <Text style={[styles.colName, styles.colHeader]}>Team</Text>
      <Text style={[styles.colStat, styles.colHeader]}>P</Text>
      <Text style={[styles.colStat, styles.colHeader]}>W</Text>
      <Text style={[styles.colStat, styles.colHeader]}>D</Text>
      <Text style={[styles.colStat, styles.colHeader]}>L</Text>
      <Text style={[styles.colStat, styles.colHeader]}>GD</Text>
      <Text style={[styles.colPts, styles.colHeader]}>Pts</Text>
    </View>
  );
}

function StandingRow({ row }: { row: TableRow }) {
  const isTop = row.position <= 4;
  const isBottom = false; // expand later with relegation zone logic
  return (
    <View style={[styles.tableRow, isTop && styles.tableRowTop, isBottom && styles.tableRowBottom]}>
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
  safe: { flex: 1, backgroundColor: '#1a1a2e' },
  container: { padding: 16, paddingBottom: 48 },

  header: { color: '#f1f5f9', fontSize: 26, fontWeight: 'bold' },
  subheader: { color: '#94a3b8', fontSize: 13, marginTop: 2 },

  seasonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },

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

  doneCard: {
    backgroundColor: '#0f3460',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  doneText: { color: '#e2b96f', fontSize: 18, fontWeight: 'bold' },
  doneSubtext: { color: '#f1f5f9', fontSize: 14, marginTop: 4 },

  errorText: { color: '#ef4444', textAlign: 'center', marginVertical: 12, fontSize: 14 },
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
  tableRowBottom: { borderLeftWidth: 3, borderLeftColor: '#ef4444' },

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
});
