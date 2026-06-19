import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { MatchStats, ResultRow } from '../services/leagueService';
import { C } from '../constants/theme';

interface Props {
  visible: boolean;
  result: ResultRow | null;
  onClose: () => void;
}

export default function MatchDetailsModal({ visible, result, onClose }: Props) {
  if (!result) return null;

  const homeWin = result.home_goals > result.away_goals;
  const awayWin = result.away_goals > result.home_goals;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.roundLabel}>Rodada {result.round}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Scoreline */}
          <View style={styles.scoreCard}>
            <Text style={[styles.teamName, homeWin && styles.winner]} numberOfLines={1}>
              {result.home_name}
            </Text>
            <Text style={styles.score}>
              {result.home_goals} – {result.away_goals}
            </Text>
            <Text style={[styles.teamName, styles.teamNameRight, awayWin && styles.winner]} numberOfLines={1}>
              {result.away_name}
            </Text>
          </View>

          {!result.home_stats && (
            <Text style={styles.noStats}>Estatísticas não disponíveis para este jogo.</Text>
          )}

          {result.home_stats && result.away_stats && (
            <ScrollView style={styles.statsScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.statsHeader}>Estatísticas</Text>
              <StatBar label="Posse" home={result.home_stats.possession} away={result.away_stats.possession} format={(v) => `${v}%`} />
              <StatBar label="xG" home={result.home_stats.xg} away={result.away_stats.xg} format={(v) => v.toFixed(2)} />
              <StatBar label="Chutes" home={result.home_stats.shots} away={result.away_stats.shots} />
              <StatBar label="No gol" home={result.home_stats.shots_on_target} away={result.away_stats.shots_on_target} />
              <StatBar label="Passes" home={result.home_stats.passes} away={result.away_stats.passes} />
              <StatBar label="Passe %" home={result.home_stats.pass_accuracy} away={result.away_stats.pass_accuracy} format={(v) => `${v}%`} />
              <StatBar label="Escanteios" home={result.home_stats.corners} away={result.away_stats.corners} />
              <StatBar label="Faltas" home={result.home_stats.fouls} away={result.away_stats.fouls} />
              <StatBar label="Amarelos" home={result.home_stats.yellow_cards} away={result.away_stats.yellow_cards} />
              <StatBar label="Vermelhos" home={result.home_stats.red_cards} away={result.away_stats.red_cards} />
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function StatBar({
  label,
  home,
  away,
  format = (v: number) => String(v),
}: {
  label: string;
  home: number;
  away: number;
  format?: (v: number) => string;
}) {
  const total = home + away;
  const homeFlex = total === 0 ? 1 : home;
  const awayFlex = total === 0 ? 1 : away;

  return (
    <View style={styles.statRow}>
      <Text style={styles.statValue}>{format(home)}</Text>
      <View style={styles.barContainer}>
        <View style={[styles.barHome, { flex: homeFlex }]} />
        <View style={[styles.barAway, { flex: awayFlex }]} />
      </View>
      <Text style={[styles.statValue, styles.statValueRight]}>{format(away)}</Text>
      <View style={styles.labelBox}>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: C.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: C.border,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: C.borderLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  roundLabel: { color: C.textMuted, fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  closeBtn: { color: C.textMuted, fontSize: 18, fontWeight: '600' },

  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgSurface,
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  teamName: { flex: 1, color: C.textMuted, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  teamNameRight: { textAlign: 'center' },
  winner: { color: C.textPrimary, fontWeight: '700' },
  score: { color: C.gold, fontSize: 28, fontWeight: 'bold', paddingHorizontal: 16, minWidth: 80, textAlign: 'center' },

  statsScroll: { paddingHorizontal: 16 },
  statsHeader: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  noStats: { color: C.textMuted, fontSize: 13, textAlign: 'center', marginTop: 24 },

  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    position: 'relative',
  },
  statValue: {
    width: 52,
    color: C.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'left',
  },
  statValueRight: { textAlign: 'right' },
  barContainer: {
    flex: 1,
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  barHome: { backgroundColor: C.green, minWidth: 2 },
  barAway: { backgroundColor: C.red, minWidth: 2 },
  labelBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  statLabel: {
    color: C.textMuted,
    fontSize: 11,
    textAlign: 'center',
    backgroundColor: C.bgCard,
    paddingHorizontal: 4,
  },
});
