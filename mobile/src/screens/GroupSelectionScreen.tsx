import { StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator, Alert, StatusBar, SafeAreaView } from 'react-native';
import { useState, useEffect } from 'react';
import { turso } from '../lib/turso';
import { Group, Department } from '../types/shared';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SHADOWS, SPACING } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Building2, Users, ArrowLeft, Search } from 'lucide-react-native';

type RootStackParamList = {
    Login: undefined;
    Student: { group: Group };
    GroupSelection: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'GroupSelection'>;

export default function GroupSelectionScreen({ navigation }: Props) {
    const [step, setStep] = useState<'department' | 'group'>('department');
    const [departments, setDepartments] = useState<Department[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        setLoading(true);
        try {
            const result = await turso.execute('SELECT * FROM departments ORDER BY name');
            setDepartments(result.rows as unknown as Department[]);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to load departments');
        } finally {
            setLoading(false);
        }
    };

    const fetchGroups = async (deptId: number) => {
        setLoading(true);
        try {
            const result = await turso.execute({
                sql: "SELECT * FROM groups WHERE department_id = ? AND name NOT LIKE '%محاضرة%' AND group_type != 'lecture_group' ORDER BY name",
                args: [deptId],
            });
            setGroups(result.rows as unknown as Group[]);
            setStep('group');
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to load groups');
        } finally {
            setLoading(false);
        }
    };

    const handleDepartmentSelect = (dept: Department) => {
        setSelectedDepartment(dept);
        fetchGroups(dept.id);
    };

    const handleGroupSelect = async (group: Group) => {
        try {
            await AsyncStorage.setItem('student_group', JSON.stringify(group));
            navigation.replace('Student', { group });
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to save selection');
        }
    };

    const renderItem = ({ item }: { item: Department | Group }) => {
        const isDept = step === 'department';
        const Icon = isDept ? Building2 : Users;

        return (
            <TouchableOpacity
                style={styles.item}
                onPress={() => {
                    if (isDept) {
                        handleDepartmentSelect(item as Department);
                    } else {
                        handleGroupSelect(item as Group);
                    }
                }}
            >
                <View style={styles.itemContent}>
                    <View style={[styles.iconContainer, { backgroundColor: isDept ? '#E0E7FF' : '#FCE7F3' }]}>
                        <Icon size={24} color={isDept ? COLORS.primary : COLORS.secondary} />
                    </View>
                    <Text style={styles.itemText}>{item.name}</Text>
                </View>
                <ChevronRight size={20} color={COLORS.textLight} />
            </TouchableOpacity>
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
                        {step === 'group' && (
                            <TouchableOpacity onPress={() => setStep('department')} style={styles.backButton}>
                                <ArrowLeft size={24} color={COLORS.white} />
                            </TouchableOpacity>
                        )}
                        <View style={{ flex: 1, alignItems: step === 'group' ? 'flex-start' : 'center' }}>
                            <Text style={styles.title}>
                                {step === 'department' ? 'Select Department' : selectedDepartment?.name}
                            </Text>
                            {step === 'group' && (
                                <Text style={styles.subtitle}>Select your group</Text>
                            )}
                        </View>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <View style={styles.content}>
                {loading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={step === 'department' ? departments : groups}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={styles.list}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Search size={48} color={COLORS.textLight} />
                                <Text style={styles.emptyText}>No items found</Text>
                            </View>
                        }
                    />
                )}
            </View>
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
        zIndex: 1,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.l,
        marginTop: SPACING.s,
        minHeight: 44,
    },
    backButton: {
        marginRight: SPACING.m,
        padding: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: 2,
    },
    content: {
        flex: 1,
    },
    list: {
        padding: SPACING.m,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.surface,
        padding: SPACING.m,
        borderRadius: 16,
        marginBottom: SPACING.m,
        ...SHADOWS.small,
    },
    itemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.m,
    },
    itemText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        flex: 1,
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
