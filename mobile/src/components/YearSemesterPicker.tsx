import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, Alert } from 'react-native';
import { ChevronDown, Calendar as CalendarIcon } from 'lucide-react-native';
import { COLORS, SHADOWS, SPACING } from '../constants/theme';
import { turso } from '../lib/turso';

interface YearSemesterPickerProps {
    onYearChange: (year: any) => void;
    onSemesterChange: (semester: any) => void;
    initialYear?: any;
    initialSemester?: any;
}

export default function YearSemesterPicker({ onYearChange, onSemesterChange, initialYear, initialSemester }: YearSemesterPickerProps) {
    const [years, setYears] = useState<any[]>([]);
    const [semesters, setSemesters] = useState<any[]>([]);
    const [selectedYear, setSelectedYear] = useState<any>(initialYear || null);
    const [selectedSemester, setSelectedSemester] = useState<any>(initialSemester || null);
    const [showYearPicker, setShowYearPicker] = useState(false);
    const [showSemesterPicker, setShowSemesterPicker] = useState(false);

    useEffect(() => {
        fetchYears();
    }, []);

    useEffect(() => {
        if (selectedYear) {
            fetchSemesters(selectedYear.id);
            onYearChange(selectedYear);
        }
    }, [selectedYear]);

    useEffect(() => {
        if (selectedSemester) {
            onSemesterChange(selectedSemester);
        }
    }, [selectedSemester]);

    const fetchYears = async () => {
        try {
            const result = await turso.execute('SELECT * FROM academic_years ORDER BY created_at DESC');
            setYears(result.rows);

            if (!selectedYear) {
                const current = result.rows.find((y: any) => y.is_current === 1) || result.rows[0];
                setSelectedYear(current);
            }
        } catch (e) {
            console.error('Failed to fetch years:', e);
            Alert.alert('Error', 'Failed to load academic years');
        }
    };

    const fetchSemesters = async (yearId: number) => {
        try {
            const result = await turso.execute({
                sql: 'SELECT * FROM semesters WHERE academic_year_id = ? ORDER BY semester_name',
                args: [yearId]
            });
            setSemesters(result.rows);

            // If we have a selected semester, check if it belongs to the new year
            // Otherwise, select default
            const current = result.rows.find((s: any) => s.is_current === 1) || result.rows[0];
            setSelectedSemester(current);
        } catch (e) {
            console.error('Failed to fetch semesters:', e);
        }
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowYearPicker(true)}
            >
                <CalendarIcon size={16} color={COLORS.white} />
                <Text style={styles.pickerText}>
                    {selectedYear ? selectedYear.year_name : 'السنة الدراسية'}
                </Text>
                <ChevronDown size={16} color={COLORS.white} style={{ marginRight: 'auto' }} />
            </TouchableOpacity>

            <View style={{ width: SPACING.s }} />

            <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowSemesterPicker(true)}
            >
                <Text style={styles.pickerText}>
                    {selectedSemester ? selectedSemester.semester_name : 'السداسي'}
                </Text>
                <ChevronDown size={16} color={COLORS.white} style={{ marginRight: 'auto' }} />
            </TouchableOpacity>

            {/* Year Picker Modal */}
            <Modal
                visible={showYearPicker}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowYearPicker(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowYearPicker(false)}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>اختر السنة الدراسية</Text>
                        <FlatList
                            data={years}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.modalItem,
                                        selectedYear?.id === item.id && styles.selectedModalItem
                                    ]}
                                    onPress={() => {
                                        setSelectedYear(item);
                                        setShowYearPicker(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.modalItemText,
                                        selectedYear?.id === item.id && styles.selectedModalItemText
                                    ]}>
                                        {item.year_name}
                                    </Text>
                                    {item.is_current === 1 && (
                                        <View style={styles.currentBadge}>
                                            <Text style={styles.currentBadgeText}>الحالية</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Semester Picker Modal */}
            <Modal
                visible={showSemesterPicker}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowSemesterPicker(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowSemesterPicker(false)}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>اختر السداسي</Text>
                        <FlatList
                            data={semesters}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.modalItem,
                                        selectedSemester?.id === item.id && styles.selectedModalItem
                                    ]}
                                    onPress={() => {
                                        setSelectedSemester(item);
                                        setShowSemesterPicker(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.modalItemText,
                                        selectedSemester?.id === item.id && styles.selectedModalItemText
                                    ]}>
                                        {item.semester_name}
                                    </Text>
                                    {item.is_current === 1 && (
                                        <View style={styles.currentBadge}>
                                            <Text style={styles.currentBadgeText}>الحالي</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row-reverse',
        paddingHorizontal: SPACING.l,
        marginTop: SPACING.m,
        justifyContent: 'space-between',
    },
    pickerButton: {
        flex: 1,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
        borderRadius: 12,
    },
    pickerText: {
        color: COLORS.white,
        fontWeight: '600',
        fontSize: 14,
        marginRight: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.l,
    },
    modalContent: {
        width: '100%',
        backgroundColor: COLORS.surface,
        borderRadius: 24,
        padding: SPACING.l,
        maxHeight: '60%',
        ...SHADOWS.medium,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: SPACING.m,
        textAlign: 'center',
    },
    modalItem: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    selectedModalItem: {
        backgroundColor: '#F0F9FF',
        marginHorizontal: -SPACING.m,
        paddingHorizontal: SPACING.m,
    },
    modalItemText: {
        fontSize: 16,
        color: COLORS.text,
    },
    selectedModalItemText: {
        color: COLORS.primary,
        fontWeight: 'bold',
    },
    currentBadge: {
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    currentBadgeText: {
        fontSize: 10,
        color: '#166534',
        fontWeight: 'bold',
    },
});
