import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Download, AlertTriangle } from 'lucide-react-native';

interface ForceUpdateModalProps {
    visible: boolean;
    onUpdate: () => void;
}

export default function ForceUpdateModal({ visible, onUpdate }: ForceUpdateModalProps) {
    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade">
            <View style={styles.container}>
                <View style={styles.modalContent}>
                    <View style={styles.iconContainer}>
                        <AlertTriangle color="#ef4444" size={50} />
                    </View>

                    <Text style={styles.title}>تحديث إلزامي مطلوب</Text>

                    <Text style={styles.description}>
                        الإصدار الحالي من التطبيق لم يعد مدعوماً. يرجى تحميل النسخة الجديدة لمتابعة استخدام البرنامج وضمان استقرار البيانات.
                    </Text>

                    <TouchableOpacity style={styles.updateButton} onPress={onUpdate}>
                        <Download color="white" size={24} />
                        <Text style={styles.updateButtonText}>تحديث الآن</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        width: '100%',
        maxWidth: 400,
        borderRadius: 24,
        padding: 30,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#fef2f2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 15,
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 35,
    },
    updateButton: {
        backgroundColor: '#2563eb',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        paddingHorizontal: 25,
        borderRadius: 16,
        width: '100%',
    },
    updateButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 12,
    },
});
