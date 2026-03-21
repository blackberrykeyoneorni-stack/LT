import { useCallback, useMemo } from 'react';
import { useItems } from '../../contexts/ItemContext';
import useUIStore from '../../store/uiStore';

/**
 * useDashboardActions
 * Kapselt die Interaktionslogik für den Wäschekorb und Item-Status-Änderungen,
 * um die Dashboard.jsx übersichtlich zu halten.
 */
export const useDashboardActions = () => {
  const { items, updateItem } = useItems();
  const showToast = useUIStore(s => s.showToast);
  const setLaundryOpen = useUIStore(s => s.setLaundryOpen);

  // Filtert die Items für den Wäschekorb
  const washingItems = useMemo(() => 
    (items || []).filter(item => item.status === 'washing'),
    [items]
  );

  // Einzelnes Item waschen
  const handleWashItem = useCallback(async (itemId) => {
    try {
      await updateItem(itemId, { status: 'active' });
      showToast("Item ist wieder einsatzbereit.", "success");
    } catch (e) {
      console.error("Fehler beim Waschen des Items:", e);
      showToast("Fehler beim Waschen.", "error");
    }
  }, [updateItem, showToast]);

  // Alle Items im Wäschekorb waschen
  const handleWashAll = useCallback(async () => {
    if (washingItems.length === 0) return;
    try {
      const promises = washingItems.map(item => updateItem(item.id, { status: 'active' }));
      await Promise.all(promises);
      showToast("Wäschekorb vollständig geleert.", "success");
      setLaundryOpen(false);
    } catch (e) {
      console.error("Fehler beim Leeren des Wäschekorbs:", e);
      showToast("Fehler beim Waschen aller Items.", "error");
    }
  }, [washingItems, updateItem, showToast, setLaundryOpen]);

  return {
    washingItems,
    handleWashItem,
    handleWashAll
  };
};