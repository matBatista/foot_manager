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
  Modal,
  ScrollView,
} from 'react-native';
import { Player, Position } from '../types/player';
import {
  fetchBudget,
  fetchAvailable,
  fetchWindowStatus,
  buyPlayer,
  sellPlayer,
  WindowStatus,
} from '../services/marketService';
import { fetchSquad, formatValue, formatWage } from '../services/squadService';
import { PlayerCard } from '../components/PlayerCard';
import { useAuthStore } from '../store/authStore';
import { C } from '../constants/theme';

type Tab = 'available' | 'squad';
const POSITIONS: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

// ─── Negotiate Modal ──────────────────────────────────────────────────────────
type NegStep = 'club' | 'salary' | 'done';

interface NegotiateModalProps {
  player: Player | null;
  budget: number | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: (player: Player) => void;
  loading: boolean;
}

function NegotiateModal({ player, budget, visible, onClose, onConfirm, loading }: NegotiateModalProps) {
  const [step, setStep] = useState<NegStep>('club');

  useEffect(() => {
    if (visible) setStep('club');
  }, [visible, player?.id]);

  if (!player) return null;

  const clubAsk = player.value;
  const weeklyWage = Math.max(1000, Math.round(player.overall * 800));
  const canAfford = budget === null || budget >= clubAsk;

  const stepLabel = step === 'club' ? '1 / 2 — Negociar com o clube' : '2 / 2 — Negociar salário';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={nm.overlay}>
        <View style={nm.sheet}>
          {/* Player header */}
          <View style={nm.playerRow}>
            <View style={nm.badge}>
              <Text style={nm.badgePos}>{player.position}</Text>
              <Text style={nm.badgeOvr}>{player.overall}</Text>
            </View>
            <View style={nm.playerInfo}>
              <Text style={nm.playerName}>{player.name}</Text>
              <Text style={nm.playerMeta}>{player.nationality} · {player.age} anos</Text>
            </View>
          </View>

          <Text style={nm.stepLabel}>{stepLabel}</Text>

          {step === 'club' && (
            <>
              <View style={nm.infoBox}>
                <Row label="Valor pedido pelo clube" value={formatValue(clubAsk)} highlight />
                <Row label="Seu orçamento disponível" value={formatValue(budget ?? 0)} />
              </View>
              {!canAfford && (
                <Text style={nm.warn}>⚠️ Orçamento insuficiente para esta transferência.</Text>
              )}
              <Text style={nm.hint}>
                Proposta padrão ao valor de mercado. O clube aceita imediatamente.
              </Text>
              <View style={nm.btnRow}>
                <TouchableOpacity style={nm.btnSecondary} onPress={onClose}>
                  <Text style={nm.btnSecondaryText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[nm.btnPrimary, !canAfford && nm.btnDisabled]}
                  onPress={() => setStep('salary')}
                  disabled={!canAfford}
                >
                  <Text style={nm.btnPrimaryText}>Fazer Oferta →</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === 'salary' && (
            <>
              <View style={nm.infoBox}>
                <Row label="Pretensão salarial do jogador" value={formatWage(player.value)} highlight />
                <Row label="Contrato proposto" value="3 anos" />
              </View>
              <Text style={nm.hint}>
                O jogador aceita o salário proporcional ao seu nível. Contrato de 3 anos.
              </Text>
              <View style={nm.btnRow}>
                <TouchableOpacity style={nm.btnSecondary} onPress={() => setStep('club')}>
                  <Text style={nm.btnSecondaryText}>← Voltar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[nm.btnPrimary, loading && nm.btnDisabled]}
                  onPress={() => onConfirm(player)}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator size="small" color={C.bg} />
                    : <Text style={nm.btnPrimaryText}>✅ Assinar Contrato</Text>
                  }
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={nm.row}>
      <Text style={nm.rowLabel}>{label}</Text>
      <Text style={[nm.rowValue, highlight && nm.rowValueHighlight]}>{value}</Text>
    </View>
  );
}

// ─── Window Banner ────────────────────────────────────────────────────────────
function WindowBanner({ status }: { status: WindowStatus | null }) {
  if (!status) return null;
  return (
    <View style={[wb.bar, status.open ? wb.open : wb.closed]}>
      <Text style={wb.icon}>{status.open ? '🟢' : '🔴'}</Text>
      <View style={wb.textCol}>
        <Text style={wb.label}>
          {status.open ? 'Janela Aberta' : 'Janela Fechada'}
        </Text>
        <Text style={wb.sub}>
          {status.open
            ? `Rodada ${status.current_round} · compras liberadas`
            : status.message}
        </Text>
      </View>
    </View>
  );
}

// ─── Main MarketScreen ────────────────────────────────────────────────────────
export default function MarketScreen() {
  const token = useAuthStore((s) => s.token);
  const [tab, setTab] = useState<Tab>('available');
  const [posFilter, setPosFilter] = useState<Position | 'ALL'>('ALL');
  const [budget, setBudget] = useState<number | null>(null);
  const [available, setAvailable] = useState<Player[]>([]);
  const [squad, setSquad] = useState<Player[]>([]);
  const [window, setWindow] = useState<WindowStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [negotiatePlayer, setNegotiatePlayer] = useState<Player | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [budgetData, squadData, winData] = await Promise.all([
        fetchBudget(),
        fetchSquad(),
        fetchWindowStatus().catch(() => null),
      ]);
      setBudget(budgetData.budget);
      setSquad(squadData.players);
      setWindow(winData);

      const pos = posFilter === 'ALL' ? undefined : posFilter;
      const marketData = await fetchAvailable(pos, 50, 0);
      setAvailable(marketData.players);
    } catch {
      setError('Não foi possível carregar o mercado. Você está logado e a API está rodando?');
    } finally {
      setLoading(false);
    }
  }, [posFilter]);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    loadData();
  }, [token, loadData]);

  const handleBuy = async (player: Player) => {
    setActionLoading(player.id);
    try {
      const result = await buyPlayer(player.id);
      setBudget(result.budget);
      setAvailable((prev) => prev.filter((p) => p.id !== player.id));
      setSquad((prev) => [...prev, { ...player }]);
      setNegotiatePlayer(null);
    } catch (e: unknown) {
      const msg = extractMessage(e, 'Não foi possível concluir a compra.');
      Alert.alert('Transferência falhou', msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSell = async (player: Player) => {
    Alert.alert(
      'Vender Jogador',
      `Tem certeza que quer vender ${player.name} por ${formatValue(Math.round(player.value * 0.8))}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Vender',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(player.id);
            try {
              const result = await sellPlayer(player.id);
              setBudget(result.budget);
              setSquad((prev) => prev.filter((p) => p.id !== player.id));
              setAvailable((prev) => [player, ...prev]);
            } catch (e: unknown) {
              const msg = extractMessage(e, 'Não foi possível concluir a venda.');
              Alert.alert('Venda falhou', msg);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.header}>Mercado</Text>
          <Text style={styles.emptyText}>Faça login para acessar o mercado de transferências.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const filteredAvailable = posFilter === 'ALL'
    ? available
    : available.filter((p) => p.position === posFilter);
  const sortedSquad = [...squad].sort((a, b) => b.overall - a.overall);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.header}>Mercado</Text>

        {budget !== null && (
          <Text style={styles.budget}>
            Orçamento: <Text style={styles.budgetValue}>{formatValue(budget)}</Text>
          </Text>
        )}

        <WindowBanner status={window} />

        {/* Tab toggle */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'available' && styles.tabBtnActive]}
            onPress={() => setTab('available')}
          >
            <Text style={[styles.tabBtnText, tab === 'available' && styles.tabBtnTextActive]}>
              Disponíveis ({available.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'squad' && styles.tabBtnActive]}
            onPress={() => setTab('squad')}
          >
            <Text style={[styles.tabBtnText, tab === 'squad' && styles.tabBtnTextActive]}>
              Meu Elenco ({squad.length})
            </Text>
          </TouchableOpacity>
        </View>

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

        {loading && <ActivityIndicator color={C.green} style={{ marginTop: 40 }} />}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {!loading && !error && tab === 'available' && (
          <FlatList
            data={filteredAvailable}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={styles.cardWrap}>
                  <PlayerCard player={item} />
                  <Text style={styles.wage}>{formatWage(item.value)}/semana</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.actionBtn, styles.buyBtn,
                    (!window?.open || (budget !== null && budget < item.value)) && styles.actionBtnDisabled,
                    actionLoading === item.id && styles.actionBtnDisabled,
                  ]}
                  onPress={() => {
                    if (!window?.open) {
                      Alert.alert('Janela Fechada', window?.message ?? 'A janela de transferências está fechada.');
                      return;
                    }
                    setNegotiatePlayer(item);
                  }}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === item.id
                    ? <ActivityIndicator size="small" color={C.bg} />
                    : <Text style={styles.actionBtnText}>Negociar</Text>
                  }
                </TouchableOpacity>
              </View>
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                Nenhum jogador disponível{posFilter !== 'ALL' ? ` (${posFilter})` : ''}.
              </Text>
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
                  <Text style={styles.wage}>{formatWage(item.value)}/semana</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.actionBtn, styles.sellBtn,
                    actionLoading === item.id && styles.actionBtnDisabled,
                  ]}
                  onPress={() => handleSell(item)}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === item.id
                    ? <ActivityIndicator size="small" color={C.textPrimary} />
                    : <Text style={[styles.actionBtnText, styles.sellBtnText]}>Vender</Text>
                  }
                </TouchableOpacity>
              </View>
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Nenhum jogador no seu elenco.</Text>
            }
          />
        )}
      </View>

      <NegotiateModal
        player={negotiatePlayer}
        budget={budget}
        visible={negotiatePlayer !== null}
        onClose={() => setNegotiatePlayer(null)}
        onConfirm={handleBuy}
        loading={actionLoading === negotiatePlayer?.id}
      />
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  header: { color: C.textPrimary, fontSize: 26, fontWeight: 'bold' },
  budget: { color: C.textMuted, fontSize: 13, marginTop: 2, marginBottom: 10 },
  budgetValue: { color: C.gold, fontWeight: '700' },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12, marginTop: 4 },
  tabBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 8,
    backgroundColor: C.bgCard, alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: C.bgSurface, borderWidth: 1, borderColor: C.green },
  tabBtnText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
  tabBtnTextActive: { color: C.green },
  posRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  posBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 8,
    backgroundColor: C.bgCard, alignItems: 'center',
  },
  posBtnActive: { backgroundColor: C.green },
  posBtnText: { color: C.textMuted, fontSize: 12, fontWeight: '600' },
  posBtnTextActive: { color: C.bg },
  list: { paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  cardWrap: { flex: 1 },
  wage: { color: C.textMuted, fontSize: 11, marginTop: 2, paddingLeft: 4 },
  actionBtn: {
    width: 72, paddingVertical: 10, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  buyBtn: { backgroundColor: C.green },
  sellBtn: { backgroundColor: C.red },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  sellBtnText: { color: '#fff' },
  errorText: { color: C.red, textAlign: 'center', marginTop: 40, fontSize: 14 },
  emptyText: { color: C.textMuted, textAlign: 'center', marginTop: 40, fontSize: 14 },
});

const wb = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 10, padding: 12, marginBottom: 12,
    borderWidth: 1,
  },
  open: { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: C.green },
  closed: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: C.red },
  icon: { fontSize: 20 },
  textCol: { flex: 1 },
  label: { color: C.textPrimary, fontSize: 13, fontWeight: '700' },
  sub: { color: C.textMuted, fontSize: 12, marginTop: 2 },
});

const nm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 32,
  },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  badge: {
    width: 52, height: 52, borderRadius: 10,
    backgroundColor: C.bgSurface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  badgePos: { color: C.textMuted, fontSize: 10, fontWeight: '700' },
  badgeOvr: { color: C.gold, fontSize: 20, fontWeight: '800' },
  playerInfo: { flex: 1 },
  playerName: { color: C.textPrimary, fontSize: 17, fontWeight: '700' },
  playerMeta: { color: C.textMuted, fontSize: 13, marginTop: 2 },
  stepLabel: { color: C.green, fontSize: 12, fontWeight: '700', marginBottom: 12 },
  infoBox: {
    backgroundColor: C.bgSurface, borderRadius: 10, padding: 14,
    gap: 10, marginBottom: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { color: C.textMuted, fontSize: 13 },
  rowValue: { color: C.textPrimary, fontSize: 14, fontWeight: '600' },
  rowValueHighlight: { color: C.gold, fontSize: 16, fontWeight: '800' },
  warn: { color: C.red, fontSize: 13, marginBottom: 10, textAlign: 'center' },
  hint: { color: C.textMuted, fontSize: 12, marginBottom: 16, lineHeight: 17 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btnPrimary: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    backgroundColor: C.green, alignItems: 'center',
  },
  btnPrimaryText: { color: C.bg, fontSize: 14, fontWeight: '700' },
  btnSecondary: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    backgroundColor: C.bgSurface, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  btnSecondaryText: { color: C.textMuted, fontSize: 14, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
});
