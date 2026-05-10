import { useCallback, useMemo } from 'react';
import { useItems } from '../../contexts/ItemContext';
import useUIStore from '../../store/uiStore';
import { useAuth } from '../../contexts/AuthContext';
import { clearInflationNotice } from '../../services/TimeBankService';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { addItemHistoryEntry } from '../../services/ItemService';

/**
 * useDashboardActions
 * Kapselt die Interaktionslogik für den Wäschekorb und Item-Status-Änderungen,
 * um die Dashboard.jsx übersichtlich zu halten.
 */
export const useDashboardActions = () => {
  const { items, updateItem } = useItems();
  const showToast = useUIStore(s => s.showToast);
  const setLaundryOpen = useUIStore(s => s.setLaundryOpen);
  const { currentUser } = useAuth();

  // Filtert die Items für den Wäschekorb
  const washingItems = useMemo(() => 
    (items || []).filter(item => item.status === 'washing'),
    [items]
  );

  // Einzelnes Item waschen
  const handleWashItem = useCallback(async (itemId) => {
    try {
      await updateItem(itemId, { status: 'active' });
      
      // NEU: Historien-Eintrag für den abgeschlossenen Waschgang
      if (currentUser) {
          await addItemHistoryEntry(currentUser.uid, itemId, {
              type: 'WASHED',
              message: 'Reinigung abgeschlossen. Item wieder einsatzbereit.'
          });
      }

      showToast("Item ist wieder einsatzbereit.", "success");
    } catch (e) {
      console.error("Fehler beim Waschen des Items:", e);
      showToast("Fehler beim Waschen.", "error");
    }
  }, [updateItem, showToast, currentUser]);

  // Alle Items im Wäschekorb waschen
  const handleWashAll = useCallback(async () => {
    if (washingItems.length === 0) return;
    try {
      const promises = washingItems.map(async (item) => {
          await updateItem(item.id, { status: 'active' });
          
          // NEU: Historien-Eintrag für jedes gewaschene Item
          if (currentUser) {
              await addItemHistoryEntry(currentUser.uid, item.id, {
                  type: 'WASHED',
                  message: 'Reinigung abgeschlossen. Item wieder einsatzbereit.'
              });
          }
      });
      
      await Promise.all(promises);
      showToast("Wäschekorb vollständig geleert.", "success");
      setLaundryOpen(false);
    } catch (e) {
      console.error("Fehler beim Leeren des Wäschekorbs:", e);
      showToast("Fehler beim Waschen aller Items.", "error");
    }
  }, [washingItems, updateItem, showToast, setLaundryOpen, currentUser]);

  // Tribut bestätigen und Notification löschen
  const handleAcknowledgeInflation = useCallback(async () => {
    if (!currentUser) return;
    try {
        await clearInflationNotice(currentUser.uid);
        showToast("Tribut akzeptiert. Salden aktualisiert.", "success");
    } catch (e) {
        console.error("Fehler beim Bestätigen des Tributs:", e);
        showToast("Netzwerkfehler beim Quittieren.", "error");
    }
  }, [currentUser, showToast]);

  // Wochenbericht bestätigen
  const handleAcknowledgeReport = useCallback(async (report) => {
    if (!currentUser || !report || !report.weekId) return;
    try {
        await updateDoc(doc(db, `users/${currentUser.uid}/reports/${report.weekId}`), {
            acknowledged: true
        });
        showToast("Wochen-Audit bestätigt.", "success");
    } catch (e) {
        console.error("Fehler beim Bestätigen des Berichts:", e);
        showToast("Netzwerkfehler.", "error");
    }
  }, [currentUser, showToast]);

  return {
    washingItems,
    handleWashItem,
    handleWashAll,
    handleAcknowledgeInflation,
    handleAcknowledgeReport
  };
};