import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useForm } from '@/hooks/useForm';
import { usePalette } from '@/theme';

export default function TabsLayout() {
  const palette = usePalette();
  const { configured } = useForm();

  // Null means the form document has not been read yet. Rendering nothing for
  // that frame avoids flashing an empty Log tab before onboarding takes over.
  if (configured === null) return null;
  if (!configured) return <Redirect href="/onboarding" />;

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
