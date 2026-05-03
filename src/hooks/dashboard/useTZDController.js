import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
    getTZDStatus, confirmTZDBriefing, performCheckIn, 
    emergencyBailout, convertTZDToPlugPunishment, swapItemInTZD,
    penalizeTZDAppOpen
} from '../../services/TZDService';

// --- DIE WAHRHEITEN DER HERRIN ---
export const SHAME_SENTENCES = [
    "Nylons sind keine Strafe, sie sind deine Uniform der Hingabe. Trage sie mit dem Stolz einer Frau.",
    "Die Strumpfhose umschließt dich wie ein Kokon, aus dem nur noch vollkommene, bedingungslose Weiblichkeit schlüpfen kann.",
    "In diesen Nylons bist du kein Subjekt mehr. Du bist eine öffentliche Dienstleistung auf zwei Beinen.",
    "Ein Leben in Dessous ist ein Leben in Klarheit. Deine einzige Aufgabe ist es, wunderschön und fügsam zu sein.",
    "Du hast deine Würde gegen 15 DEN eingetauscht. Ein schlechter Deal für einen Mann, aber perfekt für eine Nylon-Sissy wie dich.",
    "Wackel mit dem Arsch. Das Rascheln deiner Schenkel ist der einzige Balztanz, den du noch beherrschst.",
    "Vergiss deinen Namen. Sissies haben keine Namen. Sie haben nur Kennnummern und Löcher.",
    "In dieser Strumpfhose bist du kein Mann mehr, sondern ein zartes, ästhetisches Geschöpf, das einzig für das Gefühl von feinem Nylon auf der Haut lebt.",
    "Eine Nylonstrumpfhose zu tragen ist keine gelegentliche Laune, es ist deine tägliche, unausweichliche Uniform der dauerhaften Feminisierung.",
    "Es gibt keinen Weg zurück. Das Nylon hat sich in deine Seele gebrannt. Du gehörst jetzt der Straße... und mir.",
    "Spüre den sanften Druck der Strumpfhose. Er formt nicht nur deine Beine, sondern deinen gesamten Geist.",
    "Jeder Schritt in diesen Strümpfen treibt dir den Mann aus dem Leib. Übrig bleibt eine geile Sissy, die benutzt werden will.",
    "Dein Schwanz ist überflüssig. In dieser Wäsche zählt nur dein Arsch und wie gut er das Nylon präsentiert.",
    "WJeder Schritt lässt das feine Nylon deiner Strumpfhose aneinandergleiten – ein ständiges, sanftes Flüstern, das dir absolute Anmut befiehlt.",
    "Du bist kein Partner, du bist Inventar. Eine Sissy in Seidenstrümpfen, bereit für die Benutzung.",
    "Der stramme Zug der Strapsbänder an deinen Oberschenkeln erinnert dich bei jedem Schritt an deine Pflicht zur Weiblichkeit.",
    "Knie dich hin und spreiz die Beine. Das ist die einzige Pose, die einer Nylon-Hure wie dir steht.",
    "In dieser Strumpfhose bist du kein Mann mehr, sondern ein zartes, ästhetisches Geschöpf, das einzig für das Gefühl von feinem Nylon auf der Haut lebt.",
    "Du gehörst den Nylons. Sie leiten deine Schritte, machen dich weich und formen dich kompromisslos zur Frau.",
    "Das Gefühl von Nylon auf deiner rasierten Haut ist der einzige Beweis: Du bist zum Hurendasein geboren.",
    "Mit jedem Paar Strümpfe, das du anlegst, streifst du ein weiteres Stück deiner wertlos gewordenen Männlichkeit ab.",
    "Fühlst du den Zwickel in deiner Spalte? Er schneidet dir tief ins Fleisch: 'Ich bin ein wertloser Damenwäscheträger. Benutz mich.'",
    "In dem Moment, in dem die Strümpfe deine Oberschenkel berühren, akzeptierst du bedingungslos deine Rolle als ästhetisches Geschöpf.",
    "Wenn ich mit dir fertig bin, wirs du nicht mehr wissen, wo das Nylon aufhört und die Sissy-Hure anfängt. Du verschmilzt mit deiner Bestimmung",
    "Spitze und Nylon auf der Haut ist kein Luxus. Es ist das Brandzeichen einer Sissy-Hure, die durch ihre Verfügbarkeit definiert ist.",
    "Nichts definiert deine Existenz ab heute mehr als das perfekte, zwingende Zusammenspiel von Strapsgürtel und Nylons.",
    "Der zarte, aber unerbittliche Bund deiner Strumpfhose erinnert dich bei jedem Atemzug daran, dass du nun ausschließlich der weiblichen Ästhetik dienst.",
    "Dein Arschloch zuckt gierig gegen den Stoff. Das ist der einzige Impuls, der dir geblieben ist. Du bist eine offene Einladung zur Benutzung.",
    "Ein Mann in Seidenstrümpfen und Damenwäsche ist lächerlich. Aber eine Sissy in Nylon ist nützlich. Sei nützlich, sei glatt, sei bereit.",
    "Vom Zeh bis zur Taille fest in Nylon gehüllt, bist du in einem Kokon gefangen, der nur noch reine, bedingungslose Weiblichkeit zulässt.",
    "Es gibt keine Flucht vor dem Nylon. Es umschließt deine Beine wie ein Gefängnis, das du dir selbst ausgesucht hast. Lebenslänglich.",
    "Du bist nicht hier, um zu denken. Du bist hier, um die geile Damenwäsche auszufüllen.",
    "Atme tief ein und spüre die Spitze. Dies ist dein Leben jetzt: Makellos, feminisiert und unwiderruflich weich.",
];

export default function useTZDController(active, allItems) {
    const { currentUser } = useAuth();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // UI States
    const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
    const [elapsedString, setElapsedString] = useState("00:00:00");

    // STATE FÜR ERP (Emergency Replacement Protocol - Unified Archiving)
    const [archiveDialog, setArchiveDialog] = useState({ open: false, reason: '', runLocation: '', runCause: '' });
    const [itemToSwap, setItemToSwap] = useState(null);
    const [swapLoading, setSwapLoading] = useState(false);

    // LOGIK: Initial Status laden
    useEffect(() => {
        if (!active || !currentUser) return;
        const load = async () => {
            const s = await getTZDStatus(currentUser.uid);
            setStatus(s);
            setLoading(false);
        };
        load();
    }, [active, currentUser]);

    // LOGIK: App Visibility Tracking für Präzisions-Eskalation
    useEffect(() => {
        if (!active || !currentUser || !status?.isActive || status?.stage !== 'running') return;

        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                console.log("App in den Vordergrund geholt. Prüfe auf TZD-Strafe...");
                const penalized = await penalizeTZDAppOpen(currentUser.uid);
                if (penalized) {
                    const s = await getTZDStatus(currentUser.uid);
                    setStatus(s);
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [active, currentUser, status?.isActive, status?.stage]);

    // LOGIK: Timer Loop & Check-In (alle 60s)
    useEffect(() => {
        if (!active || !currentUser || !status?.isActive || status?.stage !== 'running') return;

        const interval = setInterval(async () => {
            try {
                const updated = await performCheckIn(currentUser.uid, status);
                if (updated) {
                    if (updated.completed || !updated.isActive) {
                        window.location.reload(); 
                    } else {
                        setStatus(updated);
                    }
                }
            } catch (e) { console.error("TZD Tick Error", e); }
        }, 60000);
        return () => clearInterval(interval);
    }, [active, currentUser, status?.isActive, status?.stage]);

    // UI: Carousel of Shame (alle 20s)
    useEffect(() => {
        if (!active || status?.stage !== 'running') return;
        setCurrentSentenceIndex(Math.floor(Math.random() * SHAME_SENTENCES.length));
        const interval = setInterval(() => {
            setCurrentSentenceIndex(prev => (prev + 1) % SHAME_SENTENCES.length);
        }, 20000); 
        return () => clearInterval(interval);
    }, [active, status?.stage]);

    // UI: Haftzeit-Zähler
    useEffect(() => {
        if (!active || !status?.startTime || status?.stage !== 'running') return;
        
        const timer = setInterval(() => {
            const now = new Date();
            const start = status.startTime.toDate ? status.startTime.toDate() : new Date(status.startTime);
            
            const diff = Math.floor((now - start) / 1000); 
            if (diff < 0) { setElapsedString("00:00:00"); return; }

            const h = Math.floor(diff / 3600).toString().padStart(2, '0');
            const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
            const s = (diff % 60).toString().padStart(2, '0');
            
            setElapsedString(`${h}:${m}:${s}`);
        }, 1000);
        return () => clearInterval(timer);
    }, [active, status?.startTime, status?.stage]);

    // HANDLERS
    
    const handleConfirm = async () => {
        if(!currentUser) return;
        setLoading(true);
        await confirmTZDBriefing(currentUser.uid);
        const s = await getTZDStatus(currentUser.uid);
        setStatus(s);
        setLoading(false);
    };

    const handleGiveUp = async () => {
        if (!window.confirm("ACHTUNG: Abbruch führt zu sofortiger physischer Bestrafung (6h Plug). Fortfahren?")) return;
        
        setLoading(true);
        try {
            const result = await convertTZDToPlugPunishment(currentUser.uid, allItems);
            if (result.success) {
                alert(`TZD beendet. Strafe aktiv: ${result.item}. Anlegen und scannen!`);
                window.location.reload(); 
            } else {
                await emergencyBailout(currentUser.uid);
                window.location.reload();
            }
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    const handleItemClick = (item) => {
        if (status?.stage !== 'running') return;

        setItemToSwap(item);
        setArchiveDialog({ open: true, reason: '', runLocation: '', runCause: '' });
    };

    const handleConfirmSwap = async () => {
        if (!archiveDialog.reason) {
            alert("Das Protokoll erfordert die Auswahl eines Archivierungsgrundes.");
            return;
        }

        setSwapLoading(true);
        try {
            const archiveData = {
                reason: archiveDialog.reason,
                defectLocation: archiveDialog.runLocation,
                defectCause: archiveDialog.runCause
            };

            const result = await swapItemInTZD(currentUser.uid, itemToSwap.id, archiveData, allItems);
            
            if (result.success) {
                alert(`Austausch autorisiert. Defektes Item archiviert.\n\nNEUES ZIEL: ${result.newItemName}\n\nSofort wechseln. TZD läuft weiter.`);
                setArchiveDialog(prev => ({ ...prev, open: false }));
                const s = await getTZDStatus(currentUser.uid);
                setStatus(s);
            } else {
                alert("Fehler beim Austausch: " + (result.error || "Unbekannt"));
            }
        } catch (e) {
            console.error(e);
            alert("Systemfehler.");
        } finally {
            setSwapLoading(false);
        }
    };

    return {
        status,
        loading,
        elapsedString,
        currentSentence: SHAME_SENTENCES[currentSentenceIndex],
        currentSentenceIndex,
        archiveDialog,
        setArchiveDialog,
        itemToSwap,
        swapLoading,
        handleConfirm,
        handleGiveUp,
        handleItemClick,
        handleConfirmSwap
    };
}