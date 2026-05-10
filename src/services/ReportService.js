import { db } from '../firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc, orderBy } from 'firebase/firestore';

export const generateWeeklyReport = async (userId, lastTargetMinutes) => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sonntag
  
  // Wir schauen zurück auf die Werktage der gerade endenden Woche
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);

  // --- KRANKHEITS-CHECK (Nenner-Korrektur) ---
  const suspensionRef = collection(db, `users/${userId}/suspensions`);
  const suspSnap = await getDocs(query(suspensionRef, where('type', '==', 'sick')));
  
  const sickDays = [];
  suspSnap.forEach(doc => {
    const data = doc.data();
    const start = data.startDate?.toDate ? data.startDate.toDate() : new Date(data.startDate);
    const end = data.endDate?.toDate ? data.endDate.toDate() : new Date(data.endDate);
    
    // Prüfe für jeden Werktag, ob er in eine Krankheits-Suspension fällt
    for (let i = 0; i < 5; i++) {
        const checkDay = new Date(monday);
        checkDay.setDate(monday.getDate() + i);
        if (checkDay >= start && checkDay <= end) {
            sickDays.push(checkDay.toISOString().split('T')[0]);
        }
    }
  });
  const uniqueSickDays = [...new Set(sickDays)];
  const sickDaysCount = uniqueSickDays.length;

  // --- SESSION ABRUF ---
  const q = query(
    collection(db, `users/${userId}/sessions`),
    where('startTime', '>=', monday),
    where('startTime', '<=', friday),
    where('type', '==', 'instruction'),
    orderBy('startTime', 'asc')
  );

  const querySnapshot = await getDocs(q);
  const sessions = querySnapshot.docs.map(doc => doc.data());

  // Initialisierung der Audit-Daten für Mo-Fr
  const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
  const dailyAudit = days.map((name, index) => {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + index);
    const dayStr = dayDate.toISOString().split('T')[0];
    const isSick = uniqueSickDays.includes(dayStr);

    const dayMins = sessions
      .filter(s => {
        // FILTER 1: Nur diesen spezifischen Wochentag
        const sDate = s.startTime?.toDate ? s.startTime.toDate() : new Date(s.startTime);
        if (sDate.toISOString().split('T')[0] !== dayStr) return false;
        
        // FILTER 2: Nacht-Sessions ignorieren (nur Day-Sessions gelten)
        if (s.periodId && s.periodId.toLowerCase().includes('night')) return false;

        return true;
      })
      .reduce((sum, s) => {
          let mins = 0;
          const sStart = s.startTime?.toDate ? s.startTime.toDate() : new Date(s.startTime);
          if (s.endTime) {
              const sEnd = s.endTime?.toDate ? s.endTime.toDate() : new Date(s.endTime);
              mins = (sEnd - sStart) / 60000;
          } else {
              // Session ist noch aktiv
              mins = (now - sStart) / 60000;
          }
          return sum + Math.max(0, Math.round(mins));
      }, 0);

    return { day: name, minutes: dayMins, isSick };
  });

  const totalMinutes = dailyAudit.reduce((sum, d) => sum + d.minutes, 0);
  
  // Der Divisor vermindert sich um die Anzahl der Ausfalltage (Mindestens 1 zur Sicherheit)
  const divisor = Math.max(1, 5 - sickDaysCount);
  const avgMinutes = Math.round(totalMinutes / divisor) || 0;
  
  // --- NEUE VERSCHÄRFTE LOGIK ---
  const validLastTarget = (typeof lastTargetMinutes === 'number' && !isNaN(lastTargetMinutes)) ? lastTargetMinutes : 240;
  let newTarget = validLastTarget;
  
  if (avgMinutes > validLastTarget) {
    // Steigerung: Der Durchschnitt wird das neue Ziel
    newTarget = avgMinutes;
  } else {
    // Stagnation: Altes Ziel bleibt (keine Senkung erlaubt)
    newTarget = validLastTarget;
  }

  // Hardcap bei 12 Stunden (720 Minuten)
  newTarget = Math.min(newTarget, 720);

  const report = {
    weekId: monday.toISOString().split('T')[0],
    generatedAt: new Date(),
    dailyAudit,
    sickDaysCount,
    totalMinutes,
    avgMinutes,
    oldTarget: validLastTarget,
    newTarget,
    success: avgMinutes >= validLastTarget,
    isEscalated: newTarget > validLastTarget,
    acknowledged: false
  };

  await setDoc(doc(db, `users/${userId}/reports`, report.weekId), report);
  
  await setDoc(doc(db, `users/${userId}/status/targets`), {
    dailyTargetMinutes: newTarget,
    lastUpdate: new Date()
  }, { merge: true });

  return report;
};

export const getLatestReport = async (userId) => {
  const q = query(
    collection(db, `users/${userId}/reports`),
    orderBy('generatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0].data();
};