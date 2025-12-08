import { StyleSheet, Text, View, TouchableOpacity, ScrollView, StatusBar, SafeAreaView, Linking, Alert, ToastAndroid, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SHADOWS, SPACING } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, User as UserIcon, Calendar, Phone, Mail, Briefcase, GraduationCap, Clock } from 'lucide-react-native';
import { RootStackParamList } from '../../App';
import { User } from '../types/shared';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfessorDetails'>;

export default function ProfessorDetailsScreen({ navigation, route }: Props) {
    const { professor } = route.params;

    const handleViewSchedule = () => {
        // Construct the User object expected by ProfessorScreen
        const user: User = {
            id: professor.id,
            username: professor.email || professor.name, // Fallback
            full_name: professor.name,
            email: professor.email,
            role: 'professor',
            is_active: true,
            created_at: new Date().toISOString(), // Placeholder
            professor_id: professor.id
        };

        navigation.navigate('Professor', { user });
    };
    const translateAcademicTitle = (title: string) => {
        const titleMap: { [key: string]: string } = {
            'Dr': 'دكتور',
            'Prof.Dr': 'أستاذ دكتور',
            'Prof': 'أستاذ',
            'Professor': 'أستاذ',
            'Associate Professor': 'أستاذ محاضر أ',
            'Assistant Professor': 'أستاذ محاضر ب',
            'Lecturer': 'أستاذ مساعد أ',
            'Assistant Lecturer': 'أستاذ مساعد ب',
            'Doctor': 'دكتور',
            'Master': 'ماستر',
            'Engineer': 'مهندس'
        };
        return titleMap[title] || title;
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={[COLORS.primary, COLORS.primaryDark]}
                style={styles.header}
            >
                <SafeAreaView>
                    <View style={styles.headerContent}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <ArrowRight size={24} color={COLORS.white} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>معلومات الأستاذ</Text>
                        <View style={{ width: 40 }} />
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.card}>
                    <View style={styles.avatarContainer}>
                        <UserIcon size={48} color={COLORS.primary} />
                    </View>
                    <Text style={styles.name}>{professor.name}</Text>
                    {professor.academic_title && (
                        <Text style={styles.academicTitle}>{translateAcademicTitle(professor.academic_title)}</Text>
                    )}
                </View>

                <View style={styles.infoContainer}>
                    {professor.title && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoText}>{professor.title}</Text>
                            <View style={styles.labelContainer}>
                                <Text style={styles.label}>العنوان الوظيفي</Text>
                                <Briefcase size={20} color={COLORS.textSecondary} style={styles.icon} />
                            </View>
                        </View>
                    )}

                    {professor.specialization && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoText}>{professor.specialization}</Text>
                            <View style={styles.labelContainer}>
                                <Text style={styles.label}>التخصص</Text>
                                <GraduationCap size={20} color={COLORS.textSecondary} style={styles.icon} />
                            </View>
                        </View>
                    )}

                    {professor.email && (
                        <TouchableOpacity
                            style={styles.infoRow}
                            onPress={() => handleEmailPress(professor.email!)}
                        >
                            <Text style={styles.infoText}>{professor.email}</Text>
                            <View style={styles.labelContainer}>
                                <Text style={styles.label}>البريد الإلكتروني</Text>
                                <Mail size={20} color={COLORS.textSecondary} style={styles.icon} />
                            </View>
                        </TouchableOpacity>
                    )}

                    {professor.phone && (
                        <TouchableOpacity
                            style={styles.infoRow}
                            onPress={() => handlePhonePress(professor.phone!)}
                            onLongPress={() => handlePhoneLongPress(professor.phone!)}
                        >
                            <Text style={styles.infoText}>{professor.phone}</Text>
                            <View style={styles.labelContainer}>
                                <Text style={styles.label}>رقم الهاتف</Text>
                                <Phone size={20} color={COLORS.textSecondary} style={styles.icon} />
                            </View>
                        </TouchableOpacity>
                    )}

                    {professor.weekly_hours !== undefined && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoText}>{professor.weekly_hours} ساعة</Text>
                            <View style={styles.labelContainer}>
                                <Text style={styles.label}>الحجم الساعي الأسبوعي</Text>
                                <Clock size={20} color={COLORS.textSecondary} style={styles.icon} />
                            </View>
                        </View>
                    )}
                </View>

                <TouchableOpacity style={styles.scheduleButton} onPress={handleViewSchedule}>
                    <Text style={styles.scheduleButtonText}>عرض جدول التوقيت</Text>
                    <Calendar size={20} color={COLORS.white} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        paddingTop: 20,
        paddingBottom: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        ...SHADOWS.medium,
        zIndex: 10,
    },
    headerContent: {
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.l,
        marginTop: SPACING.s,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    backButton: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 12,
    },
    content: {
        padding: SPACING.l,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 24,
        padding: SPACING.xl,
        alignItems: 'center',
        marginBottom: SPACING.xl,
        ...SHADOWS.medium,
    },
    avatarContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.m,
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: 4,
    },
    academicTitle: {
        fontSize: 16,
        color: COLORS.primary,
        fontWeight: '600',
    },
    infoContainer: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: SPACING.l,
        ...SHADOWS.small,
        marginBottom: SPACING.xl,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    infoText: {
        fontSize: 16,
        color: COLORS.text,
        flex: 1,
        textAlign: 'left',
    },
    labelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: SPACING.m,
    },
    label: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginRight: 8,
    },
    icon: {
        opacity: 0.7,
    },
    scheduleButton: {
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        borderRadius: 16,
        ...SHADOWS.medium,
    },
    scheduleButtonText: {
        color: COLORS.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
});
