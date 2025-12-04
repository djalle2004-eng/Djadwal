import { StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator, Modal, ScrollView, StatusBar, SafeAreaView } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { turso } from '../lib/turso';
import { COLORS, SHADOWS, SPACING } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Filter, Calendar, Clock, MapPin, User, Users, ChevronDown } from 'lucide-react-native';
import { Group, Assignment } from '../types/shared';

type RootStackParamList = {
    Head: undefined;
    SpecializationSchedule: { year: any, semester: any };
};

type Props = NativeStackScreenProps<RootStackParamList, 'SpecializationSchedule'>;

const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

export default function SpecializationScheduleScreen({ navigation, route }: Props) {
    const { year, semester } = route.params;
    const [loading, setLoading] = useState(false);
    const [groups, setGroups] = useState<Group[]>([]);
    const [specializations, setSpecializations] = useState<string[]>([]);
    const [selectedSpecialization, setSelectedSpecialization] = useState<string>('');
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [selectedDay, setSelectedDay] = useState<number>((new Date().getDay() + 1) % 7);
    const [showPicker, setShowPicker] = useState(false);

    useEffect(() => {
        fetchGroups();
    }, []);

    useEffect(() => {
        if (selectedSpecialization && year && semester) {
            fetchSchedule();
        }
    }, [selectedSpecialization, year, semester]);

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const result = await turso.execute('SELECT * FROM groups');
            const fetchedGroups = result.rows as unknown as Group[];
            setGroups(fetchedGroups);

            // Extract unique specializations
            const uniqueSpecs = new Set<string>();
            fetchedGroups.forEach(g => {
                if (g.specialization && g.specialization.trim() !== '') {
                    uniqueSpecs.add(g.specialization.trim());
                }
            });
            const specsList = Array.from(uniqueSpecs).sort();
            setSpecializations(specsList);

            if (specsList.length > 0) {
                setSelectedSpecialization(specsList[0]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchSchedule = async () => {
        setLoading(true);
        try {
            // 1. Find all groups for this specialization (including lecture groups)
            // Logic similar to web: filter groups by specialization OR lecture groups
            const targetGroupIds = groups
                .filter(g =>
                    g.specialization === selectedSpecialization ||
                    (g.group_type === 'lecture_group' && (!g.specialization || g.specialization === selectedSpecialization))
                )
                .map(g => g.id);

            if (targetGroupIds.length === 0) {
                setAssignments([]);
                return;
            }

            const placeholders = targetGroupIds.map(() => '?').join(',');

            const sql = `
                SELECT a.*, c.name as course_name, r.name as room_name, p.name as professor_name, g.name as group_name
                FROM assignments a
                LEFT JOIN courses c ON a.course_id = c.id
                LEFT JOIN rooms r ON a.room_id = r.id
                LEFT JOIN professors p ON a.professor_id = p.id
                LEFT JOIN groups g ON a.group_id = g.id
                WHERE a.group_id IN (${placeholders})
                AND a.academic_year = ?
                AND a.semester = ?
                ORDER BY a.day_of_week, a.start_time
            `;

            const args = [...targetGroupIds, year.year_name, semester.semester_name];

            const result = await turso.execute({ sql, args });
            setAssignments(result.rows as unknown as Assignment[]);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
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
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.group_name}</Text>
                </View>
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
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <ArrowLeft size={24} color={COLORS.white} />
                        </TouchableOpacity>
                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <Text style={styles.title}>جدول التخصصات</Text>
                            <Text style={styles.subtitle}>
                                {year?.year_name} - {semester?.semester_name}
                            </Text>
                            <TouchableOpacity
                                style={[styles.pickerButton, { flexDirection: 'row-reverse', marginTop: 8 }]}
                                onPress={() => setShowPicker(true)}
                            >
                                <Text style={[styles.pickerText, { marginLeft: 4, marginRight: 0 }]}>
                                    {selectedSpecialization || 'اختر التخصص'}
                                </Text>
                                <ChevronDown size={16} color="rgba(255,255,255,0.8)" />
                            </TouchableOpacity>
                        </View>
                        <View style={{ width: 40 }} />
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
                    data={filteredAssignments}
                    renderItem={renderAssignment}
                    keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Calendar size={48} color={COLORS.textLight} />
                            <Text style={styles.emptyText}>لا توجد حصص ليوم {DAYS[selectedDay]}</Text>
                        </View>
                    }
                />
            )}

            <Modal
                visible={showPicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={[styles.modalHeader, { flexDirection: 'row-reverse' }]}>
                            <Text style={styles.modalTitle}>اختر التخصص</Text>
                            <TouchableOpacity onPress={() => setShowPicker(false)}>
                                <Text style={styles.closeText}>إغلاق</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={specializations}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.modalItem,
                                        { flexDirection: 'row-reverse' },
                                        selectedSpecialization === item && styles.selectedModalItem
                                    ]}
                                    onPress={() => {
                                        setSelectedSpecialization(item);
                                        setShowPicker(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.modalItemText,
                                        selectedSpecialization === item && styles.selectedModalItemText
                                    ]}>
                                        {item}
                                    </Text>
                                    {selectedSpecialization === item && (
                                        <Filter size={20} color={COLORS.primary} />
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
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
    backButton: {
        padding: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.white,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        marginBottom: 4,
    },
    pickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    pickerText: {
        color: COLORS.white,
        marginRight: 4,
        fontWeight: '600',
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
        fontSize: 16,
        color: COLORS.textLight,
        marginTop: SPACING.m,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.l,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    closeText: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    modalItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.l,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    selectedModalItem: {
        backgroundColor: '#EEF2FF',
    },
    modalItemText: {
        fontSize: 16,
        color: COLORS.text,
    },
    selectedModalItemText: {
        color: COLORS.primary,
        fontWeight: '600',
    },
});
