import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTeamStore } from '../../store/teamStore';
import { formatBudget } from '../../services/teamService';

const MENU_ITEMS = [
  { label: '🏆  Liga', sub: 'Criar ou carregar uma temporada', route: '/league' },
  { label: '👥  Elenco', sub: 'Ver jogadores do seu time', route: '/squad' },
  { label: '⚽  Partida', sub: 'Resultados e simulação', route: '/match' },
  { label: '💸  Mercado', sub: 'Comprar e vender jogadores', route: '/market' },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const selectedTeam = useTeamStore((s) => s.selectedTeam);

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>ManagerFC</Text>
        <Text style={styles.subtitle}>Sua carreira de treinador começa aqui</Text>
      </View>

      {/* Team badge or selection prompt */}
      {selectedTeam ? (
        <TouchableOpacity
          style={styles.teamBadge}
          onPress={() => router.push('/select-team')}
          activeOpacity={0.8}
        >
          <View style={styles.teamBadgeIcon}>
            <Text style={styles.teamBadgeShort}>{selectedTeam.shortName}</Text>
          </View>
          <View style={styles.teamBadgeInfo}>
            <Text style={styles.teamBadgeName}>{selectedTeam.name}</Text>
            <Text style={styles.teamBadgeMeta}>
              {selectedTeam.division === 'serie_a' ? 'Série A' : 'Série B'} ·{' '}
              {formatBudget(selectedTeam.budget)}
            </Text>
          </View>
          <Text style={styles.teamBadgeChange}>Trocar</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.selectTeamCta}
          onPress={() => router.push('/select-team')}
          activeOpacity={0.8}
        >
          <Text style={styles.selectTeamCtaText}>⚽  Escolha seu time para começar</Text>
        </TouchableOpacity>
      )}

      <View style={styles.menu}>
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={styles.card}
            onPress={() => router.push(item.route)}
            activeOpacity={0.75}
          >
            <Text style={styles.cardLabel}>{item.label}</Text>
            <Text style={styles.cardSub}>{item.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#e2b96f',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 6,
  },
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  teamBadgeIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#0f3460',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  teamBadgeShort: {
    color: '#e2b96f',
    fontSize: 10,
    fontWeight: '800',
  },
  teamBadgeInfo: {
    flex: 1,
  },
  teamBadgeName: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '700',
  },
  teamBadgeMeta: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  teamBadgeChange: {
    color: '#e2b96f',
    fontSize: 12,
    fontWeight: '600',
  },
  selectTeamCta: {
    backgroundColor: '#0f3460',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2b96f',
  },
  selectTeamCtaText: {
    color: '#e2b96f',
    fontSize: 15,
    fontWeight: '700',
  },
  menu: {
    gap: 14,
  },
  card: {
    backgroundColor: '#16213e',
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 22,
    borderLeftWidth: 4,
    borderLeftColor: '#e2b96f',
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  cardSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
});
