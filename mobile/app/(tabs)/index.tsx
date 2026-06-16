import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

const MENU_ITEMS = [
  { label: '🏆  Liga', sub: 'Criar ou carregar uma temporada', route: '/league' },
  { label: '👥  Elenco', sub: 'Ver jogadores do seu time', route: '/squad' },
  { label: '⚽  Partida', sub: 'Resultados e simulação', route: '/match' },
] as const;

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>Brassfoot</Text>
        <Text style={styles.subtitle}>Sua carreira de treinador começa aqui</Text>
      </View>

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
    marginBottom: 40,
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
