import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { usePalette } from '@/theme';

export default function TabsLayout() {
  const palette = usePalette();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textFaint,
        tabBarStyle: {
          backgroundColor: palette.card,
          borderTopColor: palette.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: palette.bg },
        headerTitleStyle: { color: palette.text, fontWeight: '600' },
        headerTintColor: palette.accent,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: palette.bg },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Log',
          tabBarIcon: ({ focused, size }) => (
            <Ionicons
              name={focused ? 'add-circle' : 'add-circle-outline'}
              size={size}
              color={focused ? palette.accent : palette.textFaint}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused, size }) => (
            <Ionicons
              name={focused ? 'list' : 'list-outline'}
              size={size}
              color={focused ? palette.accent : palette.textFaint}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: 'Trends',
          tabBarIcon: ({ focused, size }) => (
            <Ionicons
              name={focused ? 'trending-up' : 'trending-up-outline'}
              size={size}
              color={focused ? palette.accent : palette.textFaint}
            />
          ),
        }}
      />
    </Tabs>
  );
}
