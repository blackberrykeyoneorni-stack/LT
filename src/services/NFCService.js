export const isNfcSupported = () => 'NDEFReader' in window;

class NFCScanner {
    constructor() {
        this.reader = null;
        this.abortController = null;
    }

    async startScan(onReading, onError) {
        if (!isNfcSupported()) {
            if (onError) onError(new Error("NFC nicht unterstützt."));
            return;
        }

        // Vorherigen Scan abbrechen
        this.stopScan();
        this.abortController = new AbortController();

        try {
            this.reader = new window.NDEFReader();
            await this.reader.scan({ signal: this.abortController.signal });

            this.reader.onreading = (event) => {
                const { serialNumber, message } = event;
                let finalId = serialNumber; 

                // Falls wir eine Text-ID auf den Tag geschrieben haben, nutzen wir diese vorrangig
                if (message && message.records && message.records.length > 0) {
                    const record = message.records[0];
                    if (record.recordType === "text") {
                        const decoder = new TextDecoder();
                        finalId = decoder.decode(record.data);
                    }
                }

                // Vibration für haptisches Feedback (nur Android)
                if (navigator.vibrate) navigator.vibrate(200);

                onReading({ id: finalId, serial: serialNumber });
            };

            this.reader.onreadingerror = () => {
                if (onError) onError(new Error("Lesefehler. Tag ruhig halten."));
            };

        } catch (error) {
            if (onError) onError(error);
        }
    }

    stopScan() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.reader = null;
    }

    async writeTag(text) {
        if (!isNfcSupported()) throw new Error("NFC nicht unterstützt.");
        try {
            const writer = new window.NDEFReader();
            await writer.write(text);
            return true;
        } catch (error) {
            throw error;
        }
    }
}

export const nfcService = new NFCScanner();
