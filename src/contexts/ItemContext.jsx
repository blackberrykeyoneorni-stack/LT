import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const ItemContext = createContext();

export function useItems() {
  return useContext(ItemContext);
}

export function ItemProvider({ children }) {
  const { currentUser } = useAuth();
  
  // WICHTIG: Initialisiere immer als leeres Array [], niemals als null!
  // Das verhindert den "Black Screen", wenn Komponenten .map() versuchen.
  const [items, setItems] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Wenn kein User da ist, alles zurücksetzen, aber nicht crashen
    if (!currentUser) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log("ItemContext: Starte Listener für", currentUser.uid);

    try {
        const itemsRef = collection(db, 'users', currentUser.uid, 'items');
        const q = query(itemsRef);

        // Der Snapshot-Listener hält die Verbindung live
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const newItems = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          console.log("ItemContext: Daten erhalten. Anzahl:", newItems.length);
          setItems(newItems);
          setLoading(false);
          setError(null); // Vorherige Fehler löschen
        }, (err) => {
          console.error("ItemContext Fehler:", err);
          setError(err.message);
          setLoading(false);
          // WICHTIG: Bei Fehler leeres Array lassen, damit UI nicht abstürzt
          setItems([]); 
        });

        return unsubscribe;

    } catch (err) {
        console.error("ItemContext Setup Fehler:", err);
        setError(err.message);
        setLoading(false);
    }
  }, [currentUser]);

  // CRUD Operationen (Bleiben gleich)
  const addItem = async (itemData, customId = null) => {
    if (!currentUser) return;
    const itemsRef = collection(db, 'users', currentUser.uid, 'items');
    
    if (customId) {
        await setDoc(doc(itemsRef, customId), {
            ...itemData,
            createdAt: serverTimestamp()
        });
    } else {
        const newDocRef = doc(itemsRef);
        await setDoc(newDocRef, {
            ...itemData,
            createdAt: serverTimestamp()
        });
    }
  };

  const deleteItem = async (id) => {
     if (!currentUser) return;
     await deleteDoc(doc(db, 'users', currentUser.uid, 'items', id));
  };

  const updateItem = async (id, data) => {
      if (!currentUser) return;
      await updateDoc(doc(db, 'users', currentUser.uid, 'items', id), data);
  };

  const value = {
    items,
    loading,
    error,
    addItem,
    deleteItem,
    updateItem
  };

  return (
    <ItemContext.Provider value={value}>
      {children}
    </ItemContext.Provider>
  );
}
