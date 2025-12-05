import { StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator, Alert, StatusBar, SafeAreaView } from 'react-native';
import { useState, useEffect } from 'react';
import { turso } from '../lib/turso';
import { Group, Department } from '../types/shared';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SHADOWS, SPACING } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Building2, Users, ArrowLeft, Search, GraduationCap } from 'lucide-react-native';

type RootStackParamList = {
    Login: undefined;
    Student: { group: Group };
    GroupSelection: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'GroupSelection'>;

export default function GroupSelectionScreen({ navigation }: Props) {
    const [step, setStep] = useState<'department' | 'specialization' | 'group'>('department');
    const [departments, setDepartments] = useState<Department[]>([]);
    const [specializations, setSpecializations] = useState<string[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
    const [selectedSpecialization, setSelectedSpecialization] = useState<string | null>(null);

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

    const fetchSpecializations = async (deptId: number) => {
        setLoading(true);
        try {
            const result = await turso.execute({
                sql: "SELECT DISTINCT specialization FROM groups WHERE department_id = ? AND specialization IS NOT NULL AND specialization != '' ORDER BY specialization",
                args: [deptId],
            });
            const specs = result.rows.map((row: any) => row.specialization);
            setSpecializations(specs);
            setStep('specialization');
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to load specializations');
        } finally {
            setLoading(false);
        }
    };

    const fetchGroups = async (deptId: number, specialization: string) => {
        setLoading(true);
        try {
            const result = await turso.execute({
                sql: "SELECT * FROM groups WHERE department_id = ? AND specialization = ? AND name NOT LIKE '%محاضرة%' AND group_type != 'lecture_group' ORDER BY name",
                args: [deptId, specialization],
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
        fetchSpecializations(dept.id);
    };

    const handleSpecializationSelect = (spec: string) => {
        setSelectedSpecialization(spec);
        if (selectedDepartment) {
            fetchGroups(selectedDepartment.id, spec);
        }
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

    const handleBack = () => {
        if (step === 'group') {
            setStep('specialization');
        } else if (step === 'specialization') {
            setStep('department');
            setSelectedDepartment(null);
        }
    };

    const renderItem = ({ item }: { item: Department | string | Group }) => {
        let Icon = Building2;
        let text = '';
        let onPress = () => { };
        let bgColor = '#E0E7FF';
        let iconColor = COLORS.primary;

        if (step === 'department') {
            const dept = item as Department;
            text = dept.name;
            onPress = () => handleDepartmentSelect(dept);
            Icon = Building2;
            bgColor = '#E0E7FF';
            iconColor = COLORS.primary;
        } else if (step === 'specialization') {
            text = item as string;
            onPress = () => handleSpecializationSelect(text);
            Icon = GraduationCap;
            bgColor = '#FEF3C7'; // Amber
            iconColor = '#D97706';
        } else {
            const group = item as Group;
            text = group.name;
            onPress = () => handleGroupSelect(group);
            Icon = Users;
            bgColor = '#FCE7F3'; // Pink
            iconColor = COLORS.secondary;
        }

        return (
            <TouchableOpacity
                style={styles.item}
                onPress={onPress}
            >
                <View style={styles.itemContent}>
                    <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
                        <Icon size={24} color={iconColor} />
                    </View>
                    <Text style={styles.itemText}>{text}</Text>
                </View>
                <ChevronRight size={20} color={COLORS.textLight} />
            </TouchableOpacity>
        );
    };

    const getTitle = () => {
        switch (step) {
            case 'department': return 'اختر القسم';
            case 'specialization': return selectedDepartment?.name;
            case 'group': return selectedSpecialization;
            default: return '';
        }
    };

    const getSubtitle = () => {
        switch (step) {
            case 'department': return 'الخطوة 1 من 3';
            case 'specialization': return 'اختر التخصص';
            case 'group': return 'اختر الفوج';
            default: return '';
        }
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
                        {step !== 'department' && (
                            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                                <ArrowLeft size={24} color={COLORS.white} />
                            </TouchableOpacity>
                        )}
                        <View style={{ flex: 1, alignItems: 'flex-end' }}>
                            <Text style={styles.title}>{getTitle()}</Text>
                            <Text style={styles.subtitle}>{getSubtitle()}</Text>
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
                        data={step === 'department' ? departments : (step === 'specialization' ? specializations : groups)}
                        renderItem={renderItem}
                        keyExtractor={(item, index) => {
                            if (step === 'department') return (item as Department).id.toString();
                            if (step === 'specialization') return item as string;
                            return (item as Group).id.toString();
                        }}
                        contentContainerStyle={styles.list}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Search size={48} color={COLORS.textLight} />
                                <Text style={styles.emptyText}>لا توجد عناصر</Text>
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
        flexDirection: 'row-reverse', // RTL for items
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.surface,
        padding: SPACING.m,
        borderRadius: 16,
        marginBottom: SPACING.m,
        ...SHADOWS.small,
    },
    itemContent: {
        flexDirection: 'row-reverse', // RTL
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: SPACING.m, // Changed from marginRight
    },
    itemText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        flex: 1,
        textAlign: 'right', // Align text right
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
