import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { Player, Position } from '../types/player';
import { fetchSquad, formatValue, formatWage } from '../services/squadService';
import { updateFormation } from '../services/careerService';
import { PlayerCard } from '../components/PlayerCard';
import { useTeamStore } from '../store/teamStore';
import { useAuthStore } from '../store/authStore';
import { useCareerStore } from '../store/careerStore';
import { C } from '../constants/theme';
import { getFormationPositions, ALLOWED_FORMATIONS, FieldPosition } from '../utils/formation';

const POSITIONS: Position[] = ['GK', 'DEF', 'MID', 'FWD'];
type ViewTab = 'campo' | 'lista';

const FIELD_W = 320;
const FIELD_H = 430;
const DOT_R = 17;

// Maps formation role → player position group
const ROLE_TO_POS: Record<string, Position> = {
  GK: 'GK', DEF: 'DEF', WB: 'DEF', MID: 'MID', FWD: 'FWD',
};

function assignLineup(
  players: Player[],
  formation: string,
): Array<{ pos: FieldPosition; player: Player | null; slotIndex: number }> {
  const positions = getFormationPositions(formation);
  const groups: Record<string, Player[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const p of players) {
    const g = groups[p.position];
    if (g) g.push(p);
  }
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => b.overall - a.overall);
  }
  const counters: Record<string, number> = {};
  return positions.map((pos, slotIndex) => {
    const group = ROLE_TO_POS[pos.role] ?? 'MID';
    counters[group] = counters[group] ?? 0;
    const player = groups[group][counters[group]] ?? null;
    counters[group]++;
    return { pos, player, slotIndex };
  });
}

function getBench(players: Player[], starters: Array<{ player: Player | null }>): Player[] {
  const starterIds = new Set(starters.map((s) => s.player?.id).filter(Boolean));
  return players.filter((p) => !starterIds.has(p.id));
}

// ─── Sub-modal: swap/substitute a starter ────────────────────────────────────
interface SwapModalProps {
  starter: Player | null;
  slotIndex: number;
  bench: Player[];
  visible: boolean;
  onClose: () => void;
  onSwap: (benchPlayer: Player, slotIndex: number) => void;
}

function SwapModal({ starter, bench, slotIndex, visible, onClose, onSwap }: SwapModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sw.overlay}>
        <View style={sw.sheet}>
          <Text style={sw.title}>
            {starter ? `Substituir ${starter.name}` : 'Escalar jogador'}
          </Text>
          {bench.length === 0 ? (
            <Text style={sw.empty}>Sem jogadores no banco.</Text>
          ) : (
            <ScrollView style={sw.list}>
              {bench.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={sw.row}
                  onPress={() => { onSwap(p, slotIndex); onClose(); }}
                >
                  <View style={sw.posTag}>
                    <Text style={sw.posTagText}>{p.position}</Text>
                  </View>
                  <View style={sw.info}>
                    <Text style={sw.name}>{p.name}</Text>
                    <Text style={sw.meta}>{p.nationality} · {p.age} anos</Text>
                  </View>
                  <Text style={sw.ovr}>{p.overall}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <TouchableOpacity style={sw.closeBtn} onPress={onClose}>
            <Text style={sw.closeBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Formation picker modal ───────────────────────────────────────────────────
interface FormPickerProps {
  current: string;
  visible: boolean;
  onClose: () => void;
  onPick: (f: string) => void;
}

function FormPicker({ current, visible, onClose, onPick }: FormPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={sw.overlay}>
        <View style={[sw.sheet, { paddingBottom: 24 }]}>
          <Text style={sw.title}>Escolher Formação</Text>
          {ALLOWED_FORMATIONS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[sw.formRow, f === current && sw.formRowActive]}
              onPress={() => { onPick(f); onClose(); }}
            >
              <Text style={[sw.formText, f === current && sw.formTextActive]}>{f}</Text>
              {f === current && <Text style={sw.formCheck}>✓</Text>}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[sw.closeBtn, { marginTop: 16 }]} onPress={onClose}>
            <Text style={sw.closeBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Field view ───────────────────────────────────────────────────────────────
interface FieldViewProps {
  players: Player[];
  formation: string;
  onFormationChange: (f: string) => void;
  savingFormation: boolean;
}

function FieldView({ players, formation, onFormationChange, savingFormation }: FieldViewProps) {
  const [lineup, setLineup] = useState(() => assignLineup(players, formation));
  const [swapTarget, setSwapTarget] = useState<{ slotIndex: number; starter: Player | null } | null>(null);
  const [showFormPicker, setShowFormPicker] = useState(false);

  useEffect(() => {
    setLineup(assignLineup(players, formation));
  }, [players, formation]);

  const bench = getBench(players, lineup);

  const handleSwap = (benchPlayer: Player, slotIndex: number) => {
    setLineup((prev) => {
      const next = [...prev];
      const oldStarter = next[slotIndex].player;
      next[slotIndex] = { ...next[slotIndex], player: benchPlayer };
      // If bench player was in another slot, clear it
      const otherSlot = next.findIndex((s, i) => i !== slotIndex && s.player?.id === benchPlayer.id);
      if (otherSlot !== -1) {
        next[otherSlot] = { ...next[otherSlot], player: oldStarter };
      }
      return next;
    });
  };

  return (
    <View style={fv.root}>
      {/* Formation row */}
      <View style={fv.formRow}>
        <Text style={fv.formLabel}>Formação:</Text>
        <TouchableOpacity style={fv.formBtn} onPress={() => setShowFormPicker(true)}>
          <Text style={fv.formBtnText}>{formation}</Text>
          <Text style={fv.chevron}>▼</Text>
        </TouchableOpacity>
        {savingFormation && <ActivityIndicator size="small" color={C.green} style={{ marginLeft: 8 }} />}
      </View>

      {/* Field */}
      <View style={[fv.field, { width: FIELD_W, height: FIELD_H }]}>
        {/* Field lines */}
        <View style={fv.centerCircle} />
        <View style={fv.centerLine} />
        <View style={fv.penaltyTop} />
        <View style={fv.penaltyBot} />

        {lineup.map(({ pos, player, slotIndex }) => {
          const cx = pos.x * FIELD_W - DOT_R;
          const cy = pos.y * FIELD_H - DOT_R;
          return (
            <TouchableOpacity
              key={slotIndex}
              style={[fv.dot, { left: cx, top: cy }]}
              onPress={() => setSwapTarget({ slotIndex, starter: player })}
              activeOpacity={0.75}
            >
              {player ? (
                <>
                  <Text style={fv.dotNumber}>{player.overall}</Text>
                  <Text style={fv.dotName} numberOfLines={1}>
                    {player.name.split(' ').pop()}
                  </Text>
                </>
              ) : (
                <Text style={fv.dotEmpty}>+</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Bench */}
      <View style={fv.benchBar}>
        <Text style={fv.benchTitle}>Banco ({bench.length})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {bench.map((p) => (
            <View key={p.id} style={fv.benchChip}>
              <Text style={fv.benchPos}>{p.position}</Text>
              <Text style={fv.benchName} numberOfLines={1}>{p.name.split(' ').pop()}</Text>
              <Text style={fv.benchOvr}>{p.overall}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <SwapModal
        visible={swapTarget !== null}
        starter={swapTarget?.starter ?? null}
        slotIndex={swapTarget?.slotIndex ?? 0}
        bench={bench}
        onClose={() => setSwapTarget(null)}
        onSwap={handleSwap}
      />
      <FormPicker
        visible={showFormPicker}
        current={formation}
        onClose={() => setShowFormPicker(false)}
        onPick={onFormationChange}
      />
    </View>
  );
}

// ─── Main SquadScreen ─────────────────────────────────────────────────────────
export default function SquadScreen() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [formation, setFormation] = useState('4-4-2');
  const [filter, setFilter] = useState<Position | 'ALL'>('ALL');
  const [viewTab, setViewTab] = useState<ViewTab>('campo');
  const [loading, setLoading] = useState(true);
  const [savingFormation, setSavingFormation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedTeam = useTeamStore((s) => s.selectedTeam);
  const token = useAuthStore((s) => s.token);
  const { formation: storedFormation, setFormation: storeFormation } = useCareerStore();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const teamId = token ? undefined : selectedTeam?.id;
      const data = await fetchSquad(teamId);
      setPlayers(data.players);
      const f = data.formation || storedFormation || '4-4-2';
      setFormation(f);
    } catch {
      setError('Não foi possível carregar o elenco. A API está rodando?');
    } finally {
      setLoading(false);
    }
  }, [token, selectedTeam?.id, storedFormation]);

  useEffect(() => { load(); }, [load]);

  const handleFormationChange = async (f: string) => {
    setFormation(f);
    storeFormation(f);
    if (!token) return;
    setSavingFormation(true);
    try {
      await updateFormation(f);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a formação.');
    } finally {
      setSavingFormation(false);
    }
  };

  const filtered = filter === 'ALL' ? players : players.filter((p) => p.position === filter);
  const positionOrder: Record<Position, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
  const sorted = [...filtered].sort((a, b) => positionOrder[a.position] - positionOrder[b.position] || b.overall - a.overall);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.header}>Elenco</Text>
          <Text style={styles.count}>{players.length} jogadores</Text>
        </View>

        {/* View tabs */}
        <View style={styles.viewTabs}>
          <TouchableOpacity
            style={[styles.viewTab, viewTab === 'campo' && styles.viewTabActive]}
            onPress={() => setViewTab('campo')}
          >
            <Text style={[styles.viewTabText, viewTab === 'campo' && styles.viewTabTextActive]}>
              ⚽ Campo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewTab, viewTab === 'lista' && styles.viewTabActive]}
            onPress={() => setViewTab('lista')}
          >
            <Text style={[styles.viewTabText, viewTab === 'lista' && styles.viewTabTextActive]}>
              📋 Lista
            </Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator color={C.green} style={{ marginTop: 40 }} />}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {!loading && !error && viewTab === 'campo' && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <FieldView
              players={players}
              formation={formation}
              onFormationChange={handleFormationChange}
              savingFormation={savingFormation}
            />
          </ScrollView>
        )}

        {!loading && !error && viewTab === 'lista' && (
          <>
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
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 12 },
  header: { color: C.textPrimary, fontSize: 26, fontWeight: 'bold' },
  count: { color: C.textMuted, fontSize: 13 },
  viewTabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  viewTab: {
    flex: 1, paddingVertical: 9, borderRadius: 8,
    backgroundColor: C.bgCard, alignItems: 'center',
  },
  viewTabActive: { backgroundColor: C.green },
  viewTabText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
  viewTabTextActive: { color: C.bg },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: C.bgCard, alignItems: 'center',
  },
  tabActive: { backgroundColor: C.greenDim },
  tabText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: C.textPrimary },
  list: { paddingBottom: 32 },
  errorText: { color: C.red, textAlign: 'center', marginTop: 40, fontSize: 14 },
});

const fv = StyleSheet.create({
  root: { alignItems: 'center', paddingBottom: 16 },
  formRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 12, alignSelf: 'stretch',
  },
  formLabel: { color: C.textMuted, fontSize: 13 },
  formBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.bgCard, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: C.border,
  },
  formBtnText: { color: C.green, fontWeight: '700', fontSize: 15 },
  chevron: { color: C.textMuted, fontSize: 10 },
  field: {
    backgroundColor: C.fieldGreen,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.fieldLine,
    position: 'relative',
    overflow: 'hidden',
  },
  centerLine: {
    position: 'absolute',
    left: 0, right: 0,
    top: FIELD_H / 2 - 0.5,
    height: 1,
    backgroundColor: C.fieldLine,
  },
  centerCircle: {
    position: 'absolute',
    width: 70, height: 70,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: C.fieldLine,
    left: FIELD_W / 2 - 35,
    top: FIELD_H / 2 - 35,
  },
  penaltyTop: {
    position: 'absolute',
    left: FIELD_W * 0.25, right: FIELD_W * 0.25,
    top: 0, height: FIELD_H * 0.18,
    borderBottomWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: C.fieldLine,
  },
  penaltyBot: {
    position: 'absolute',
    left: FIELD_W * 0.25, right: FIELD_W * 0.25,
    bottom: 0, height: FIELD_H * 0.18,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: C.fieldLine,
  },
  dot: {
    position: 'absolute',
    width: DOT_R * 2, height: DOT_R * 2,
    borderRadius: DOT_R,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  dotNumber: { color: '#fff', fontSize: 9, fontWeight: '800', lineHeight: 11 },
  dotName: { color: '#fff', fontSize: 7, fontWeight: '600', maxWidth: DOT_R * 2 - 2, textAlign: 'center' },
  dotEmpty: { color: 'rgba(255,255,255,0.6)', fontSize: 18, fontWeight: '300' },
  benchBar: { marginTop: 14, alignSelf: 'stretch' },
  benchTitle: { color: C.textMuted, fontSize: 12, marginBottom: 6 },
  benchChip: {
    backgroundColor: C.bgCard,
    borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
    marginRight: 8, alignItems: 'center', minWidth: 60,
  },
  benchPos: { color: C.textMuted, fontSize: 10, fontWeight: '600' },
  benchName: { color: C.textPrimary, fontSize: 11, fontWeight: '700', marginTop: 2 },
  benchOvr: { color: C.green, fontSize: 12, fontWeight: '800', marginTop: 1 },
});

const sw = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.bgCard, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    paddingHorizontal: 20, paddingTop: 20, maxHeight: '70%',
  },
  title: { color: C.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 16 },
  empty: { color: C.textMuted, textAlign: 'center', paddingVertical: 24 },
  list: { maxHeight: 300 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  posTag: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: C.bgSurface, alignItems: 'center', justifyContent: 'center',
  },
  posTagText: { color: C.green, fontSize: 11, fontWeight: '700' },
  info: { flex: 1 },
  name: { color: C.textPrimary, fontSize: 14, fontWeight: '600' },
  meta: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  ovr: { color: C.gold, fontSize: 16, fontWeight: '800' },
  closeBtn: {
    marginTop: 12, marginBottom: 8, paddingVertical: 14,
    backgroundColor: C.bgSurface, borderRadius: 10, alignItems: 'center',
  },
  closeBtnText: { color: C.textMuted, fontSize: 14, fontWeight: '600' },
  formRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  formRowActive: { backgroundColor: 'rgba(34,197,94,0.08)', borderRadius: 8, paddingHorizontal: 8 },
  formText: { color: C.textPrimary, fontSize: 16 },
  formTextActive: { color: C.green, fontWeight: '700' },
  formCheck: { color: C.green, fontSize: 16, fontWeight: '700' },
});
