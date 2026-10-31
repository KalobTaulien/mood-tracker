import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { blankForm, type FormDefinition, type FormField } from '@/forms';
import { hasForm, loadForm, saveForm } from '@/store';

/**
 * The one form definition, shared across every screen.
 *
 * It is read once at startup and kept in context rather than re-queried per
 * screen, because the Log tab, History, Trends and the builder all need the
 * same field list and all of them must see an edit immediately.
 */

type FormContextValue = {
  form: FormDefinition;
  /** Fields the Log tab should render: in order, archived ones removed. */
  visibleFields: FormField[];
  /** Null while loading; false when onboarding has not chosen a form yet. */
  configured: boolean | null;
  save: (next: FormDefinition) => Promise<void>;
  reload: () => Promise<void>;
};

const FormContext = createContext<FormContextValue | null>(null);

export function FormProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [form, setForm] = useState<FormDefinition>(blankForm);
  const [configured, setConfigured] = useState<boolean | null>(null);

  const reload = useCallback(async () => {
    const [exists, loaded] = await Promise.all([hasForm(db), loadForm(db)]);
    setForm(loaded);
    setConfigured(exists);
  }, [db]);

  useEffect(() => {
    // `reload` is async: every setState inside it runs in a promise
    // continuation, not synchronously in this effect body. Reading the form
    // document on mount is exactly the "subscribe to an external system" case
    // the rule exists to allow, but it cannot see through the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const save = useCallback(
    async (next: FormDefinition) => {
      await saveForm(db, next);
      // Read back rather than trusting `next`: saving normalizes, and every
      // screen should see exactly what is on disk.
      await reload();
    },
    [db, reload]
  );

  const value = useMemo<FormContextValue>(
    () => ({
      form,
      visibleFields: form.fields.filter((field) => !field.archived),
      configured,
      save,
      reload,
    }),
    [form, configured, save, reload]
  );

  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
}

export function useForm(): FormContextValue {
  const value = useContext(FormContext);
  if (!value) throw new Error('useForm must be used inside <FormProvider>');
  return value;
}
