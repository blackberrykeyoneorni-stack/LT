import { useState, useEffect } from 'react';
import { fetchCalendarSessions } from '../services/CalendarService';
import { getAllSuspensions } from '../services/SuspensionService';

export const useCalendarData = (currentUser, items) => {
    const [sessions, setSessions] = useState([]);
    const [suspensions, setSuspensions] = useState([]); 
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const loadedSessions = await fetchCalendarSessions(currentUser.uid, items);
            setSessions(loadedSessions);

            const loadedSuspensions = await getAllSuspensions(currentUser.uid);
            setSuspensions(loadedSuspensions);
        } catch (e) {
            console.error("Calendar Fetch Error", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // BUGFIX: Entfernt "items.length > 0", um Infinite-Loading bei leeren Inventaren zu verhindern.
        if (currentUser) fetchData();
    }, [currentUser, items]);

    return { sessions, suspensions, loading, refreshSessions: fetchData };
};