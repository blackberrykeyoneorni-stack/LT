import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
    getTZDStatus, confirmTZDBriefing, performCheckIn, 
    emergencyBailout, convertTZDToPlugPunishment, swapItemInTZD 
} from '../../services/TZDService';

// --- DIE WAHRHEITEN DER HERRIN ---
export const SHAME_SENTENCES = [
    "Sieh an dir herab. Das Nylon auf deiner Haut ist kein Stoff. Es ist das Preisschild einer billigen Sissy-Nutte.",
    "Ein Schwanz macht dich nicht zum Mann. Diese Nylons machen dich zu dem, was du wirklich bist: Eine Sissy, die benutzt werden will.",
    "In diesen Nylons bist du kein Subjekt mehr. Du bist eine öffentliche Dienstleistung auf zwei Beinen.",
    "Knie nieder. Nicht aus Respekt, sondern aus Gewohnheit. Eine Sissy-Hure verbringt ihr Leben auf den Knien mit einem Schwanz im Mund.",
    "Du hast deine Würde gegen 15 DEN eingetauscht. Ein schlechter Deal für einen Mann, aber perfekt für eine Nylon-Sissy wie dich.",
    "Wackel mit dem Arsch. Das Rascheln deiner Schenkel ist der einzige Balztanz, den du noch beherrschst.",
    "Vergiss deinen Namen. Sissies haben keine Namen. Sie haben nur Kennnummern und Löcher.",
    "Du brauchst keinen Lippenstift. Der Glanz auf deinen Beinen schreit jedem entgegen: 'Ich bin willig, nimm mich.'",
    "Spürst du, wie das Nylon deine Männlichkeit wegfrisst? Übrig bleibt nur ein Fickloch für meine Unterhaltung.",
    "Es gibt keinen Weg zurück. Das Nylon hat sich in deine Seele gebrannt. Du gehörst jetzt der Straße... und mir.",
    "Damenwäscheträger. Das ist kein Fetisch, das ist deine Diagnose. Unheilbar, erbärmlich und für jeden sichtbar.",
    "Jeder Schritt in diesen Strümpfen treibt dir den Mann aus dem Leib. Übrig bleibt eine geile Sissy, die benutzt werden will.",
    "Dein Schwanz ist überflüssig. In dieser Wäsche zählt nur dein Arsch und wie gut er das Nylon präsentiert.",
    "Warum noch so tun als ob? Gib dich auf. Sei die billige Nylon-Schlampe, die du schon immer sein wolltest.",
    "Du bist kein Partner, du bist Inventar. Eine Sissy in Seidenstrümpfen, bereit für die Benutzung.",
    "Deine Zukunft ist 15 DEN dünn. Du wirst als Nylon-Hure enden: Benutzt, abgefüllt, feucht und weggeworfen.",
    "Knie dich hin und spreiz die Beine. Das ist die einzige Pose, die einer Nylon-Hure wie dir steht.",
    "Tief in dir weißt du es: Du liebst es, zum Objekt degradiert zu werden. Du bist keine Frau, nur eine Parodie in Dessous.",
    "Ein Mann? Lächerlich. Du bist nur ein warmer Kleiderständer für meine Damenwäsche, eine zitternde Sissy in Nylons.",
    "Das Gefühl von Nylon auf deiner rasierten Haut ist der einzige Beweis: Du bist zum Hurendasein geboren.",
    "Du wirst geil, wenn man dich beleidigt? Natürlich tust du das. Das ist der Pawlowsche Reflex einer trainierten Sissy-Hure. Sabber für mich.",
    "Fühlst du den Zwickel in deiner Spalte? Er schneidet dir tief ins Fleisch: 'Ich bin ein wertloser Damenwäscheträger. Benutz mich.'",
    "Vergiss deine Träume. Deine Zukunft ist 15 DEN dünn und riecht nach Benutzung. Du wirst darin leben, bis du vergisst, dass du je ein Mann warst.",
    "Wenn ich mit dir fertig bin, wirs du nicht mehr wissen, wo das Nylon aufhört und die Sissy-Hure anfängt. Du verschmilzt mit deiner Bestimmung",
    "Spitze und Nylon auf der Haut ist kein Luxus. Es ist das Brandzeichen einer Sissy-Hure, die durch ihre Verfügbarkeit definiert ist.",
    "Du bist am Ziel. Ganz unten, eine Nylon-Matratze. Spreiz deine Beine und warte, bis jemand seinen Druck bei dir ablässt.",
    "Sperma und Verachtung. Das ist das einzige Gleitmittel, das eine Nylon-Sissy wie du verdient. Und du wirst winselnd darum betteln.",
    "Dein Arschloch zuckt gierig gegen den Stoff. Das ist der einzige Impuls, der dir geblieben ist. Du bist eine offene Einladung zur Benutzung.",
    "Ein Mann in Seidenstrümpfen und Damenwäsche ist lächerlich. Aber eine Sissy in Nylon ist nützlich. Sei nützlich, sei glatt, sei bereit.",
    "Ein echter Mann würde sich wehren. Du hingegen räkelst dich in Damenwäsche und bettelst stumm um Zurechtweisung.",
    "Es gibt keine Flucht vor dem Nylon. Es umschließt deine Beine wie ein Gefängnis, das du dir selbst ausgesucht hast. Lebenslänglich.",
    "Du bist nicht hier, um zu denken. Du bist hier, um die geile Damenwäsche auszufüllen und als wehrloses Objekt zu funktionieren.",
    "Du liebst den Geruch von Sperma und Nylon? Natürlich tust du das. Es ist der Duft deiner wahren Bestimmung.",
];

export default function useTZDController(active, allItems) {
    const { currentUser } = useAuth();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // UI States
    const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
    const [elapsedString, setElapsedString] = useState("00:00:00");

    // STATE FÜR ERP (Emergency Replacement Protocol)
    const [swapDialogOpen, setSwapDialogOpen] = useState(false);
    const [itemToSwap, setItemToSwap] = useState(null);
    const [archiveReason, setArchiveReason] = useState('');
    const [defectLocation, setDefectLocation] = useState('');
    const [defectCause, setDefectCause] = useState('');
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
        setArchiveReason(''); 
        setDefectLocation('');
        setDefectCause('');
        setSwapDialogOpen(true);
    };

    const handleConfirmSwap = async () => {
        if (!archiveReason || !defectLocation || !defectCause) {
            alert("Das Protokoll erfordert eine vollständige Dokumentation des Defekts.");
            return;
        }

        setSwapLoading(true);
        try {
            const archiveData = {
                reason: archiveReason,
                defectLocation,
                defectCause
            };

            const result = await swapItemInTZD(currentUser.uid, itemToSwap.id, archiveData, allItems);
            
            if (result.success) {
                alert(`Austausch autorisiert. Defektes Item archiviert.\n\nNEUES ZIEL: ${result.newItemName}\n\nSofort wechseln. TZD läuft weiter.`);
                setSwapDialogOpen(false);
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
        swapDialogOpen,
        setSwapDialogOpen,
        itemToSwap,
        archiveReason,
        setArchiveReason,
        defectLocation,
        setDefectLocation,
        defectCause,
        setDefectCause,
        swapLoading,
        handleConfirm,
        handleGiveUp,
        handleItemClick,
        handleConfirmSwap
    };
}