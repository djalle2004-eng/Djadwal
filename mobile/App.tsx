import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { User, Group } from './src/types/shared';
import LoginScreen from './src/screens/LoginScreen';
import StudentScreen from './src/screens/StudentScreen';
import ProfessorScreen from './src/screens/ProfessorScreen';
import GroupSelectionScreen from './src/screens/GroupSelectionScreen';
import HeadScreen from './src/screens/HeadScreen';
import SpecializationScheduleScreen from './src/screens/SpecializationScheduleScreen';
import AvailableRoomsScreen from './src/screens/AvailableRoomsScreen';
import CompensationsScreen from './src/screens/CompensationsScreen';
import ProfessorSearchScreen from './src/screens/ProfessorSearchScreen';

export type RootStackParamList = {
  Login: undefined;
  Student: { group: Group };
  Professor: { user: User };
  GroupSelection: undefined;
  Head: { user: User };
  SpecializationSchedule: { year: any, semester: any };
  AvailableRooms: { year: any, semester: any };
  Compensations: { year: any, semester: any };
  ProfessorSearch: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="GroupSelection" component={GroupSelectionScreen} />
        <Stack.Screen name="Student" component={StudentScreen} />
        <Stack.Screen name="Professor" component={ProfessorScreen} />
        <Stack.Screen name="Head" component={HeadScreen} />
        <Stack.Screen name="SpecializationSchedule" component={SpecializationScheduleScreen} />
        <Stack.Screen name="AvailableRooms" component={AvailableRoomsScreen} />
        <Stack.Screen name="Compensations" component={CompensationsScreen} />
        <Stack.Screen name="ProfessorSearch" component={ProfessorSearchScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
