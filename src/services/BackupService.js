import { collection, getDocs, doc, getDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const generateBackup = async (userId) => {
  if (!userId) throw new Error("Kein User-ID übergeben.");

  const backupData = {
    meta: {
      date: new Date().toISOString(),
      userId: userId,
      version: '2.0'
    },
    collections: {
      items: [],
      sessions: [],
      wishlist: [],
      suspensions: []
    },
    settings: {},
    status: {}
  };

  try {
    const [itemsSnap, sessionsSnap, wishSnap, suspSnap] = await Promise.all([
        getDocs(collection(db, `users/${userId}/items`)),
        getDocs(collection(db, `users/${userId}/sessions`)),
        getDocs(collection(db, `users/${userId}/wishlist`)),
        getDocs(collection(db, `users/${userId}/suspensions`))
    ]);

    backupData.collections.items = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    backupData.collections.sessions = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    backupData.collections.wishlist = wishSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    backupData.collections.suspensions = suspSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const settingKeys = ['brands', 'categories', 'materials', 'preferences', 'enforcement', 'locations', 'locationIndex', 'archiveReasons', 'runLocations', 'runCauses', 'protocol', 'budget'];
    for (const key of settingKeys) {
      const docSnap = await getDoc(doc(db, `users/${userId}/settings/${key}`));
      if (docSnap.exists()) {
        backupData.settings[key] = docSnap.data();
      }
    }

    const statusKeys = ['timeBank', 'punishment', 'dailyInstruction'];
    for (const key of statusKeys) {
      const docSnap = await getDoc(doc(db, `users/${userId}/status/${key}`));
      if (docSnap.exists()) {
        backupData.status[key] = docSnap.data();
      }
    }

    return backupData;
  } catch (error) {
    console.error("Backup Error:", error);
    throw new Error("Daten konnten nicht geladen werden: " + error.message);
  }
};

export const downloadBackupFile = (data) => {
  const d = new Date();
  const pad = n => (n < 10 ? '0' + n : n);
  
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  const fileName = `${dateStr}_BackupLacetracker.json`;
  
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

const reviveTimestamps = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (typeof obj.seconds === 'number' && typeof obj.nanoseconds === 'number' && Object.keys(obj).length === 2) {
        return new Timestamp(obj.seconds, obj.nanoseconds);
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => reviveTimestamps(item));
    }
    
    const revived = {};
    for (const key in obj) {
        revived[key] = reviveTimestamps(obj[key]);
    }
    return revived;
};

export const restoreBackup = async (userId, backupData) => {
  if (!userId) throw new Error("Kein User-ID übergeben.");
  
  if (!backupData || !backupData.meta || !backupData.collections) {
    throw new Error("Ungültiges oder beschädigtes Backup-Format.");
  }

  try {
    const revivedData = reviveTimestamps(backupData);
    const operations = []; 
    
    for (const [colName, docs] of Object.entries(revivedData.collections)) {
      for (const item of docs) {
        const { id, ...data } = item;
        if (id) {
          operations.push({
            ref: doc(db, `users/${userId}/${colName}/${id}`),
            data: data
          });
        }
      }
    }

    if (revivedData.settings) {
      for (const [key, data] of Object.entries(revivedData.settings)) {
         operations.push({
            ref: doc(db, `users/${userId}/settings/${key}`),
            data: data
         });
      }
    }

    if (revivedData.status) {
      for (const [key, data] of Object.entries(revivedData.status)) {
         operations.push({
            ref: doc(db, `users/${userId}/status/${key}`),
            data: data
         });
      }
    }

    const chunkSize = 450;
    for (let i = 0; i < operations.length; i += chunkSize) {
      const chunk = operations.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      
      chunk.forEach(op => {
        batch.set(op.ref, op.data); 
      });
      
      await batch.commit();
    }

    return true;
  } catch (error) {
    console.error("Restore Error:", error);
    throw new Error("Fehler beim Einspielen: " + error.message);
  }
};