// components/DMView.tsx

"use client";

import { useState, useEffect, useMemo } from "react";
import { doc, setDoc, addDoc, collection, updateDoc, deleteDoc, DocumentData } from "firebase/firestore";
import { User } from "firebase/auth";
import { db } from "../lib/firebase";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday, add, isSameDay, parseISO, differenceInMinutes } from "date-fns";
import TimeSelectModal, { ProposalBlock } from "./TimeSelectModal";

const DMView = ({ campaignId, user, allProposals }: { campaignId: string; user: User | null; allProposals: DocumentData[] }) => {
   console.log("1. PROPS: The 'allProposals' prop received by DMView:", allProposals);
    const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
    const [newProposalTitle, setNewProposalTitle] = useState("");
    const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState("");
    const [proposalsByDay, setProposalsByDay] = useState<Record<string, ProposalBlock[]>>({});
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);

    useEffect(() => {
        if (selectedProposalId) {
            const selected = allProposals.find(p => p.id === selectedProposalId);
            if (selected?.proposalBlocks) {
                const loadedBlocks: Record<string, ProposalBlock[]> = {};
                for (const dayKey in selected.proposalBlocks) {
                    loadedBlocks[dayKey] = selected.proposalBlocks[dayKey].map((block: any) => ({
                        ...block,
                        start: block.start.toDate(),
                        end: block.end.toDate(),
                    }));
                }
                setProposalsByDay(loadedBlocks);
                console.log("2. EFFECT: Set proposalsByDay after selecting a proposal:", loadedBlocks);
            } else {
                setProposalsByDay({});
            }
        } else {
            setProposalsByDay({});
        }
    }, [selectedProposalId, allProposals]);

    // --- THIS LOGIC CREATES THE TEXT INDICATORS ---
    const timeRangesByDay = useMemo(() => {
        const textMap = new Map<string, string[]>();
        for (const dayKey in proposalsByDay) {
            const blocks = proposalsByDay[dayKey].sort((a, b) => a.start.getTime() - b.start.getTime());
            if (blocks.length === 0) continue;
            const ranges = blocks.map(block => `${format(block.start, 'h:mma')}-${format(block.end, 'h:mma')}`.replace(':00','').toLowerCase());
            textMap.set(dayKey, ranges);
        }
        return textMap;
    }, [proposalsByDay]);

    const responseCounts = useMemo(() => {
        const counts = new Map<string, number>();
        const selected = allProposals.find(p => p.id === selectedProposalId);
        if (!selected?.responses) return counts;
        Object.values(selected.responses).forEach((response: any) => {
            Object.keys(response).forEach(proposalId => {
                if (response[proposalId]) {
                    counts.set(proposalId, (counts.get(proposalId) || 0) + 1);
                }
            });
        });
        return counts;
    }, [selectedProposalId, allProposals]);
    
    const allTimeBlocksInProposal = useMemo(() => 
        (Object.values(proposalsByDay).flat() as ProposalBlock[]).sort((a,b) => a.start.getTime() - b.start.getTime())
    , [proposalsByDay]);

    const handleCreateProposal = async () => { /* ... unchanged ... */ };
    const handleSaveProposals = async () => { /* ... unchanged ... */ };
    const handleFinalizeSession = async (proposal: ProposalBlock) => { /* ... unchanged ... */ };
    const handleDeleteProposal = async (proposalId: string, proposalTitle: string) => { /* ... unchanged ... */ };
    const handleStartRename = (proposal: DocumentData) => { /* ... unchanged ... */ };
    const handleSaveRename = async (proposalId: string) => { /* ... unchanged ... */ };
    const daysInMonth = useMemo(() => eachDayOfInterval({ start: startOfWeek(startOfMonth(currentMonth)), end: endOfWeek(endOfMonth(currentMonth)) }), [currentMonth]);
    const handleDayClick = (day: Date) => { setSelectedDay(day); setIsModalOpen(true); };
    const handleSaveBlocksForDay = (newBlocks: ProposalBlock[]) => {
        if (!selectedDay) return;
        const dayKey = format(selectedDay, 'yyyy-MM-dd');
        setProposalsByDay(prev => ({ ...prev, [dayKey]: newBlocks }));
    };
 console.log("3. RENDER: The final 'timeRangesByDay' map before rendering:", timeRangesByDay);
 
    return (
        <div className="w-full max-w-7xl mt-8 grid md:grid-cols-3 gap-8">
            {/* --- Left Panel for Management (unchanged) --- */}
            <div className="md:col-span-1 bg-white text-black p-6 rounded-lg shadow-lg h-fit">
                { /* ... */ }
            </div>

            {/* --- Right Panel for Details --- */}
            <div className="md:col-span-2">
                {selectedProposalId ? (
                    <div className="space-y-8">
                        <div className="bg-white text-black p-4 rounded-lg shadow-lg">
                            <p className="text-lg font-bold mb-4">Editing Times for: <span className="text-blue-600">{allProposals.find(p => p.id === selectedProposalId)?.title}</span></p>
                            <div className="flex justify-between items-center mb-4">
                                <button onClick={() => setCurrentMonth(add(currentMonth, { months: -1 }))} className="font-bold text-lg p-2">&lt;</button>
                                <h2 className="text-xl font-bold">{format(currentMonth, "MMMM yyyy")}</h2>
                                <button onClick={() => setCurrentMonth(add(currentMonth, { months: 1 }))} className="font-bold text-lg p-2">&gt;</button>
                            </div>
                            <div className="grid grid-cols-7 text-center font-bold text-sm">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d} className="p-2">{d}</div>)}</div>
                            <div className="grid grid-cols-7 gap-1">
                                {daysInMonth.map(day => {
                                    const dayKey = format(day, 'yyyy-MM-dd');
                                    // This line gets the text for the current day
                                    const timeRanges = timeRangesByDay.get(dayKey);
                                    return (<div key={day.toString()} onClick={() => handleDayClick(day)} className={`pt-1 h-28 border rounded cursor-pointer flex flex-col items-center justify-start relative text-sm ${!isSameMonth(day, currentMonth) ? "text-gray-400 bg-gray-50" : "bg-white"} ${isToday(day) ? "border-2 border-blue-500" : ""} hover:bg-blue-100`}>
                                        <span className={`font-medium ${isToday(day) ? 'text-blue-600' : ''}`}>{format(day, "d")}</span>
                                        
                                        {/* This block renders the text indicators */}
                                        {timeRanges && timeRanges.length > 0 && (
                                            <div className="text-center text-green-800 text-[10px] font-semibold p-1 rounded-md w-full mt-1 overflow-y-auto">
                                                {timeRanges.map(range => <div key={range}>{range}</div>)}
                                            </div>
                                        )}
                                    </div>);
                                })}
                            </div>
                            <div className="text-center mt-6"><button onClick={handleSaveProposals} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded">Save Times for This Proposal</button></div>
                            {isModalOpen && selectedDay && <TimeSelectModal day={selectedDay} onClose={() => setIsModalOpen(false)} onSave={handleSaveBlocksForDay} existingBlocks={proposalsByDay[format(selectedDay, 'yyyy-MM-dd')] || []} />}
                        </div>
                        {/* Player Responses section (unchanged) */}
                        <div className="bg-white text-black p-6 rounded-lg shadow-lg">
                            { /* ... */ }
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-white bg-gray-700 p-8 rounded-lg h-full flex items-center justify-center">
                        <p className="text-xl">Please select or create a proposal on the left to begin.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DMView;