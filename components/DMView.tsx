// components/DMView.tsx

"use client";

import { useState, useEffect, useMemo } from "react";
import { doc, setDoc, addDoc, collection, updateDoc, deleteDoc, DocumentData } from "firebase/firestore";
import { User } from "firebase/auth";
import { db } from "../lib/firebase";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday, add, isSameDay, parseISO } from "date-fns";
import TimeSelectModal, { ProposalBlock } from "./TimeSelectModal";

const DMView = ({ campaignId, user, allProposals }: { campaignId: string; user: User | null; allProposals: DocumentData[] }) => {
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
            } else {
                setProposalsByDay({});
            }
        } else {
            setProposalsByDay({});
        }
    }, [selectedProposalId, allProposals]);

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

    const handleCreateProposal = async () => {
        if (!newProposalTitle.trim() || !user) return;
        const newProposalRef = await addDoc(collection(db, "campaigns", campaignId, "proposals"), {
            title: newProposalTitle,
            dmId: user.uid,
            createdAt: new Date(),
            proposalBlocks: {},
            responses: {}
        });
        setNewProposalTitle("");
        setSelectedProposalId(newProposalRef.id);
        alert(`Proposal "${newProposalTitle}" created!`);
        window.location.reload();
    };

    const handleSaveProposals = async () => {
        if (!user || !selectedProposalId) { alert("Please select a proposal to save."); return; }
        const proposalRef = doc(db, "campaigns", campaignId, "proposals", selectedProposalId);
        await setDoc(proposalRef, { proposalBlocks: proposalsByDay }, { merge: true });
        alert("Proposal times saved!");
    };

    const handleFinalizeSession = async (proposal: ProposalBlock) => {
        if (!user || !window.confirm(`Finalize this session for ${format(proposal.start, "MMM d 'at' h:mma")}?`)) return;
        const campaignRef = doc(db, "campaigns", campaignId);
        try {
            await updateDoc(campaignRef, { finalizedSession: { start: proposal.start, end: proposal.end, id: proposal.id }});
            alert("Session finalized!");
            window.location.reload();
        } catch (error) {
            console.error("Error finalizing session:", error);
            alert("Could not finalize the session.");
        }
    };

    const handleDeleteProposal = async (proposalId: string, proposalTitle: string) => {
        if (!window.confirm(`Are you sure you want to permanently delete the proposal "${proposalTitle}"? This cannot be undone.`)) return;
        
        try {
            const proposalRef = doc(db, "campaigns", campaignId, "proposals", proposalId);
            await deleteDoc(proposalRef);
            alert("Proposal deleted.");
            if (selectedProposalId === proposalId) {
                setSelectedProposalId(null);
            }
            window.location.reload();
        } catch (error) {
            console.error("Error deleting proposal: ", error);
            alert("Could not delete proposal.");
        }
    };

    const handleStartRename = (proposal: DocumentData) => {
        setEditingProposalId(proposal.id);
        setEditingTitle(proposal.title);
    };

    const handleSaveRename = async (proposalId: string) => {
        if (!editingTitle.trim()) {
            setEditingProposalId(null);
            return;
        };
        const proposalRef = doc(db, "campaigns", campaignId, "proposals", proposalId);
        try {
            await updateDoc(proposalRef, { title: editingTitle });
            setEditingProposalId(null);
            window.location.reload();
        } catch (error) {
            console.error("Error renaming proposal: ", error);
            alert("Could not rename proposal.");
        }
    };
    
    const daysInMonth = useMemo(() => eachDayOfInterval({ start: startOfWeek(startOfMonth(currentMonth)), end: endOfWeek(endOfMonth(currentMonth)) }), [currentMonth]);
    const handleDayClick = (day: Date) => { setSelectedDay(day); setIsModalOpen(true); };
    const handleSaveBlocksForDay = (newBlocks: ProposalBlock[]) => {
        if (!selectedDay) return;
        const dayKey = format(selectedDay, 'yyyy-MM-dd');
        setProposalsByDay(prev => ({ ...prev, [dayKey]: newBlocks }));
    };

    return (
        <div className="w-full max-w-7xl mt-8 grid md:grid-cols-3 gap-8">
            <div className="md:col-span-1 bg-white text-black p-6 rounded-lg shadow-lg h-fit">
                <h2 className="text-2xl font-bold mb-4">Proposals</h2>
                <div className="space-y-3 mb-6">
                    {allProposals.map(p => (
                        <div key={p.id} className={`p-2 border rounded-md transition-all ${selectedProposalId === p.id ? 'bg-blue-100 border-blue-400' : ''}`}>
                            {editingProposalId === p.id ? (
                                <input 
                                    type="text"
                                    value={editingTitle}
                                    onChange={e => setEditingTitle(e.target.value)}
                                    onBlur={() => handleSaveRename(p.id)}
                                    onKeyDown={e => e.key === 'Enter' && handleSaveRename(p.id)}
                                    className="w-full p-1 border rounded-md"
                                    autoFocus
                                />
                            ) : (
                                <p className="font-semibold break-words">{p.title}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                                <button onClick={() => setSelectedProposalId(p.id)} className="w-full px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">Select</button>
                                <button onClick={() => handleStartRename(p)} className="px-3 py-1 text-sm bg-yellow-400 hover:bg-yellow-500 rounded">Rename</button>
                                <button onClick={() => handleDeleteProposal(p.id, p.title)} className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded">Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="border-t pt-4">
                    <h3 className="text-lg font-bold mb-2">Create New</h3>
                    <div className="flex flex-col gap-2">
                         <input
                            id="new-proposal"
                            type="text"
                            value={newProposalTitle}
                            onChange={e => setNewProposalTitle(e.target.value)}
                            placeholder="e.g., Session 6"
                            className="block w-full p-2 border border-gray-300 rounded-md"
                        />
                        <button onClick={handleCreateProposal} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full">Create</button>
                    </div>
                </div>
            </div>

            <div className="md:col-span-2">
                {selectedProposalId ? (
                    <div className="space-y-8">
                        <div className="bg-white text-black p-4 rounded-lg shadow-lg">
                            <p className="text-lg font-bold mb-4">Editing Times for: <span className="text-blue-600">{allProposals.find(p => p.id === selectedProposalId)?.title}</span></p>
                            <div className="flex justify-between items-center mb-4"><button onClick={() => setCurrentMonth(add(currentMonth, { months: -1 }))} className="font-bold text-lg p-2">&lt;</button><h2 className="text-xl font-bold">{format(currentMonth, "MMMM yyyy")}</h2><button onClick={() => setCurrentMonth(add(currentMonth, { months: 1 }))} className="font-bold text-lg p-2">&gt;</button></div>
                            <div className="grid grid-cols-7 text-center font-bold text-sm">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d} className="p-2">{d}</div>)}</div>
                            <div className="grid grid-cols-7 gap-1">
                                {daysInMonth.map(day => {
                                    const dayKey = format(day, 'yyyy-MM-dd');
                                    const dayBlocks = proposalsByDay[dayKey] || [];
                                    return (<div key={day.toString()} onClick={() => handleDayClick(day)} className={`pt-1 h-28 border rounded cursor-pointer flex flex-col items-center justify-start relative text-sm ${!isSameMonth(day, currentMonth) ? "text-gray-400 bg-gray-50" : "bg-white"} ${isToday(day) ? "border-2 border-blue-500" : ""} hover:bg-blue-100`}>
                                        <span className={`font-medium ${isToday(day) ? 'text-blue-600' : ''}`}>{format(day, "d")}</span>
                                        {dayBlocks.length > 0 && <div className="text-center text-green-800 text-[10px] font-semibold p-1 rounded-md w-full mt-1 overflow-y-auto">{dayBlocks.map(block => <div key={block.id}>{`${format(block.start, 'h:mma')}-${format(block.end, 'h:mma')}`.toLowerCase()}</div>)}</div>}
                                    </div>);
                                })}
                            </div>
                            <div className="text-center mt-6"><button onClick={handleSaveProposals} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded">Save Times for This Proposal</button></div>
                            {isModalOpen && selectedDay && <TimeSelectModal day={selectedDay} onClose={() => setIsModalOpen(false)} onSave={handleSaveBlocksForDay} existingBlocks={proposalsByDay[format(selectedDay, 'yyyy-MM-dd')] || []} />}
                        </div>
                        <div className="bg-white text-black p-6 rounded-lg shadow-lg">
                            <h2 className="text-2xl font-bold mb-4">Player Responses</h2>
                            {allTimeBlocksInProposal.length > 0 ? (
                                <div className="space-y-3">
                                    {allTimeBlocksInProposal.map(proposal => (
                                        <div key={proposal.id} className="p-3 rounded-lg flex justify-between items-center bg-gray-100">
                                            <div>
                                                <p className="font-semibold">{format(proposal.start, "EEEE, MMM d")}</p>
                                                <p className="text-gray-700">{`${format(proposal.start, 'h:mma')}-${format(proposal.end, 'h:mma')}`.toLowerCase()}</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="font-bold text-lg">{responseCounts.get(proposal.id) || 0} player{responseCounts.get(proposal.id) !== 1 ? 's' : ''}</p>
                                                    <p className="text-sm text-gray-500">available</p>
                                                </div>
                                                <button onClick={() => handleFinalizeSession(proposal)} className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded">Finalize</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-center">No time blocks have been added to this proposal yet.</p>
                            )}
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