import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Player } from '../types/player';
import { formatValue } from '../services/squadService';
import { C } from '../constants/theme';

const POSITION_COLORS: Record<string, string> = {
  GK: '#f59e0b',
  DEF: '#3b82f6',
  MID: '#10b981',
  FWD: '#ef4444',
};

const overallColor = (ovr: number) => {
  if (ovr >= 85) return '#f59e0b';
  if (ovr >= 78) return '#10b981';
  if (ovr >= 70) return '#3b82f6';
  return '#94a3b8';
};

interface Props {
  player: Player;
  onPress?: (player: Player) => void;
}

export function PlayerCard({ player, onPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(player)}
      activeOpacity={0.75}
    >
      {/* Overall badge */}
      <View style={[styles.overallBadge, { borderColor: overallColor(player.overall) }]}>
        <Text style={[styles.overallText, { color: overallColor(player.overall) }]}>
          {player.overall}
        </Text>
      </View>

      {/* Player info */}
      <View style={styles.info}>
        <Text style={styles.name}>{player.name}</Text>
        <View style={styles.meta}>
          <View style={[styles.positionBadge, { backgroundColor: POSITION_COLORS[player.position] }]}>
            <Text style={styles.positionText}>{player.position}</Text>
          </View>
          <Text style={styles.detail}>{player.nationality} · {player.age} yrs</Text>
        </View>
      </View>

      {/* Value */}
      <Text style={styles.value}>{formatValue(player.value)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgCard,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  overallBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  overallText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  info: {
    flex: 1,
  },
  name: {
    color: C.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  positionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  positionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  detail: {
    color: C.textMuted,
    fontSize: 12,
  },
  value: {
    color: C.gold,
    fontSize: 13,
    fontWeight: '600',
  },
});
