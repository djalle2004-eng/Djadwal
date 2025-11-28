import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// تعريف الأنماط
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
    fontFamily: 'Helvetica',
  },
  header: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
    color: '#000000',
  },
  section: {
    margin: 10,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottom: 1,
    borderBottomColor: '#000000',
  },
  label: {
    fontSize: 12,
    color: '#666666',
  },
  value: {
    fontSize: 12,
    color: '#000000',
  },
});

interface AssignmentPDFProps {
  assignment: {
    professor_name: string;
    course_name: string;
    group_name: string;
    room_name: string;
    assignment_day: string;
    lecture_time: string;
    academic_year: string;
    semester: string;
  };
}

export const AssignmentPDF: React.FC<AssignmentPDFProps> = ({ assignment }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>تفاصيل التكليف</Text>
      
      <View style={styles.section}>
        <Text style={styles.label}>الأستاذ:</Text>
        <Text style={styles.value}>{assignment.professor_name}</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.label}>المادة:</Text>
        <Text style={styles.value}>{assignment.course_name}</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.label}>المجموعة:</Text>
        <Text style={styles.value}>{assignment.group_name}</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.label}>القاعة:</Text>
        <Text style={styles.value}>{assignment.room_name}</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.label}>اليوم:</Text>
        <Text style={styles.value}>{assignment.assignment_day}</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.label}>التوقيت:</Text>
        <Text style={styles.value}>{assignment.lecture_time}</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.label}>السنة الأكاديمية:</Text>
        <Text style={styles.value}>{assignment.academic_year}</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.label}>الفصل الدراسي:</Text>
        <Text style={styles.value}>{assignment.semester}</Text>
      </View>
    </Page>
  </Document>
); 