import { StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator, StatusBar, SafeAreaView, Alert } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { turso } from '../lib/turso';
import { COLORS, SHADOWS, SPACING } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Clock, MapPin, User as UserIcon, Calendar, LogOut } from 'lucide-react-native';
import { Assignment, User } from '../types/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import YearSemesterPicker from '../components/YearSemesterPicker';

type RootStackParamList = {
    Login: undefined;
    Professor: { user: User };
};

type Props = NativeStackScreenProps<RootStackParamList, 'Professor'>;

const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

export default function ProfessorScreen({ navigation, route }: Props) {
    const [loading, setLoading] = useState(false);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [professorName, setProfessorName] = useState('');
    const [selectedDay, setSelectedDay] = useState<number>((new Date().getDay() + 1) % 7);
    const [selectedYear, setSelectedYear] = useState<any>(null);
    const [selectedSemester, setSelectedSemester] = useState<any>(null);

    useEffect(() => {
        checkLogin();
    }, []);

    useEffect(() => {
        if (selectedYear && selectedSemester) {
            fetchSchedule();
        }
    }, [selectedYear, selectedSemester, selectedDay]);

    const checkLogin = async () => {
        // First check if user is passed via params (Search Flow)
        if (route.params?.user) {
            setProfessorName(route.params.user.full_name || route.params.user.username);

            // Temporarily set AsyncStorage so fetchSchedule works with getItem('professorId')
            // Or better, update fetchSchedule to use a local variable.
            // Let's store it in state or use the param directly. 
            // However, fetchSchedule relies on AsyncStorage.
            // For minimal risk, I will set the AsyncStorage here.
            await AsyncStorage.setItem('professorId', route.params.user.id.toString());
            await AsyncStorage.setItem('professorName', route.params.user.full_name || route.params.user.username);
            return;
        }

        const id = await AsyncStorage.getItem('professorId');
        const name = await AsyncStorage.getItem('professorName');
        if (!id) {
            navigation.replace('Login');
            return;
        }
        if (name) setProfessorName(name);
    };

    const handleLogout = async () => {
        await AsyncStorage.clear();
        navigation.replace('Login');
    };

    const fetchSchedule = async () => {
        setLoading(true);
        try {
            const professorId = await AsyncStorage.getItem('professorId');
            if (!professorId) return;

            const sql = `
                SELECT a.*, c.name as course_name, r.name as room_name, g.name as group_name,
                       g.specialization
                FROM assignments a
                LEFT JOIN courses c ON a.course_id = c.id
                LEFT JOIN rooms r ON a.room_id = r.id
                LEFT JOIN groups g ON a.group_id = g.id
                WHERE a.professor_id = ?
                AND a.academic_year = ?
                AND a.semester = ?
                AND a.day_of_week = ?
                ORDER BY a.start_time
            `;

            const result = await turso.execute({
                sql,
                args: [professorId, selectedYear.year_name, selectedSemester.semester_name, selectedDay]
            });

            setAssignments(result.rows as unknown as Assignment[]);
        } catch (e) {
            console.error(e);
            Alert.alert('خطأ', 'حدث خطأ أثناء تحميل الجدول');
        } finally {
            setLoading(false);
        }
    };

    const renderAssignment = ({ item }: { item: Assignment }) => (
        <View style={styles.card}>
            <View style={[styles.cardHeader, { flexDirection: 'row-reverse' }]}>
                <View style={[styles.timeContainer, { flexDirection: 'row-reverse' }]}>
                    <Clock size={16} color={COLORS.primary} />
                    <Text style={[styles.timeText, { marginRight: 6, marginLeft: 0 }]}>{item.start_time} - {item.end_time}</Text>
                </View>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.group_name}</Text>
                </View>
            </View>

            <Text style={[styles.courseText, { textAlign: 'right' }]}>{item.course_name || 'مادة غير معروفة'}</Text>

            {item.specialization && (
                <Text style={[styles.specializationText, { textAlign: 'right' }]}>{item.specialization}</Text>
            )}

            <View style={styles.divider} />

            <View style={[styles.detailsRow, { flexDirection: 'row-reverse' }]}>
                <View style={[styles.detailItem, { flexDirection: 'row-reverse', marginLeft: SPACING.m, marginRight: 0 }]}>
                    <MapPin size={16} color={COLORS.textSecondary} />
                    <Text style={[styles.detailText, { marginRight: 6, marginLeft: 0 }]}>{item.room_name || 'قاعة غير معروفة'}</Text>
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={[COLORS.primary, COLORS.primaryDark]}
                style={styles.header}
            >
                <SafeAreaView>
                    <View style={[styles.headerContent, { flexDirection: 'row-reverse' }]}>
                        <TouchableOpacity onPress={handleLogout} style={[styles.logoutButton, !route.params?.user && { opacity: 0 }]} disabled={!!route.params?.user}>
                            {/* Only show/enable logout if NOT in view-only mode (Search mode) */}
                            {!route.params?.user && <LogOut size={20} color={COLORS.white} />}
                            {route.params?.user && <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}><ArrowLeft size={24} color={COLORS.white} /></TouchableOpacity>}
                        </TouchableOpacity>
                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <Text style={styles.title}>جدول الأستاذ</Text>
                            <Text style={styles.subtitle}>{professorName}</Text>
                        </View>
                        <View style={{ width: 40 }} />
                    </View>

                    <View style={styles.pickerContainer}>
                        <YearSemesterPicker
                            onYearChange={setSelectedYear}
                            onSemesterChange={setSelectedSemester}
                        />
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <View style={styles.daysContainer}>
                <FlatList
                    horizontal
                    data={DAYS}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.daysContent}
                    keyExtractor={(item, index) => index.toString()}
                    renderItem={({ item, index }) => (
                        <TouchableOpacity
                            style={[
                                styles.dayButton,
                                selectedDay === index && styles.selectedDayButton
                            ]}
                            onPress={() => setSelectedDay(index)}
                        >
                            <Text style={[
                                styles.dayText,
                                selectedDay === index && styles.selectedDayText
                            ]}>
                                {item}
                            </Text>
                        </TouchableOpacity>
                    )}
                />
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={assignments}
                    renderItem={renderAssignment}
                    keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Calendar size={48} color={COLORS.textLight} />
                            <Text style={styles.emptyText}>لا توجد حصص ليوم {DAYS[selectedDay]}</Text>
                            <Text style={styles.emptySubText}>اختر يوماً آخر لعرض الجدول</Text>
                        </View>
                    }
                />
            )}
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
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.l,
        marginTop: SPACING.s,
    },
    logoutButton: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: 4,
    },
    pickerContainer: {
        marginTop: SPACING.m,
        paddingHorizontal: SPACING.l,
    },
    daysContainer: {
        marginTop: SPACING.m,
        marginBottom: SPACING.s,
    },
    daysContent: {
        paddingHorizontal: SPACING.m,
    },
    dayButton: {
        paddingHorizontal: SPACING.l,
        paddingVertical: SPACING.s,
        marginRight: SPACING.s,
        borderRadius: 20,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.small,
    },
    selectedDayButton: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    dayText: {
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    selectedDayText: {
        color: COLORS.white,
    },
    list: {
        padding: SPACING.m,
        paddingBottom: 100,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: SPACING.m,
        marginBottom: SPACING.m,
        ...SHADOWS.medium,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.primary,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.s,
    },
    timeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEF2FF',
        paddingHorizontal: SPACING.s,
        paddingVertical: 4,
        borderRadius: 8,
    },
    timeText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.primary,
        marginLeft: 6,
    },
    badge: {
        backgroundColor: '#FCE7F3',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: COLORS.secondary,
    },
    courseText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 4,
    },
    specializationText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: SPACING.s,
        fontStyle: 'italic',
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginBottom: SPACING.s,
    },
    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: SPACING.m,
        marginBottom: 4,
    },
    detailText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginLeft: 6,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginTop: SPACING.m,
    },
    emptySubText: {
        fontSize: 14,
        color: COLORS.textLight,
        marginTop: SPACING.xs,
    },
});
