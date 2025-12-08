import { StyleSheet, Text, View, TextInput, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, SafeAreaView, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { turso } from '../lib/turso';
import { COLORS, SHADOWS, SPACING } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, MapPin, ChevronLeft, ArrowRight } from 'lucide-react-native';
import { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'RoomSearch'>;

interface Room {
    id: number;
    name: string;
    capacity: number;
    type?: string;
}

export default function RoomSearchScreen({ navigation }: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [rooms, setRooms] = useState<Room[]>([]);
    const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRooms();
    }, []);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredRooms(rooms);
        } else {
            const lowerQuery = searchQuery.toLowerCase();
            const filtered = rooms.filter(r =>
                r.name.toLowerCase().includes(lowerQuery)
            );
            setFilteredRooms(filtered);
        }
    }, [searchQuery, rooms]);

    const fetchRooms = async () => {
        try {
            const sql = `SELECT * FROM rooms ORDER BY name ASC`;
            const result = await turso.execute({ sql, args: [] });
            const data = result.rows as unknown as Room[];
            setRooms(data);
            setFilteredRooms(data);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to fetch rooms');
        } finally {
            setLoading(false);
        }
    };

    const handleRoomPress = (room: Room) => {
        navigation.navigate('RoomSchedule', { room });
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
                        <Text style={styles.title}>بحث عن قاعة</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <View style={styles.searchContainer}>
                        <Search size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="ابحث باسم القاعة..."
                            placeholderTextColor={COLORS.textLight}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            textAlign="right"
                        />
                    </View>
                </SafeAreaView>
            </LinearGradient>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={filteredRooms}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.card}
                            onPress={() => handleRoomPress(item)}
                        >
                            <View style={[styles.cardContent, { flexDirection: 'row-reverse' }]}>
                                <View style={styles.iconContainer}>
                                    <MapPin size={24} color={COLORS.primary} />
                                </View>
                                <View style={{ flex: 1, alignItems: 'flex-end', marginRight: SPACING.m }}>
                                    <Text style={styles.name}>{item.name}</Text>
                                    <Text style={styles.details}>{item.capacity} مقعد</Text>
                                </View>
                                <ChevronLeft size={20} color={COLORS.textLight} />
                            </View>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>لا توجد نتائج</Text>
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
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.l,
        marginTop: SPACING.s,
        marginBottom: SPACING.m,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    backButton: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 12,
    },
    searchContainer: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        marginHorizontal: SPACING.l,
        borderRadius: 12,
        paddingHorizontal: SPACING.m,
        height: 48,
    },
    searchIcon: {
        marginLeft: SPACING.s,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: COLORS.text,
        textAlign: 'right',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    list: {
        padding: SPACING.l,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: SPACING.m,
        marginBottom: SPACING.m,
        ...SHADOWS.small,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    name: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 4,
    },
    details: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 40,
    },
    emptyText: {
        fontSize: 16,
        color: COLORS.textSecondary,
    },
});
