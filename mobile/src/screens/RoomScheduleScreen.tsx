import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar, SafeAreaView, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { turso } from '../lib/turso';
import { COLORS, SHADOWS, SPACING } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Calendar, User, BookOpen, Users } from 'lucide-react-native';
import { RootStackParamList } from '../../App';
import YearSemesterPicker from '../components/YearSemesterPicker';

type Props = NativeStackScreenProps<RootStackParamList, 'RoomSchedule'>;

const DAYS = [
    { id: 0, name: 'السبت' },
    { id: 1, name: 'الأحد' },
    { id: 2, name: 'الاثنين' },
    { id: 3, name: 'الثلاثاء' },
    { id: 4, name: 'الأربعاء' },
    { id: 5, name: 'الخميس' },
    { id: 6, name: 'الجمعة' },
];

const TIME_SLOTS = [
    { start: '08:00', end: '09:30' },
    { start: '09:30', end: '11:00' },
    { start: '11:00', end: '12:30' },
    { start: '12:30', end: '14:00' },
    { start: '14:00', end: '15:30' },
    { start: '15:30', end: '17:00' },
];

export default function RoomScheduleScreen({ navigation, route }: Props) {
    const { room } = route.params;
    const [selectedYear, setSelectedYear] = useState<any>(null);
    const [selectedSemester, setSelectedSemester] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [selectedDay, setSelectedDay] = useState((new Date().getDay() + 1) % 7);

    useEffect(() => {
        if (selectedYear && selectedSemester) {
            fetchAssignments();
        }
    }, [selectedYear, selectedSemester]);

    const fetchAssignments = async () => {
        setLoading(true);
        try {
            const sql = `
                SELECT 
                    a.*,
                    c.name as module_name,
                    p.name as professor_name,
                    g.name as group_name
                FROM assignments a
                LEFT JOIN courses c ON a.course_id = c.id
                LEFT JOIN professors p ON a.professor_id = p.id
                LEFT JOIN groups g ON a.group_id = g.id
                WHERE a.room_id = ? 
                AND a.academic_year = ? 
                AND a.semester = ?
            `;
            const result = await turso.execute({
                sql,
                args: [room.id, selectedYear.year_name, selectedSemester.semester_name]
            });
            setAssignments(result.rows);
        } catch (e: any) {
            console.error(e);
            Alert.alert('Error', e.message || 'Failed to fetch assignments');
        } finally {
            setLoading(false);
        }
    };

    const getDayAssignments = (dayId: number) => {
        return assignments.filter(a => a.day_of_week === dayId);
    };

    const renderTimeSlot = (slot: any, dayAssignments: any[]) => {
        const assignment = dayAssignments.find(a =>
            (a.start_time <= slot.start && a.end_time > slot.start) ||
            (a.start_time < slot.end && a.end_time >= slot.end) ||
            (a.start_time >= slot.start && a.end_time <= slot.end)
        );

        if (!assignment) {
            return (
                <View style={styles.emptySlot}>
                    <Text style={styles.timeText}>{slot.start} - {slot.end}</Text>
                    <Text style={styles.emptyText}>متاح</Text>
                </View>
            );
        }

        return (
            <View style={styles.activeSlot}>
                <View style={styles.slotHeader}>
                    <Text style={styles.timeTextActive}>{slot.start} - {slot.end}</Text>
                    <View style={[styles.typeTag, { backgroundColor: COLORS.primaryLight }]}>
                        <Text style={styles.typeText}>{assignment.type}</Text>
                    </View>
                </View>

                <View style={styles.detailRow}>
                    <Text style={styles.detailText}>{assignment.module_name}</Text>
                    <BookOpen size={16} color={COLORS.primary} style={{ marginLeft: 6 }} />
                </View>

                <View style={styles.detailRow}>
                    <Text style={styles.detailText}>{assignment.professor_name}</Text>
                    <User size={16} color={COLORS.textSecondary} style={{ marginLeft: 6 }} />
                </View>

                <View style={styles.detailRow}>
                    <Text style={styles.detailText}>{assignment.group_name}</Text>
                    <Users size={16} color={COLORS.textSecondary} style={{ marginLeft: 6 }} />
                </View>
            </View>
        );
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
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.headerTitle}>{room.name}</Text>
                            <Text style={styles.headerSubtitle}>جدول القاعة</Text>
                        </View>
                    </View>

                    <View style={styles.pickerContainer}>
                        <YearSemesterPicker
                            onYearChange={setSelectedYear}
                            onSemesterChange={setSelectedSemester}
                        />
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <View style={styles.daysScroll}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.m }}>
                    {DAYS.map((day) => (
                        <TouchableOpacity
                            key={day.id}
                            style={[
                                styles.dayButton,
                                selectedDay === day.id && styles.dayButtonActive
                            ]}
                            onPress={() => setSelectedDay(day.id)}
                        >
                            <Text style={[
                                styles.dayText,
                                selectedDay === day.id && styles.dayTextActive
                            ]}>{day.name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {loading ? (
                    <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
                ) : !selectedYear || !selectedSemester ? (
                    <View style={styles.placeholderContainer}>
                        <Calendar size={48} color={COLORS.textLight} />
                        <Text style={styles.placeholderText}>الرجاء اختيار السنة والفصل</Text>
                    </View>
                ) : (
                    <View style={styles.scheduleContainer}>
                        {TIME_SLOTS.map((slot, index) => (
                            <View key={index} style={styles.slotContainer}>
                                {renderTimeSlot(slot, getDayAssignments(selectedDay))}
                            </View>
                        ))}
                    </View>
                )}
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
        marginBottom: SPACING.m,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
    },
    backButton: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 12,
    },
    pickerContainer: {
        paddingHorizontal: SPACING.l,
        marginBottom: SPACING.s,
    },
    daysScroll: {
        marginTop: SPACING.m,
        marginBottom: SPACING.s,
        height: 50,
    },
    dayButton: {
        paddingHorizontal: SPACING.l,
        paddingVertical: 8,
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        marginRight: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 80,
    },
    dayButtonActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    dayText: {
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    dayTextActive: {
        color: COLORS.white,
    },
    content: {
        padding: SPACING.m,
        paddingBottom: 40,
    },
    scheduleContainer: {
        gap: SPACING.m,
    },
    slotContainer: {
        marginBottom: SPACING.s,
    },
    emptySlot: {
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderRadius: 12,
        padding: SPACING.m,
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderStyle: 'dashed',
    },
    activeSlot: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: SPACING.m,
        ...SHADOWS.small,
        borderRightWidth: 4,
        borderRightColor: COLORS.primary,
    },
    slotHeader: {
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.s,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        paddingBottom: 8,
    },
    timeText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    emptyText: {
        fontSize: 14,
        color: COLORS.success,
        fontWeight: '600',
    },
    timeTextActive: {
        fontSize: 14,
        color: COLORS.primary,
        fontWeight: '700',
    },
    typeTag: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    typeText: {
        fontSize: 12,
        color: COLORS.white,
        fontWeight: 'bold',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 4,
    },
    detailText: {
        fontSize: 14,
        color: COLORS.text,
        textAlign: 'right',
    },
    placeholderContainer: {
        alignItems: 'center',
        marginTop: 60,
    },
    placeholderText: {
        marginTop: SPACING.m,
        fontSize: 16,
        color: COLORS.textSecondary,
    },
});
