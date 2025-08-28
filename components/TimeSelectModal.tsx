// components/TimeSelectModal.tsx

"use client";

import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";

// A shared type for what a "Proposal Block" looks like
// Exporting it here allows other components to use the same type
export type ProposalBlock = {
  start: Date;
  end: Date;
  id: string; // A unique ID for React keys and responses
};

const TimeSelectModal = ({ day, onClose, onSave, existingBlocks }: { day: Date; onClose: () => void; onSave: (newBlocks: ProposalBlock[]) => void; existingBlocks: ProposalBlock[]; }) => {
    const [currentBlocks, setCurrentBlocks] = useState<ProposalBlock[]>(existingBlocks);
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('11:00');

    // Generate time options for the dropdowns
    const timeOptions = useMemo(() => {
        const options = [];
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 30) {
                const hour = h.toString().padStart(2, '0');
                const minute = m.toString().padStart(2, '0');
                options.push(`${hour}:${minute}`);
            }
        }
        return options;
    }, []);

    const handleAddBlock = () => {
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);

        const startDate = new Date(day);
        startDate.setHours(startH, startM, 0, 0);
        
        const endDate = new Date(day);
        endDate.setHours(endH, endM, 0, 0);

        if (endDate <= startDate) {
            alert("End time must be after start time.");
            return;
        }

        const newBlock: ProposalBlock = {
            start: startDate,
            end: endDate,
            id: `proposal_${Date.now()}` // Simple unique ID
        };

        setCurrentBlocks(prev => [...prev, newBlock].sort((a,b) => a.start.getTime() - b.start.getTime()));
    };

    const handleRemoveBlock = (idToRemove: string) => {
        setCurrentBlocks(prev => prev.filter(block => block.id !== idToRemove));
    };

    const handleSave = () => { onSave(currentBlocks); onClose(); };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white text-black p-6 rounded-lg max-w-md w-full">
                <h3 className="text-lg font-bold mb-4">Propose Time Blocks for {format(day, "EEEE, MMM d")}</h3>
                
                <div className="flex items-center gap-2 p-4 border rounded-md">
                    <select value={startTime} onChange={e => setStartTime(e.target.value)} className="p-2 border rounded-md w-full">
                        {timeOptions.map(t => <option key={`start-${t}`} value={t}>{format(parseISO(`2000-01-01T${t}:00`), 'h:mm a')}</option>)}
                    </select>
                    <span>to</span>
                    <select value={endTime} onChange={e => setEndTime(e.target.value)} className="p-2 border rounded-md w-full">
                        {timeOptions.map(t => <option key={`end-${t}`} value={t}>{format(parseISO(`2000-01-01T${t}:00`), 'h:mm a')}</option>)}
                    </select>
                    <button onClick={handleAddBlock} className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-md font-bold text-lg">+</button>
                </div>

                <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                    {currentBlocks.length > 0 ? currentBlocks.map(block => (
                        <div key={block.id} className="flex justify-between items-center bg-gray-100 p-2 rounded">
                            <span className="font-medium">{format(block.start, 'h:mma')} - {format(block.end, 'h:mma')}</span>
                            <button onClick={() => handleRemoveBlock(block.id)} className="text-red-500 hover:text-red-700 font-bold">Remove</button>
                        </div>
                    )) : <p className="text-gray-500 text-center py-4">No time blocks proposed for this day.</p>}
                </div>

                <div className="flex justify-end gap-4 mt-6">
                    <button onClick={onClose} className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded">Cancel</button>
                    <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Save Proposals</button>
                </div>
            </div>
        </div>
    );
};

export default TimeSelectModal;