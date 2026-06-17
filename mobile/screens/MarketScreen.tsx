import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Player, Position } from '../types/player';
import { fetchBudget, fetchAvailable, buyPlayer, sellPlayer } from '../services/marketService';
import { fetchSquad, formatValue } from '../services/squadService';
import { PlayerCard } from '../components/PlayerCard';
import { useAuthStore } from '../store/authStore';

type Tab = 'available' | 'squad';
const POSITIONS: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

export default function MarketScreen() {
  const token = useAuthStore((s) => s.token);
  const [tab, setTab] = useState<Tab>('available');
  const [posFilter, setPosFilter] = useState<Position | 'ALL'>('ALL');
  const [budget, setBudget] = useState<number | null>(null);
  const [available, setAvailable] = useState<Player[]>([]);
  const [squad, setSquad] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [budgetData, squadData] = await Promise.all([
        fetchBudget(),
        fetchSquad(),
      ]);
      setBudget(budgetData.budget);
      setSquad(squadData);

      const pos = posFilter === 'ALL' ? undefined : posFilter;
      const marketData = await fetchAvailable(pos, 50, 0);
      setAvailable(marketData.players);
    } catch {
      setError('Could not load market data. Are you logged in and is the API running?');
    } finally {
      setLoading(false);
    }
  }, [posFilter]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    loadData();
  }, [token, loadData]);

  const handleBuy = async (player: Player) => {
    setActionLoading(player.id);
    try {
      const result = await buyPlayer(player.id);
      setBudget(result.budget);
      setAvailable((prev) => prev.filter((p) => p.id !== player.id));
      setSquad((prev) => [...prev, { ...player }]);
    } catch (e: unknown) {
      const msg = extractMessage(e, 'Could not complete purchase.');
      Alert.alert('Transfer failed', msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSell = async (player: Player) => {
    setActionLoading(player.id);
    try {
      const result = await sellPlayer(player.id);
      setBudget(result.budget);
      setSquad((prev) => prev.filter((p) => p.id !== player.id));
      setAvailable((prev) => [player, ...prev]);
    } catch (e: unknown) {
      const msg = extractMessage(e, 'Could not complete sale.');
      Alert.alert('Transfer failed', msg);
    } finally {
      setActionLoading(null);
    }
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.header}>Transfer Market</Text>
          <Text style={styles.emptyText}>Log in to access the transfer market.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const filteredAvailable =
    posFilter === 'ALL' ? available : available.filter((p) => p.position === posFilter);

  const sortedSquad = [...squad].sort((a, b) => b.overall - a.overall);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <Text style={styles.header}>Transfer Market</Text>
        {budget !== null && (
          <Text style={styles.budget}>
            Budget: <Text style={styles.budgetValue}>{formatValue(budget)}</Text>
          </Text>
        )}

        {/* Tab toggle */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'available' && styles.tabBtnActive]}
            onPress={() => setTab('available')}
          >
            <Text style={[styles.tabBtnText, tab === 'available' && styles.tabBtnTextActive]}>
              Available ({available.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'squad' && styles.tabBtnActive]}
            onPress={() => setTab('squad')}
          >
            <Text style={[styles.tabBtnText, tab === 'squad' && styles.tabBtnTextActive]}>
              My Squad ({squad.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Position filter (available tab only) */}
        {tab === 'available' && (
          <View style={styles.posRow}>
            {(['ALL', ...POSITIONS] as const).map((pos) => (
              <TouchableOpacity
                key={pos}
                style={[styles.posBtn, posFilter === pos && styles.posBtnActive]}
                onPress={() => setPosFilter(pos)}
              >
                <Text style={[styles.posBtnText, posFilter === pos && styles.posBtnTextActive]}>
                  {pos}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Content */}
        {loading && <ActivityIndicator color="#e2b96f" style={{ marginTop: 40 }} />}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {!loading && !error && tab === 'available' && (
          <FlatList
            data={filteredAvailable}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={styles.cardWrap}>
                  <PlayerCard player={item} />
                </View>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    styles.buyBtn,
                    (budget !== null && budget < item.value) && styles.actionBtnDisabled,
                    actionLoading === item.id && styles.actionBtnDisabled,
                  ]}
                  onPress={() => handleBuy(item)}
                  disabled={
                    actionLoading !== null ||
                    (budget !== null && budget < item.value)
                  }
                >
                  {actionLoading === item.id ? (
                    <ActivityIndicator size="small" color="#1a1a2e" />
                  ) : (
                    <Text style={styles.actionBtnText}>Buy</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No players available{posFilter !== 'ALL' ? ` (${posFilter})` : ''}.</Text>
            }
          />
        )}

        {!loading && !error && tab === 'squad' && (
          <FlatList
            data={sortedSquad}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={styles.cardWrap}>
                  <PlayerCard player={item} />
                </View>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    styles.sellBtn,
                    actionLoading === item.id && styles.actionBtnDisabled,
                  ]}
                  onPress={() => handleSell(item)}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === item.id ? (
                    <ActivityIndicator size="small" color="#f1f5f9" />
                  ) : (
                    <Text style={[styles.actionBtnText, styles.sellBtnText]}>Sell</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No players in your squad.</Text>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function extractMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const resp = (err as { response?: { data?: { message?: string } } }).response;
    if (resp?.data?.message) return resp.data.message;
  }
  return fallback;
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
  budget: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2,
    marginBottom: 14,
  },
  budgetValue: {
    color: '#e2b96f',
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#16213e',
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#0f3460',
    borderWidth: 1,
    borderColor: '#e2b96f',
  },
  tabBtnText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: '#e2b96f',
  },
  posRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  posBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#16213e',
    alignItems: 'center',
  },
  posBtnActive: {
    backgroundColor: '#e2b96f',
  },
  posBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  posBtnTextActive: {
    color: '#1a1a2e',
  },
  list: {
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  cardWrap: {
    flex: 1,
  },
  actionBtn: {
    width: 56,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyBtn: {
    backgroundColor: '#10b981',
  },
  sellBtn: {
    backgroundColor: '#ef4444',
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  sellBtnText: {
    color: '#fff',
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
});
