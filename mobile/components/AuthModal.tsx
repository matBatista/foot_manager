import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { login, register } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { C } from '../constants/theme';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ visible, onClose, onSuccess }: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setToken = useAuthStore((s) => s.setToken);

  function reset() {
    setName('');
    setEmail('');
    setPassword('');
    setError(null);
    setLoading(false);
  }

  function switchTab(t: 'login' | 'register') {
    setTab(t);
    setError(null);
  }

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      const res =
        tab === 'login'
          ? await login(email.trim(), password)
          : await register(name.trim(), email.trim(), password);
      setToken(res.token);
      reset();
      onSuccess();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Erro desconhecido';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} />
      <View style={styles.card}>
        <Text style={styles.title}>Conta</Text>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, tab === 'login' && styles.tabActive]}
            onPress={() => switchTab('login')}
          >
            <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>
              Entrar
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'register' && styles.tabActive]}
            onPress={() => switchTab('register')}
          >
            <Text style={[styles.tabText, tab === 'register' && styles.tabTextActive]}>
              Cadastrar
            </Text>
          </TouchableOpacity>
        </View>

        {tab === 'register' && (
          <TextInput
            style={styles.input}
            placeholder="Nome"
            placeholderTextColor={C.textMuted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={C.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Senha (mín. 8 caracteres)"
          placeholderTextColor={C.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={C.bg} />
          ) : (
            <Text style={styles.btnText}>{tab === 'login' ? 'Entrar' : 'Cadastrar'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 100,
  },
  card: {
    backgroundColor: C.bgCard,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: C.border,
  },
  title: {
    color: C.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: C.bgSurface,
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { backgroundColor: C.green },
  tabText: { color: C.textMuted, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: C.bg },
  input: {
    backgroundColor: C.bgInput,
    color: C.textPrimary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  btn: {
    backgroundColor: C.green,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: C.bg, fontSize: 15, fontWeight: 'bold' },
  errorText: { color: C.red, textAlign: 'center', marginVertical: 8, fontSize: 14 },
  cancelBtn: { marginTop: 10, alignItems: 'center' },
  cancelText: { color: C.textMuted, fontSize: 14 },
});
