// components/FinalizedSessionView.tsx

"use client";

import { doc, updateDoc, DocumentData } from "firebase/firestore";
import { db } from "../lib/firebase";
import { format } from "date-fns";

const FinalizedSessionView = ({ campaignId, campaign, isDM }: { campaignId: string; campaign: DocumentData; isDM: boolean; }) => {
    const { finalizedSession } = campaign;
    const start = finalizedSession.start.toDate();

    const handleScheduleNew = async () => {
        if (!window.confirm("Are you sure you want to clear this schedule and propose new times?")) return;

        const campaignRef = doc(db, "campaigns", campaignId);
        try {
            await updateDoc(campaignRef, {
                finalizedSession: null // Or FieldValue.delete()
            });
            // A more advanced implementation could also clear the old proposals/responses
            window.location.reload();
        } catch (error) {
            console.error("Error clearing schedule:", error);
            alert("Could not clear the schedule.");
        }
    };

    return (
        <div className="w-full max-w-2xl mt-8 bg-green-800 text-white p-8 rounded-lg shadow-lg text-center">
            <h2 className="text-2xl font-bold mb-2">Session Confirmed!</h2>
            <p className="text-green-200 mb-4">The next session is locked in. See you there!</p>
            <div className="bg-white text-black p-4 rounded-md">
                <p className="text-xl font-bold">{format(start, "EEEE, MMMM d")}</p>
                <p className="text-lg">{format(start, "h:mm a")}</p>
            </div>
            {isDM && (
                <button
                    onClick={handleScheduleNew}
                    className="mt-6 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded"
                >
                    Schedule a New Session
                </button>
            )}
        </div>
    );
};

export default FinalizedSessionView;
