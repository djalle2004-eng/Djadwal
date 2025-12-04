import { StyleSheet, Text, View, TouchableOpacity, ScrollView, StatusBar, SafeAreaView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SHADOWS, SPACING } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { BookOpen, LogOut, ChevronLeft, Building2, CalendarClock } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import YearSemesterPicker from '../components/YearSemesterPicker';
import { useState } from 'react';

import { User } from '../types/shared';

type RootStackParamList = {
    Login: undefined;
    Head: { user: User };
    SpecializationSchedule: { year: any, semester: any };
    AvailableRooms: { year: any, semester: any };
    Compensations: { year: any, semester: any };
};

type Props = NativeStackScreenProps<RootStackParamList, 'Head'>;

export default function HeadScreen({ navigation }: Props) {
    // Year & Semester Selection
    const [selectedYear, setSelectedYear] = useState<any>(null);
    const [selectedSemester, setSelectedSemester] = useState<any>(null);

    const handleLogout = async () => {
        try {
            await AsyncStorage.removeItem('user_session');
            navigation.replace('Login');
        } catch (e) {
            console.error(e);
        }
    };

    const menuItems = [
        {
            id: 'schedule',
            title: 'جداول التخصصات',
            subtitle: 'عرض جداول الأفواج حسب التخصص',
            icon: BookOpen,
            color: '#4F46E5', // Indigo
            screen: 'SpecializationSchedule'
        },
        {
            id: 'rooms',
            title: 'القاعات المتاحة',
            subtitle: 'معرفة القاعات الشاغرة في وقت معين',
            icon: Building2,
            color: '#059669', // Emerald
            screen: 'AvailableRooms'
        },
        {
            id: 'compensations',
            title: 'التعويضات والإضافي',
            subtitle: 'عرض حصص التعويض والحصص الإضافية',
            icon: CalendarClock,
            color: '#F59E0B', // Amber
            screen: 'Compensations'
        },
    ];

    const handleNavigation = (screen: string) => {
        if (screen === 'SpecializationSchedule') {
            navigation.navigate('SpecializationSchedule', {
                year: selectedYear,
                semester: selectedSemester
            });
        } else if (screen === 'AvailableRooms') {
            navigation.navigate('AvailableRooms', {
                year: selectedYear,
                semester: selectedSemester
            });
        } else if (screen === 'Compensations') {
            navigation.navigate('Compensations', {
                year: selectedYear,
                semester: selectedSemester
            });
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
                    <View style={[styles.headerContent, { flexDirection: 'row-reverse' }]}>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.title}>لوحة الإدارة</Text>
                            <Text style={styles.subtitle}>رئيس القسم</Text>
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

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.grid}>
                    {menuItems.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.card}
                            onPress={() => handleNavigation(item.screen)}
                        >
                            <View style={[styles.cardContent, { flexDirection: 'row-reverse' }]}>
                                <View style={[styles.iconContainer, { backgroundColor: `${item.color}15` }]}>
                                    <item.icon size={32} color={item.color} />
                                </View>
                                <View style={{ flex: 1, alignItems: 'flex-end', marginRight: SPACING.m }}>
                                    <Text style={styles.cardTitle}>{item.title}</Text>
                                    <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                                </View>
                                <ChevronLeft size={24} color={COLORS.textLight} />
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
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
    content: {
        padding: SPACING.l,
    },
    grid: {
        gap: SPACING.m,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: SPACING.l,
        ...SHADOWS.small,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
});
