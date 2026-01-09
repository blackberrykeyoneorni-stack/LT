import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const generateBackup = async (user) => {
  if (!user) throw new Error("Kein User eingeloggt.");

  const backupData = {
    meta: {
      date: new Date().toISOString(),
      userId: user.uid,
      version: '1.0'
    },
    items: [],
    sessions: [],
    wishlist: [],
    settings: {}
  };

  try {
    // Optimierung: Paralleles Laden für schnellere Ausführung
    const [itemsSnap, sessionsSnap, wishSnap] = await Promise.all([
        getDocs(collection(db, `users/${user.uid}/items`)),
        getDocs(collection(db, `users/${user.uid}/sessions`)),
        getDocs(collection(db, `users/${user.uid}/wishlist`))
    ]);

    backupData.items = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    backupData.sessions = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    backupData.wishlist = wishSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const settingKeys = ['brands', 'categories', 'materials', 'preferences', 'enforcement', 'locations'];
    for (const key of settingKeys) {
      const docSnap = await getDoc(doc(db, `users/${user.uid}/settings/${key}`));
      if (docSnap.exists()) {
        backupData.settings[key] = docSnap.data();
      }
    }

    return backupData;
  } catch (error) {
    console.error("Backup Error:", error);
    throw new Error("Daten konnten nicht geladen werden: " + error.message);
  }
};

export const downloadBackupFile = (data) => {
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `lacetracker_backup_${dateStr}.json`;
  
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  
  document.body.removeChild(link);
  URL.revokeObjectURL(href);
};
