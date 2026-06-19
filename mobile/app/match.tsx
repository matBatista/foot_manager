import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMatchResultStore } from '../store/matchStore';
import { useCareerStore } from '../store/careerStore';
import {
  Team, MatchResult, MatchEvent, fetchTeams, simulateMatch,
} from '../services/matchService';
import { ResultRow } from '../services/leagueService';
import MatchDetailsModal from '../components/MatchDetailsModal';
import { C } from '../constants/theme';
import { getFormationPositions } from '../utils/formation';

export default function MatchScreen() {
  const router = useRouter();
  const { roundResults, managerTeamId, roundNumber, clear } = useMatchResultStore();

  if (roundResults.length > 0) {
    return (
      <CareerRoundView
        results={roundResults}
        managerTeamId={managerTeamId}
        roundNumber={roundNumber}
        onBack={() => { clear(); router.replace('/(career)'); }}
      />
    );
  }

  return <StandaloneMatchView onBack={() => router.replace('/(career)')} />;
}

// ─── Narration helpers ────────────────────────────────────────────────────────

type NarrEvent = {
  minute: number;
  type: string;
  text: string;
};

function buildNarration(
  events: MatchEvent[],
  homeId: string,
  homeLabel: string,
  awayLabel: string,
): NarrEvent[] {
  return events.map((e) => {
    const team = e.team_id === homeId ? homeLabel : awayLabel;
    let text = '';
    switch (e.type) {
      case 'goal':             text = `⚽ GOL de ${e.player ?? team}!`; break;
      case 'shot':             text = `🎯 Chute de ${e.player ?? team} — defendido.`; break;
      case 'yellow_card':      text = `🟨 Cartão amarelo para ${e.player ?? team}.`; break;
      case 'red_card':         text = `🟥 Expulsão! ${e.player ?? team} está fora.`; break;
      case 'corner':           text = `📐 Escanteio para ${team}.`; break;
      case 'foul':             text = `🦵 Falta de ${team}.`; break;
      case 'dangerous_attack': text = `⚡ Ataque perigoso de ${team}!`; break;
      case 'counter_attack':   text = `🏃 Contra-ataque de ${team}!`; break;
      case 'half_time':        text = `⏸ INTERVALO`; break;
      default:                 text = `${team} — ${e.type}.`;
    }
    return { minute: e.minute, type: e.type, text };
  });
}

// ─── Match Narration ──────────────────────────────────────────────────────────

function MatchNarration({
  events, homeId, homeLabel, awayLabel,
}: {
  events: MatchEvent[];
  homeId: string;
  homeLabel: string;
  awayLabel: string;
}) {
  const allNarr = buildNarration(events, homeId, homeLabel, awayLabel);
  const halfIdx = allNarr.findIndex((e) => e.type === 'half_time');
  const firstHalf = halfIdx >= 0 ? allNarr.slice(0, halfIdx + 1) : allNarr;
  const secondHalf = halfIdx >= 0 ? allNarr.slice(halfIdx + 1) : [];

  const [phase, setPhase] = useState<'first' | 'halftime' | 'second' | 'done'>('first');
  const [visibleCount, setVisibleCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentList = phase === 'second' ? secondHalf : firstHalf;

  useEffect(() => {
    if (phase === 'halftime' || phase === 'done') return;
    if (visibleCount >= currentList.length) {
      if (phase === 'first' && secondHalf.length > 0) {
        setPhase('halftime');
      } else {
        setPhase('done');
      }
      return;
    }
    timerRef.current = setInterval(() => {
      setVisibleCount((n) => n + 1);
    }, 320);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, visibleCount, currentList.length, secondHalf.length]);

  const skip = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setVisibleCount(currentList.length);
    if (phase === 'first' && secondHalf.length > 0) setPhase('halftime');
    else setPhase('done');
  };

  const continueMatch = () => {
    setPhase('second');
    setVisibleCount(0);
  };

  const displayed =
    phase === 'second' || phase === 'done'
      ? [...firstHalf, ...secondHalf.slice(0, visibleCount)]
      : firstHalf.slice(0, visibleCount);

  return (
    <View style={narr.wrap}>
      <View style={narr.header}>
        <Text style={narr.title}>NARRAÇÃO</Text>
        {phase !== 'halftime' && phase !== 'done' && (
          <TouchableOpacity onPress={skip}>
            <Text style={narr.skipBtn}>Pular ⏭</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={narr.feed}>
        {displayed.map((e, i) => (
          <View
            key={i}
            style={[
              narr.event,
              e.type === 'goal' && narr.eventGoal,
              e.type === 'half_time' && narr.eventHalf,
              e.type === 'red_card' && narr.eventRed,
            ]}
          >
            {e.type !== 'half_time' && <Text style={narr.minute}>{e.minute}'</Text>}
            <Text style={[
              narr.text,
              e.type === 'goal' && narr.textGoal,
              e.type === 'half_time' && narr.textHalf,
            ]}>
              {e.text}
            </Text>
          </View>
        ))}
      </View>

      {phase === 'halftime' && (
        <View style={narr.halftimeCard}>
          <Text style={narr.halftimeTitle}>⏸ Intervalo</Text>
          <Text style={narr.halftimeSub}>Fim do 1° tempo. Descanso dos jogadores.</Text>
          <TouchableOpacity style={narr.continueBtn} onPress={continueMatch} activeOpacity={0.85}>
            <Text style={narr.continueBtnText}>▶ Iniciar 2° Tempo</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Football Field ───────────────────────────────────────────────────────────

const FIELD_W = 328;
const FIELD_H = 440;
const DOT_R = 15;

function FootballField({
  homeLabel, awayLabel, homeFormation = '4-4-2', awayFormation = '4-4-2',
}: {
  homeLabel: string;
  awayLabel: string;
  homeFormation?: string;
  awayFormation?: string;
}) {
  const homePositions = getFormationPositions(homeFormation);
  const awayPositions = getFormationPositions(awayFormation);

  return (
    <View style={fieldSt.wrapper}>
      {/* Away header */}
      <View style={fieldSt.teamBar}>
        <Text style={fieldSt.labelAway} numberOfLines={1}>{awayLabel}</Text>
        <Text style={fieldSt.formTag}>{awayFormation}</Text>
      </View>

      {/* Field surface — uses absolute positioning for player dots */}
      <View style={[fieldSt.surface, { width: FIELD_W, height: FIELD_H }]}>
        <View style={fieldSt.centerLine} />
        <View style={fieldSt.centerCircle} />
        <View style={fieldSt.penaltyTop} />
        <View style={fieldSt.penaltyBottom} />

        {/* Away players: y increases downward, attacking from top */}
        {awayPositions.map((pos, i) => (
          <View
            key={`a${i}`}
            style={[
              fieldSt.dot, fieldSt.dotAway,
              {
                left: pos.x * FIELD_W - DOT_R,
                top: pos.y * FIELD_H - DOT_R,
                width: DOT_R * 2, height: DOT_R * 2, borderRadius: DOT_R,
              },
            ]}
          >
            <Text style={fieldSt.dotNum}>{i + 1}</Text>
            <Text style={fieldSt.dotRole}>{pos.role}</Text>
          </View>
        ))}

        {/* Home players: y flipped so GK is at bottom */}
        {homePositions.map((pos, i) => (
          <View
            key={`h${i}`}
            style={[
              fieldSt.dot, fieldSt.dotHome,
              {
                left: pos.x * FIELD_W - DOT_R,
                top: (1 - pos.y) * FIELD_H - DOT_R,
                width: DOT_R * 2, height: DOT_R * 2, borderRadius: DOT_R,
              },
            ]}
          >
            <Text style={fieldSt.dotNum}>{i + 1}</Text>
            <Text style={fieldSt.dotRole}>{pos.role}</Text>
          </View>
        ))}
      </View>

      {/* Home footer */}
      <View style={fieldSt.teamBar}>
        <Text style={fieldSt.formTag}>{homeFormation}</Text>
        <Text style={fieldSt.labelHome} numberOfLines={1}>{homeLabel}</Text>
      </View>
    </View>
  );
}

// ─── Career Round View ────────────────────────────────────────────────────────

function CareerRoundView({
  results, managerTeamId, roundNumber, onBack,
}: {
  results: ResultRow[];
  managerTeamId: string | null;
  roundNumber: number;
  onBack: () => void;
}) {
  const { formation } = useCareerStore();
  const myMatch = results.find(
    (r) => r.home_team_id === managerTeamId || r.away_team_id === managerTeamId,
  );
  const [selectedResult, setSelectedResult] = useState<ResultRow | null>(null);

  const isHome = myMatch?.home_team_id === managerTeamId;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backHeader} onPress={onBack} activeOpacity={0.8}>
          <Text style={styles.backHeaderIcon}>←</Text>
          <Text style={styles.backHeaderText}>Voltar ao Hub</Text>
        </TouchableOpacity>
        <Text style={styles.roundLabel}>RODADA {roundNumber}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {myMatch && (
          <>
            <Text style={styles.sectionLabel}>SUA PARTIDA</Text>
            <MainMatchCard match={myMatch} managerTeamId={managerTeamId} />
            <FootballField
              homeLabel={isHome ? myMatch.home_name : myMatch.away_name}
              awayLabel={isHome ? myMatch.away_name : myMatch.home_name}
              homeFormation={formation}
              awayFormation="4-4-2"
            />
            {myMatch.events && myMatch.events.length > 0 && (
              <MatchNarration
                events={myMatch.events}
                homeId={myMatch.home_team_id}
                homeLabel={myMatch.home_name}
                awayLabel={myMatch.away_name}
              />
            )}
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
              <Text style={[styles.resultTeam, r.home_goals > r.away_goals && styles.resultWinner]} numberOfLines={1}>
                {r.home_name}
              </Text>
              <View style={styles.scoreWrap}>
                <Text style={styles.resultScore}>{r.home_goals} – {r.away_goals}</Text>
                {(r.home_stats || r.away_stats) && <Text style={styles.statsHint}>stats</Text>}
              </View>
              <Text style={[styles.resultTeam, styles.resultRight, r.away_goals > r.home_goals && styles.resultWinner]} numberOfLines={1}>
                {r.away_name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.backBtnLarge} onPress={onBack} activeOpacity={0.85}>
          <Text style={styles.backBtnLargeText}>← Voltar ao Menu</Text>
        </TouchableOpacity>
      </ScrollView>

      <MatchDetailsModal visible={selectedResult !== null} result={selectedResult} onClose={() => setSelectedResult(null)} />
    </SafeAreaView>
  );
}

// ─── Standalone Match View ────────────────────────────────────────────────────

function StandaloneMatchView({ onBack }: { onBack: () => void }) {
  const { formation } = useCareerStore();
  const [teams, setTeams] = useState<Team[]>([]);
  const [homeId, setHomeId] = useState<string | null>(null);
  const [awayId, setAwayId] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams().then((ts) => {
      setTeams(ts);
      if (ts.length >= 2) { setHomeId(ts[0].id); setAwayId(ts[1].id); }
    }).catch(() => {});
  }, []);

  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? id ?? '';

  const onSimulate = async () => {
    if (!homeId || !awayId) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await simulateMatch(homeId, awayId);
      setResult(r);
    } catch {
      setError('Falha ao simular partida.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backHeader} onPress={onBack} activeOpacity={0.8}>
          <Text style={styles.backHeaderIcon}>←</Text>
          <Text style={styles.backHeaderText}>Menu</Text>
        </TouchableOpacity>
        <Text style={styles.roundLabel}>PARTIDA RÁPIDA</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
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
            <FootballField
              homeLabel={teamName(homeId)}
              awayLabel={teamName(awayId)}
              homeFormation={formation}
              awayFormation="4-4-2"
            />
            <View style={styles.standaloneScoreCard}>
              <Text style={styles.standaloneScoreTeam}>{teamName(homeId)}</Text>
              <Text style={styles.standaloneScore}>{result.home.goals} – {result.away.goals}</Text>
              <Text style={styles.standaloneScoreTeam}>{teamName(awayId)}</Text>
            </View>
            <MatchNarration
              events={result.events ?? []}
              homeId={homeId ?? ''}
              homeLabel={teamName(homeId)}
              awayLabel={teamName(awayId)}
            />
            <StatsBlock
              home={result.home}
              away={result.away}
              homeLabel={teamName(homeId)}
              awayLabel={teamName(awayId)}
            />
          </>
        )}

        {result && (
          <TouchableOpacity style={styles.backBtnLarge} onPress={onBack} activeOpacity={0.85}>
            <Text style={styles.backBtnLargeText}>← Voltar ao Menu</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function MainMatchCard({ match, managerTeamId }: { match: ResultRow; managerTeamId: string | null }) {
  const isHome = match.home_team_id === managerTeamId;
  const myGoals = isHome ? match.home_goals : match.away_goals;
  const oppGoals = isHome ? match.away_goals : match.home_goals;
  const myName = isHome ? match.home_name : match.away_name;
  const oppName = isHome ? match.away_name : match.home_name;
  const won = myGoals > oppGoals;
  const drew = myGoals === oppGoals;

  return (
    <View style={styles.scoreCard}>
      <Text style={styles.scoreTeam} numberOfLines={1}>{myName}</Text>
      <View style={styles.scoreCenterCol}>
        <Text style={styles.scoreBig}>{myGoals} – {oppGoals}</Text>
        <View style={[styles.resultTag, { backgroundColor: won ? C.green : drew ? C.textMuted : C.red }]}>
          <Text style={styles.resultTagText}>{won ? 'VITÓRIA' : drew ? 'EMPATE' : 'DERROTA'}</Text>
        </View>
      </View>
      <Text style={styles.scoreTeam} numberOfLines={1}>{oppName}</Text>
    </View>
  );
}

function StatsBlock({ home, away, homeLabel, awayLabel }: {
  home: any; away: any; homeLabel: string; awayLabel: string;
}) {
  const rows = [
    { label: 'Posse', hVal: `${home.possession}%`, aVal: `${away.possession}%`, hRaw: home.possession, aRaw: away.possession },
    { label: 'xG', hVal: (home.xg ?? 0).toFixed(2), aVal: (away.xg ?? 0).toFixed(2), hRaw: home.xg ?? 0, aRaw: away.xg ?? 0 },
    { label: 'Chutes', hVal: String(home.shots ?? 0), aVal: String(away.shots ?? 0), hRaw: home.shots ?? 0, aRaw: away.shots ?? 0 },
    { label: 'No gol', hVal: String(home.shots_on_target ?? 0), aVal: String(away.shots_on_target ?? 0), hRaw: home.shots_on_target ?? 0, aRaw: away.shots_on_target ?? 0 },
    { label: 'Passes', hVal: String(home.passes ?? 0), aVal: String(away.passes ?? 0), hRaw: home.passes ?? 0, aRaw: away.passes ?? 0 },
    { label: 'Precisão', hVal: `${home.pass_accuracy ?? 0}%`, aVal: `${away.pass_accuracy ?? 0}%`, hRaw: home.pass_accuracy ?? 0, aRaw: away.pass_accuracy ?? 0 },
  ];
  return (
    <View style={[styles.card, { marginBottom: 12 }]}>
      <View style={styles.statsHeader}>
        <Text style={styles.statsTeamLabel}>{homeLabel}</Text>
        <Text style={[styles.statsTeamLabel, { color: C.red }]}>{awayLabel}</Text>
      </View>
      {rows.map((s) => {
        const total = s.hRaw + s.aRaw || 1;
        const hPct = (s.hRaw / total) * 100;
        return (
          <View key={s.label} style={styles.statRow}>
            <Text style={styles.statVal}>{s.hVal}</Text>
            <View style={styles.statCenter}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <View style={styles.statTrack}>
                <View style={[styles.statHome, { flex: hPct }]} />
                <View style={[styles.statAway, { flex: 100 - hPct }]} />
              </View>
            </View>
            <Text style={[styles.statVal, styles.statValRight]}>{s.aVal}</Text>
          </View>
        );
      })}
    </View>
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const narr = StyleSheet.create({
  wrap: { marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { color: C.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  skipBtn: { color: C.green, fontSize: 13, fontWeight: '600' },
  feed: { backgroundColor: C.bgCard, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  event: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 8, paddingHorizontal: 12,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  eventGoal: { backgroundColor: `${C.green}15` },
  eventHalf: { backgroundColor: C.bgSurface, justifyContent: 'center' },
  eventRed: { backgroundColor: `${C.red}12` },
  minute: { color: C.textMuted, fontSize: 11, fontWeight: '700', minWidth: 28, paddingTop: 2 },
  text: { flex: 1, color: C.textSecondary, fontSize: 13, lineHeight: 18 },
  textGoal: { color: C.green, fontWeight: '700' },
  textHalf: { color: C.gold, fontWeight: '700', textAlign: 'center' },
  halftimeCard: {
    backgroundColor: C.bgSurface, borderRadius: 12, padding: 20, alignItems: 'center',
    borderWidth: 1, borderColor: C.greenDim, marginTop: 10,
  },
  halftimeTitle: { color: C.gold, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  halftimeSub: { color: C.textMuted, fontSize: 13, marginBottom: 16, textAlign: 'center' },
  continueBtn: { backgroundColor: C.green, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 10 },
  continueBtnText: { color: C.bg, fontSize: 15, fontWeight: '800' },
});

const fieldSt = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  teamBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 4, paddingVertical: 5,
  },
  labelAway: { color: 'rgba(239,68,68,0.9)', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', flex: 1 },
  labelHome: { color: 'rgba(34,197,94,0.9)', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', flex: 1, textAlign: 'right' },
  formTag: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '600' },
  surface: {
    backgroundColor: C.fieldGreen, borderRadius: 10, overflow: 'hidden',
    position: 'relative', alignSelf: 'center',
    borderWidth: 1, borderColor: C.fieldLine,
  },
  centerLine: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, backgroundColor: C.fieldLine },
  centerCircle: {
    position: 'absolute', width: 56, height: 56, borderRadius: 28,
    borderWidth: 1, borderColor: C.fieldLine,
    left: '50%', top: '50%', marginLeft: -28, marginTop: -28,
  },
  penaltyTop: {
    position: 'absolute', left: '22%', right: '22%', top: 0, height: '15%',
    borderBottomWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.fieldLine,
  },
  penaltyBottom: {
    position: 'absolute', left: '22%', right: '22%', bottom: 0, height: '15%',
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.fieldLine,
  },
  dot: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  dotHome: { backgroundColor: 'rgba(34,197,94,0.88)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  dotAway: { backgroundColor: 'rgba(239,68,68,0.78)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  dotNum: { fontSize: 9, fontWeight: '900', color: '#fff', lineHeight: 10 },
  dotRole: { fontSize: 6, color: 'rgba(255,255,255,0.7)', lineHeight: 7 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.bgCard, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backHeaderIcon: { color: C.green, fontSize: 18, fontWeight: '700' },
  backHeaderText: { color: C.green, fontSize: 14, fontWeight: '600' },
  roundLabel: { color: C.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  container: { padding: 16, paddingBottom: 48 },
  sectionLabel: { color: C.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10, marginTop: 8 },
  scoreCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard,
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 12,
  },
  scoreTeam: { flex: 1, color: C.textPrimary, fontSize: 13, fontWeight: '700', textAlign: 'center' },
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
  statsHeader: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  statsTeamLabel: { flex: 1, color: C.textSecondary, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  statRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: C.border },
  statVal: { color: C.textPrimary, fontSize: 14, fontWeight: '600', width: 48, textAlign: 'left' },
  statValRight: { textAlign: 'right' },
  statCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  statLabel: { color: C.textMuted, fontSize: 11, marginBottom: 4 },
  statTrack: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', width: '100%' },
  statHome: { backgroundColor: C.green },
  statAway: { backgroundColor: C.red },
  backBtnLarge: {
    marginTop: 12, backgroundColor: C.bgCard, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, paddingVertical: 16, alignItems: 'center',
  },
  backBtnLargeText: { color: C.textPrimary, fontSize: 15, fontWeight: '700' },
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
  errorText: { color: C.red, textAlign: 'center', marginTop: 16, fontSize: 14 },
});
