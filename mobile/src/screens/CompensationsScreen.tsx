import { StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator, StatusBar, SafeAreaView, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { turso } from '../lib/turso';
import { COLORS, SHADOWS, SPACING } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Clock, MapPin, User, Calendar, BookOpen, Users, AlertCircle } from 'lucide-react-native';
import { ExtraSession } from '../types/shared';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

type RootStackParamList = {
    Head: undefined;
    Compensations: { year: any, semester: any };
};

type Props = NativeStackScreenProps<RootStackParamList, 'Compensations'>;

export default function CompensationsScreen({ navigation, route }: Props) {
    const { year, semester } = route.params;
    const [loading, setLoading] = useState(false);
    const [sessions, setSessions] = useState<ExtraSession[]>([]);
    const [filterType, setFilterType] = useState<'all' | 'extra' | 'makeup' | 'exam'>('all');

    useEffect(() => {
        fetchSessions();
    }, [filterType]);

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];

            let sql = `
                SELECT es.*, 
                       r.name as room_name, 
                       p.name as professor_name, 
                       g.name as group_name, 
                       c.name as course_name
                FROM extra_sessions es
                LEFT JOIN rooms r ON es.room_id = r.id
                LEFT JOIN professors p ON es.professor_id = p.id
                LEFT JOIN groups g ON es.group_id = g.id
                LEFT JOIN courses c ON es.course_id = c.id
                WHERE (es.is_archived = 0 OR es.is_archived IS NULL)
                AND es.session_date >= ?
            `;

            const args: any[] = [today];

            if (filterType !== 'all') {
                sql += ` AND es.session_type = ?`;
                args.push(filterType);
            }

            sql += ` ORDER BY es.session_date, es.start_time`;

            const result = await turso.execute({ sql, args });
            setSessions(result.rows as unknown as ExtraSession[]);
        } catch (e) {
            console.error(e);
            Alert.alert('خطأ', 'حدث خطأ أثناء تحميل البيانات');
        } finally {
            setLoading(false);
        }
    };

    const getSessionTypeLabel = (type: string) => {
        switch (type) {
            case 'extra': return 'حصة إضافية';
            case 'makeup': return 'حصة تعويض';
            case 'exam': return 'إمتحان';
            default: return type;
        }
    };

    const getSessionTypeColor = (type: string) => {
        switch (type) {
            case 'extra': return '#3B82F6'; // Blue
            case 'makeup': return '#F59E0B'; // Amber
            case 'exam': return '#EF4444'; // Red
            default: return COLORS.textSecondary;
        }
    };

    const renderSession = ({ item }: { item: ExtraSession }) => (
        <View style={styles.card}>
            <View style={[styles.cardHeader, { flexDirection: 'row-reverse' }]}>
                <View style={[styles.typeBadge, { backgroundColor: `${getSessionTypeColor(item.session_type)}20` }]}>
                    <Text style={[styles.typeText, { color: getSessionTypeColor(item.session_type) }]}>
                        {getSessionTypeLabel(item.session_type)}
                    </Text>
                </View>
                <View style={[styles.dateContainer, { flexDirection: 'row-reverse' }]}>
                    <Calendar size={14} color={COLORS.textSecondary} />
                    <Text style={[styles.dateText, { marginRight: 4, marginLeft: 0 }]}>
                        {format(new Date(item.session_date), 'EEEE d MMMM', { locale: ar })}
                    </Text>
                </View>
            </View>

            <Text style={[styles.courseText, { textAlign: 'right' }]}>{item.course_name || 'مادة غير معروفة'}</Text>

            <View style={[styles.infoRow, { flexDirection: 'row-reverse' }]}>
                <View style={[styles.infoItem, { flexDirection: 'row-reverse', marginLeft: SPACING.m, marginRight: 0 }]}>
                    <Clock size={16} color={COLORS.primary} />
                    <Text style={[styles.infoText, { marginRight: 6, marginLeft: 0 }]}>
                        {item.start_time} - {item.end_time}
                    </Text>
                </View>
                <View style={[styles.infoItem, { flexDirection: 'row-reverse', marginLeft: SPACING.m, marginRight: 0 }]}>
                    <MapPin size={16} color={COLORS.textSecondary} />
                    <Text style={[styles.infoText, { marginRight: 6, marginLeft: 0 }]}>
                        {item.room_name || 'قاعة غير معروفة'}
                    </Text>
                </View>
            </View>

            <View style={styles.divider} />

            <View style={[styles.detailsRow, { flexDirection: 'row-reverse' }]}>
                <View style={[styles.detailItem, { flexDirection: 'row-reverse', marginLeft: SPACING.m, marginRight: 0 }]}>
                    <User size={16} color={COLORS.textSecondary} />
                    <Text style={[styles.detailText, { marginRight: 6, marginLeft: 0 }]}>
                        {item.professor_name || 'أستاذ غير معروف'}
                    </Text>
                </View>
                <View style={[styles.detailItem, { flexDirection: 'row-reverse', marginLeft: SPACING.m, marginRight: 0 }]}>
                    <Users size={16} color={COLORS.textSecondary} />
                    <Text style={[styles.detailText, { marginRight: 6, marginLeft: 0 }]}>
                        {item.group_name || 'فوج غير معروف'}
                    </Text>
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
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backButton}
                        >
                            <ArrowLeft size={24} color={COLORS.white} />
                        </TouchableOpacity>
                        <View style={{ alignItems: 'flex-end', flex: 1, marginRight: SPACING.m }}>
                            <Text style={styles.title}>التعويضات والإضافي</Text>
                            <Text style={styles.subtitle}>
                                {year?.year_name} - {semester?.semester_name}
                            </Text>
                        </View>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <View style={styles.filterContainer}>
                <FlatList
                    horizontal
                    data={['all', 'extra', 'makeup', 'exam']}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[styles.filterContent, { flexDirection: 'row-reverse' }]}
                    keyExtractor={(item) => item}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[
                                styles.filterButton,
                                filterType === item && styles.selectedFilterButton
                            ]}
                            onPress={() => setFilterType(item as any)}
                        >
                            <Text style={[
                                styles.filterText,
                                filterType === item && styles.selectedFilterText
                            ]}>
                                {item === 'all' ? 'الكل' : getSessionTypeLabel(item)}
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
                    data={sessions}
                    renderItem={renderSession}
                    keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <AlertCircle size={48} color={COLORS.textLight} />
                            <Text style={styles.emptyText}>لا توجد حصص مبرمجة</Text>
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
    backButton: {
        padding: SPACING.s,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
    filterContainer: {
        marginTop: SPACING.m,
        marginBottom: SPACING.s,
    },
    filterContent: {
        paddingHorizontal: SPACING.m,
    },
    filterButton: {
        paddingHorizontal: SPACING.l,
        paddingVertical: SPACING.s,
        marginLeft: SPACING.s,
        borderRadius: 20,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.small,
    },
    selectedFilterButton: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    filterText: {
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    selectedFilterText: {
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
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.m,
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    typeText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    dateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dateText: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    courseText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: SPACING.s,
    },
    infoRow: {
        flexDirection: 'row',
        marginBottom: SPACING.s,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoText: {
        fontSize: 14,
        color: COLORS.text,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginBottom: SPACING.s,
    },
    detailsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    detailText: {
        fontSize: 14,
        color: COLORS.textSecondary,
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
});
