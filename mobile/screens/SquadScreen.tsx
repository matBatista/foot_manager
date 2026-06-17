import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Player, Position } from '../types/player';
import { fetchSquad } from '../services/squadService';
import { PlayerCard } from '../components/PlayerCard';
import { useTeamStore } from '../store/teamStore';
import { useAuthStore } from '../store/authStore';

const POSITIONS: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

export default function SquadScreen() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [filter, setFilter] = useState<Position | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectedTeam = useTeamStore((s) => s.selectedTeam);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    // When authenticated the server resolves team from JWT; otherwise pass team_id.
    const teamId = token ? undefined : selectedTeam?.id;
    fetchSquad(teamId)
      .then(setPlayers)
      .catch(() => setError('Could not load squad. Is the API running?'))
      .finally(() => setLoading(false));
  }, [token, selectedTeam?.id]);

  const filtered = filter === 'ALL'
    ? players
    : players.filter((p) => p.position === filter);

  const positionOrder: Record<Position, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
  const sorted = [...filtered].sort(
    (a, b) => positionOrder[a.position] - positionOrder[b.position]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <Text style={styles.header}>My Squad</Text>
        <Text style={styles.count}>{players.length} players</Text>

        {/* Position filter tabs */}
        <View style={styles.tabs}>
          {(['ALL', ...POSITIONS] as const).map((pos) => (
            <TouchableOpacity
              key={pos}
              style={[styles.tab, filter === pos && styles.tabActive]}
              onPress={() => setFilter(pos)}
            >
              <Text style={[styles.tabText, filter === pos && styles.tabTextActive]}>
                {pos}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        {loading && <ActivityIndicator color="#e2b96f" style={{ marginTop: 40 }} />}
        {error && <Text style={styles.errorText}>{error}</Text>}
        {!loading && !error && (
          <FlatList
            data={sorted}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PlayerCard
                player={item}
                onPress={(p) => console.log('Selected player:', p.name)}
              />
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
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
  count: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 2,
    marginBottom: 16,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#16213e',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#e2b96f',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#1a1a2e',
  },
  list: {
    paddingBottom: 32,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
});
