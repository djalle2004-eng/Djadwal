import { StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator, Alert, StatusBar, SafeAreaView } from 'react-native';
import { useState, useEffect } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { turso } from '../lib/turso';
import { COLORS, SHADOWS, SPACING } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, MapPin } from 'lucide-react-native';

type RootStackParamList = {
    Head: undefined;
    AvailableRooms: { year: any, semester: any };
};

type Props = NativeStackScreenProps<RootStackParamList, 'AvailableRooms'>;

const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

export default function AvailableRoomsScreen({ navigation, route }: Props) {
    const { year, semester } = route.params;
    const [loading, setLoading] = useState(false);
    const [rooms, setRooms] = useState<any[]>([]);
    const [selectedDay, setSelectedDay] = useState<number>((new Date().getDay() + 1) % 7);
    const [timeSlots, setTimeSlots] = useState<string[]>([]);

    useEffect(() => {
        if (year && semester) {
            fetchData();
        }
    }, [year, semester, selectedDay]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch all rooms
            const roomsResult = await turso.execute('SELECT * FROM rooms ORDER BY name');
            const allRooms = roomsResult.rows;

            // 2. Fetch assignments for the selected year, semester, and day
            const assignmentsResult = await turso.execute({
                sql: `
                    SELECT * FROM assignments 
                    WHERE academic_year = ? 
                    AND semester = ? 
                    AND day_of_week = ?
                `,
                args: [year.year_name, semester.semester_name, selectedDay]
            });
            const assignments = assignmentsResult.rows;

            // 3. Generate time slots
            const standardSlots = [
                { start: '08:00', end: '09:30' },
                { start: '09:30', end: '11:00' },
                { start: '11:00', end: '12:30' },
                { start: '12:30', end: '14:00' },
                { start: '14:00', end: '15:30' },
                { start: '15:30', end: '17:00' },
            ];
            setTimeSlots(standardSlots.map(s => `${s.start} - ${s.end}`));

            // 4. Calculate availability
            const roomsWithAvailability = allRooms.map((room: any) => {
                const roomAssignments = assignments.filter((a: any) => a.room_id === room.id);
                const availability = standardSlots.map(slot => {
                    const isOccupied = roomAssignments.some((a: any) =>
                        (a.start_time <= slot.start && a.end_time > slot.start) ||
                        (a.start_time < slot.end && a.end_time >= slot.end) ||
                        (a.start_time >= slot.start && a.end_time <= slot.end)
                    );
                    return !isOccupied;
                });
                return { ...room, availability };
            });

            setRooms(roomsWithAvailability);

        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const renderRoom = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={[styles.cardHeader, { flexDirection: 'row-reverse' }]}>
                <View style={[styles.roomInfo, { flexDirection: 'row-reverse' }]}>
                    <MapPin size={20} color={COLORS.primary} />
                    <Text style={[styles.roomName, { marginRight: 8, marginLeft: 0 }]}>{item.name}</Text>
                </View>
                <View style={styles.capacityBadge}>
                    <Text style={styles.capacityText}>{item.capacity} مقعد</Text>
                </View>
            </View>

            <View style={styles.slotsContainer}>
                {item.availability.map((isAvailable: boolean, index: number) => (
                    <View key={index} style={styles.slotItem}>
                        <View style={[
                            styles.statusDot,
                            { backgroundColor: isAvailable ? COLORS.success : COLORS.error }
                        ]} />
                        <Text style={styles.slotText}>{timeSlots[index]}</Text>
                    </View>
                ))}
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
                            <Text style={styles.title}>القاعات المتاحة</Text>
                            <Text style={styles.subtitle}>
                                {year?.year_name} - {semester?.semester_name}
                            </Text>
                        </View>
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
                    data={rooms}
                    renderItem={renderRoom}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MapPin size={48} color={COLORS.textLight} />
                            <Text style={styles.emptyText}>لا توجد قاعات</Text>
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
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.m,
    },
    roomInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    roomName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
        marginLeft: 8,
    },
    capacityBadge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    capacityText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    slotsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    slotItem: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '48%',
        marginBottom: 8,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    slotText: {
        fontSize: 12,
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
