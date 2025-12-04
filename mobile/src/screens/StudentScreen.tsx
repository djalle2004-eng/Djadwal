import { StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator, Alert, StatusBar, SafeAreaView } from 'react-native';
import { useState, useEffect } from 'react';
import { Group, Assignment } from '../types/shared';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { turso } from '../lib/turso';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SHADOWS, SPACING } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, MapPin, User, BookOpen, Users, LogOut, Calendar } from 'lucide-react-native';
import YearSemesterPicker from '../components/YearSemesterPicker';

type RootStackParamList = {
    Login: undefined;
    Student: { group: Group };
    Professor: { user: any };
    GroupSelection: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Student'>;

const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

export default function StudentScreen({ route, navigation }: Props) {
    const { group } = route.params;
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(false);
    // Map JS getDay() (0=Sun, 6=Sat) to our DAYS array (0=Sat, 1=Sun)
    const [selectedDay, setSelectedDay] = useState<number>((new Date().getDay() + 1) % 7);

    // Year & Semester Selection
    const [selectedYear, setSelectedYear] = useState<any>(null);
    const [selectedSemester, setSelectedSemester] = useState<any>(null);

    useEffect(() => {
        if (selectedYear && selectedSemester) {
            fetchSchedule();
        }
    }, [group.id, selectedYear, selectedSemester]);

    const fetchSchedule = async () => {
        if (!selectedYear || !selectedSemester) return;

        setLoading(true);
        try {
            // Fetch assignments for this group AND shared lectures
            const sql = `
          SELECT a.*, c.name as course_name, r.name as room_name, p.name as professor_name, g.name as group_name, g.group_type
          FROM assignments a
          LEFT JOIN courses c ON a.course_id = c.id
          LEFT JOIN rooms r ON a.room_id = r.id
          LEFT JOIN professors p ON a.professor_id = p.id
          LEFT JOIN groups g ON a.group_id = g.id
          WHERE (
            a.group_id = ? 
            OR (a.group_id = ? AND ? IS NOT NULL)
            OR a.group_id IN (
                SELECT id FROM groups 
                WHERE parent_group_id = ? 
                AND (name LIKE '%محاضرة%' OR group_type = 'lecture_group')
            )
          )
          AND a.academic_year = ?
          AND a.semester = ?
          ORDER BY a.day_of_week, a.start_time
        `;

            const args = [
                group.id,
                group.parent_group_id || null,
                group.parent_group_id || null,
                group.parent_group_id || null,
                selectedYear.year_name,
                selectedSemester.semester_name
            ];

            const result = await turso.execute({ sql, args });
            setAssignments(result.rows as unknown as Assignment[]);
        } catch (e) {
            console.error('Fetch Error:', e);
            Alert.alert('Error', 'Failed to load schedule');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await AsyncStorage.removeItem('student_group');
            navigation.replace('Login');
        } catch (e) {
            console.error(e);
        }
    };

    const filteredAssignments = assignments.filter(a => a.day_of_week === selectedDay);

    const renderAssignment = ({ item }: { item: Assignment }) => (
        <View style={styles.card}>
            <View style={[styles.cardHeader, { flexDirection: 'row-reverse' }]}>
                <View style={[styles.timeContainer, { flexDirection: 'row-reverse' }]}>
                    <Clock size={16} color={COLORS.primary} />
                    <Text style={[styles.timeText, { marginRight: 6, marginLeft: 0 }]}>{item.start_time} - {item.end_time}</Text>
                </View>
                {item.group_name && item.group_name !== group.name && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>مشترك</Text>
                    </View>
                )}
            </View>

            <Text style={[styles.courseText, { textAlign: 'right' }]}>{item.course_name || 'مادة غير معروفة'}</Text>

            <View style={styles.divider} />

            <View style={[styles.detailsRow, { flexDirection: 'row-reverse' }]}>
                <View style={[styles.detailItem, { flexDirection: 'row-reverse', marginLeft: SPACING.m, marginRight: 0 }]}>
                    <MapPin size={16} color={COLORS.textSecondary} />
                    <Text style={[styles.detailText, { marginRight: 6, marginLeft: 0 }]}>{item.room_name || 'قاعة غير معروفة'}</Text>
                </View>
                <View style={[styles.detailItem, { flexDirection: 'row-reverse', marginLeft: SPACING.m, marginRight: 0 }]}>
                    <User size={16} color={COLORS.textSecondary} />
                    <Text style={[styles.detailText, { marginRight: 6, marginLeft: 0 }]}>{item.professor_name || 'أستاذ غير معروف'}</Text>
                </View>
            </View>

            {item.group_name && item.group_name !== group.name && (
                <View style={[styles.detailItem, { marginTop: 8, flexDirection: 'row-reverse' }]}>
                    <Users size={16} color={COLORS.textSecondary} />
                    <Text style={[styles.detailText, { marginRight: 6, marginLeft: 0 }]}>{item.group_name}</Text>
                </View>
            )}
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
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.title}>{group.name}</Text>
                            <Text style={styles.subtitle}>{group.specialization}</Text>
                        </View>
                        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                            <LogOut size={24} color={COLORS.white} />
                        </TouchableOpacity>
                    </View>

                    <YearSemesterPicker
                        onYearChange={setSelectedYear}
                        onSemesterChange={setSelectedSemester}
                    />
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
                    data={filteredAssignments}
                    renderItem={renderAssignment}
                    keyExtractor={(item, index) => item.id?.toString() || index.toString()}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Calendar size={48} color={COLORS.textLight} />
                            <Text style={styles.emptyText}>لا توجد حصص ليوم {DAYS[selectedDay]}</Text>
                            <Text style={styles.emptySubText}>استمتع بوقتك!</Text>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.l,
        marginTop: SPACING.s,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: 4,
    },
    logoutButton: {
        padding: SPACING.s,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 12,
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
        backgroundColor: '#EEF2FF', // Light Indigo
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
        backgroundColor: '#FCE7F3', // Light Pink
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
        marginBottom: SPACING.s,
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
