import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { turso } from '../lib/turso';
import { User, Group } from '../types/shared';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SHADOWS, SPACING } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { User as UserIcon, Lock, GraduationCap, LogIn } from 'lucide-react-native';

type RootStackParamList = {
    Login: undefined;
    Student: { group: Group };
    Professor: { user: User };
    GroupSelection: undefined;
    Head: { user: User };
};

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

type Props = {
    navigation: LoginScreenNavigationProp;
};

export default function LoginScreen({ navigation }: Props) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [dbStatus, setDbStatus] = useState<string>('Checking connection...');

    useEffect(() => {
        checkConnection();
    }, []);

    const checkConnection = async () => {
        try {
            await turso.execute('SELECT 1');
            setDbStatus('Connected to Turso ✅');
        } catch (e) {
            console.error(e);
            setDbStatus('Connection failed ❌');
        }
    };

    const handleLogin = async () => {
        if (!username || !password) {
            Alert.alert('Error', 'Please enter username and password');
            return;
        }

        setLoading(true);
        try {
            const result = await turso.execute({
                sql: 'SELECT * FROM users WHERE username = ?',
                args: [username],
            });

            if (result.rows.length > 0) {
                const userData = result.rows[0] as unknown as User;
                if (userData.role === 'professor') {
                    navigation.replace('Professor', { user: userData });
                } else if (userData.role === 'schedule_manager' || userData.role === 'admin') {
                    navigation.replace('Head', { user: userData });
                } else {
                    Alert.alert('Info', 'Student login via username is disabled. Use "I am a Student" button.');
                }
            } else {
                Alert.alert('Error', 'Invalid credentials');
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient
            colors={[COLORS.primary, COLORS.primaryDark]}
            style={styles.container}
        >
            <StatusBar style="light" />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.headerContainer}>
                        <View style={styles.logosRow}>
                            <Image source={require('../../assets/univ.png')} style={styles.sideLogo} resizeMode="contain" />
                            <Image source={require('../../assets/djadwal.png')} style={styles.mainLogo} resizeMode="contain" />
                            <Image source={require('../../assets/fac.png')} style={styles.sideLogo} resizeMode="contain" />
                        </View>
                        <Text style={styles.slogan}>نظم وقتك، حقق أهدافك</Text>
                        <Text style={styles.status}>{dbStatus}</Text>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Welcome Back</Text>

                        <View style={styles.inputContainer}>
                            <UserIcon size={20} color={COLORS.textLight} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Username"
                                placeholderTextColor={COLORS.textLight}
                                value={username}
                                onChangeText={setUsername}
                                autoCapitalize="none"
                                textContentType="username"
                                autoComplete="username"
                                keyboardType="email-address"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Lock size={20} color={COLORS.textLight} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor={COLORS.textLight}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                textContentType="password"
                                autoComplete="password"
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <View style={styles.buttonContent}>
                                    <Text style={styles.buttonText}>Login</Text>
                                    <LogIn size={20} color={COLORS.white} style={{ marginLeft: 8 }} />
                                </View>
                            )}
                        </TouchableOpacity>

                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>OR</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <TouchableOpacity
                            style={styles.studentButton}
                            onPress={() => navigation.navigate('GroupSelection')}
                        >
                            <View style={styles.buttonContent}>
                                <GraduationCap size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                                <Text style={styles.studentButtonText}>I am a Student</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>تم تطوير التطبيق لفائدة جامعة الشهيد حمه لخضر - الوادي</Text>
                        <Text style={styles.footerText}>من طرف د. حسين علي</Text>
                        <Text style={styles.footerEmail}>hussain-ali@univ-eloued.dz</Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: SPACING.l,
        paddingTop: 60,
    },
    headerContainer: {
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    logosRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.m,
        gap: 10,
    },
    mainLogo: {
        width: 120,
        height: 120,
    },
    sideLogo: {
        width: 60,
        height: 60,
        opacity: 0.9,
    },
    slogan: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.white,
        textAlign: 'center',
        marginTop: SPACING.s,
        fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'sans-serif', // Fallback for Arabic
    },
    status: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.6)',
        marginTop: SPACING.s,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 24,
        padding: SPACING.l,
        ...SHADOWS.large,
        marginBottom: SPACING.xl,
    },
    cardTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: SPACING.l,
        textAlign: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: 12,
        marginBottom: SPACING.m,
        paddingHorizontal: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    inputIcon: {
        marginRight: SPACING.s,
    },
    input: {
        flex: 1,
        paddingVertical: 16,
        color: COLORS.text,
        fontSize: 16,
    },
    button: {
        backgroundColor: COLORS.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: SPACING.s,
        ...SHADOWS.small,
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: 'bold',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: SPACING.l,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.border,
    },
    dividerText: {
        marginHorizontal: SPACING.m,
        color: COLORS.textLight,
        fontWeight: '600',
    },
    studentButton: {
        backgroundColor: '#EEF2FF',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.primaryLight,
    },
    studentButtonText: {
        color: COLORS.primary,
        fontSize: 16,
        fontWeight: 'bold',
    },
    footer: {
        alignItems: 'center',
        marginTop: 'auto',
        paddingBottom: SPACING.l,
    },
    footerText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 2,
    },
    footerEmail: {
        color: COLORS.white,
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 2,
    },
});
