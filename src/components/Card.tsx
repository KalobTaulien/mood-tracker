import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { radius, spacing, usePalette } from '../theme';

type Props = {
  title?: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
};

export function Card({ title, subtitle, trailing, children, style }: Props) {
  const palette = usePalette();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.card, borderColor: palette.border },
        style,
      ]}>
      {(title || trailing) && (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {!!title && (
              <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
            )}
            {!!subtitle && (
              <Text style={[styles.subtitle, { color: palette.textMuted }]}>{subtitle}</Text>
            )}
          </View>
          {trailing}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  subtitle: { fontSize: 13, lineHeight: 18 },
});
