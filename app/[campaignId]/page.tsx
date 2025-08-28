// app/[campaignId]/page.tsx

"use client";

import { useEffect, useState, useMemo } from "react";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, DocumentData, collection, getDocs, addDoc } from "firebase/firestore";
import { User, onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../../lib/firebase";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isToday, 
  add, 
  isSameDay,
  parseISO
} from "date-fns";

// A shared type for what a "Proposal Block" looks like
export type ProposalBlock = {
  start: Date;
  end: Date;
  id: string;
};

// --- TimeSelectModal Component ---
const TimeSelectModal = ({ day, onClose, onSave, existingBlocks }: { day: Date; onClose: () => void; onSave: (newBlocks: ProposalBlock[]) => void; existingBlocks: ProposalBlock[]; }) => {
    const [currentBlocks, setCurrentBlocks] = useState<ProposalBlock[]>(existingBlocks);
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('11:00');
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
        const newBlock: ProposalBlock = { start: startDate, end: endDate, id: `proposal_${Date.now()}` };
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
                    <select value={startTime} onChange={e => setStartTime(e.target.value)} className="p-2 border rounded-md w-full">{timeOptions.map(t => <option key={`start-${t}`} value={t}>{format(parseISO(`2000-01-01T${t}:00`), 'h:mm a')}</option>)}</select>
                    <span>to</span>
                    <select value={endTime} onChange={e => setEndTime(e.target.value)} className="p-2 border rounded-md w-full">{timeOptions.map(t => <option key={`end-${t}`} value={t}>{format(parseISO(`2000-01-01T${t}:00`), 'h:mm a')}</option>)}</select>
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

// --- NEW Finalized Session View Component ---
const FinalizedSessionView = ({ campaignId, campaign, isDM }: { campaignId: string; campaign: DocumentData; isDM: boolean; }) => {
    const { finalizedSession } = campaign;
    if (!finalizedSession) return null;
    const start = finalizedSession.start.toDate();
    const handleScheduleNew = async () => {
        if (!window.confirm("Are you sure you want to clear this schedule and propose new times?")) return;
        const campaignRef = doc(db, "campaigns", campaignId);
        try {
            await updateDoc(campaignRef, { finalizedSession: null });
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
                <button onClick={handleScheduleNew} className="mt-6 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded">
                    Schedule a New Session
                </button>
            )}
        </div>
    );
};

// --- DM's View Component ---
const DMView = ({ campaignId, user, allProposals }: { campaignId: string; user: User | null; allProposals: DocumentData[] }) => {
    const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
    const [newProposalTitle, setNewProposalTitle] = useState("");
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
                    loadedBlocks[dayKey] = selected.proposalBlocks[dayKey].map((block: any) => ({ ...block, start: block.start.toDate(), end: block.end.toDate() }));
                }
                setProposalsByDay(loadedBlocks);
            } else { setProposalsByDay({}); }
        } else { setProposalsByDay({}); }
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
    const handleCreateProposal = async () => {
        if (!newProposalTitle.trim() || !user) return;
        const newProposalRef = await addDoc(collection(db, "campaigns", campaignId, "proposals"), { title: newProposalTitle, dmId: user.uid, createdAt: new Date(), proposalBlocks: {}, responses: {} });
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
    const daysInMonth = useMemo(() => eachDayOfInterval({ start: startOfWeek(startOfMonth(currentMonth)), end: endOfWeek(endOfMonth(currentMonth)) }), [currentMonth]);
    const handleDayClick = (day: Date) => { setSelectedDay(day); setIsModalOpen(true); };
    const handleSaveBlocksForDay = (newBlocks: ProposalBlock[]) => {
        if (!selectedDay) return;
        const dayKey = format(selectedDay, 'yyyy-MM-dd');
        setProposalsByDay(prev => ({ ...prev, [dayKey]: newBlocks }));
    };
    const allTimeBlocksInProposal = Object.values(proposalsByDay).flat().sort((a,b) => a.start.getTime() - b.start.getTime());
    return (
        <div className="w-full max-w-4xl mt-8">
            <div className="bg-white text-black p-4 rounded-lg shadow-lg mb-8">
                <h2 className="text-xl font-bold mb-4">Manage Session Proposals</h2>
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="proposal-select" className="block text-sm font-medium text-gray-700">Edit Existing Proposal</label>
                        <select id="proposal-select" value={selectedProposalId || ''} onChange={e => setSelectedProposalId(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                            <option value="" disabled>-- Select a proposal --</option>
                            {allProposals.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                        </select>
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="flex-grow">
                            <label htmlFor="new-proposal" className="block text-sm font-medium text-gray-700">Or Create a New One</label>
                            <input id="new-proposal" type="text" value={newProposalTitle} onChange={e => setNewProposalTitle(e.target.value)} placeholder="e.g., Session 5" className="mt-1 block w-full p-2 border rounded-md" />
                        </div>
                        <button onClick={handleCreateProposal} className="bg-green-600 text-white py-2 px-4 rounded h-10">Create</button>
                    </div>
                </div>
            </div>
            {selectedProposalId && (
                <>
                    <div className="bg-white text-black p-4 rounded-lg shadow-lg">
                        <p className="text-sm text-gray-600 mb-4">Editing time blocks for: <span className="font-bold">{allProposals.find(p => p.id === selectedProposalId)?.title}</span></p>
                        <div className="flex justify-between items-center mb-4"><button onClick={() => setCurrentMonth(add(currentMonth, { months: -1 }))}>&lt;</button><h2 className="text-xl font-bold">{format(currentMonth, "MMMM yyyy")}</h2><button onClick={() => setCurrentMonth(add(currentMonth, { months: 1 }))}>&gt;</button></div>
                        <div className="grid grid-cols-7 text-center font-bold text-sm">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d}>{d}</div>)}</div>
                        <div className="grid grid-cols-7 gap-1">{daysInMonth.map(day => (<div key={day.toString()} onClick={() => handleDayClick(day)} className={`pt-1 h-28 border rounded cursor-pointer ${!isSameMonth(day, currentMonth) ? "text-gray-400" : ""} ${isToday(day) ? "border-blue-500" : ""}`}><span>{format(day, "d")}</span>{/* Render blocks... */}</div>))}</div>
                        <div className="text-center mt-6"><button onClick={handleSaveProposals} className="bg-blue-600 text-white py-2 px-6 rounded">Save Times for This Proposal</button></div>
                        {isModalOpen && selectedDay && <TimeSelectModal day={selectedDay} onClose={() => setIsModalOpen(false)} onSave={handleSaveBlocksForDay} existingBlocks={proposalsByDay[format(selectedDay, 'yyyy-MM-dd')] || []} />}
                    </div>
                    <div className="mt-8 bg-white text-black p-6 rounded-lg shadow-lg">
                        <h2 className="text-2xl font-bold mb-4">Player Responses</h2>
                        <div className="space-y-3">{allTimeBlocksInProposal.map(proposal => (<div key={proposal.id} className="p-3 rounded-lg flex justify-between items-center bg-gray-100"><div><p className="font-semibold">{format(proposal.start, "EEEE, MMM d")}</p><p className="text-gray-700">{`${format(proposal.start, 'h:mma')}-${format(proposal.end, 'h:mma')}`}</p></div><div className="flex items-center gap-4"><div className="text-right"><p className="font-bold text-lg">{responseCounts.get(proposal.id) || 0} players</p></div><button onClick={() => handleFinalizeSession(proposal)} className="bg-purple-600 text-white py-2 px-4 rounded">Finalize</button></div></div>))}</div>
                    </div>
                </>
            )}
        </div>
    );
};

// --- Player's View Component ---
const PlayerView = ({ campaignId, user, allProposals }: { campaignId: string; user: User | null; allProposals: DocumentData[] }) => {
    const [myResponses, setMyResponses] = useState<Record<string, boolean>>({});
    useEffect(() => {
        if (!user) return;
        const initialResponses: Record<string, boolean> = {};
        allProposals.forEach(proposal => {
            if (proposal.responses && proposal.responses[user.uid]) {
                Object.assign(initialResponses, proposal.responses[user.uid]);
            }
        });
        setMyResponses(initialResponses);
    }, [allProposals, user]);
    const handleResponseClick = (proposalBlockId: string) => {
        setMyResponses(prev => ({ ...prev, [proposalBlockId]: !prev[proposalBlockId] }));
    };
    const handleSaveResponses = async () => {
        if (!user) return;
        const updatePromises: Promise<void>[] = [];
        allProposals.forEach(proposal => {
            const proposalRef = doc(db, "campaigns", campaignId, "proposals", proposal.id);
            const responsesForThisProposal: Record<string, boolean> = {};
            const blocks: ProposalBlock[] = (proposal.proposalBlocks ? Object.values(proposal.proposalBlocks).flat() : []) as ProposalBlock[];
            blocks.forEach((block: ProposalBlock) => {
                if (myResponses[block.id] !== undefined) {
                    responsesForThisProposal[block.id] = myResponses[block.id];
                }
            });
            if (Object.keys(responsesForThisProposal).length > 0) {
                updatePromises.push(setDoc(proposalRef, { responses: { [user.uid]: responsesForThisProposal } }, { merge: true }));
            }
        });
        await Promise.all(updatePromises);
        alert("Your responses have been saved!");
    };
    if (allProposals.length === 0) {
        return <div className="text-white text-center mt-8">The DM has not proposed any times yet.</div>;
    }
    return (
        <div className="w-full max-w-3xl mt-8 bg-white text-black p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-center">DM's Session Proposals</h2>
            <div className="space-y-6">{allProposals.map(proposal => {
                const blocks: ProposalBlock[] = (proposal.proposalBlocks ? Object.values(proposal.proposalBlocks).flat() : []) as ProposalBlock[];
                return (<div key={proposal.id} className="border p-4 rounded-md"><h3 className="text-xl font-bold mb-3">{proposal.title}</h3><div className="space-y-3">{blocks.map((block: any) => {
                    const start = block.start.toDate(); const end = block.end.toDate(); const isSelected = !!myResponses[block.id]; let playerCount = 0; if (proposal.responses) { Object.values(proposal.responses).forEach((response: any) => { if (response[block.id]) playerCount++; }); }
                    return (<div key={block.id} onClick={() => handleResponseClick(block.id)} className={`p-3 rounded-lg cursor-pointer flex justify-between items-center ${isSelected ? 'bg-green-100' : 'bg-gray-100'}`}><div><p className="font-semibold">{format(start, "EEEE, MMM d")}</p><p className="text-gray-700">{`${format(start, 'h:mma')}-${format(end, 'h:mma')}`}</p></div><div className="text-right"><p className={`font-bold ${isSelected ? 'text-green-700' : ''}`}>{isSelected ? '✔️ Attending' : 'Select'}</p>{playerCount > 0 && <p className="text-sm">{playerCount} players</p>}</div></div>);
                })}</div></div>);
            })}</div>
            <div className="text-center mt-8"><button onClick={handleSaveResponses} className="bg-blue-600 text-white py-2 px-6 rounded">Save My Responses</button></div>
        </div>
    );
};

// --- Main Campaign Page Component ---
export default function CampaignPage({ params }: { params: { campaignId: string } }) {
  const { campaignId } = params;
  const [campaign, setCampaign] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isDM, setIsDM] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [allProposals, setAllProposals] = useState<DocumentData[]>([]);
  useEffect(() => {
    const onAuthChange = onAuthStateChanged(auth, (currentUser) => { setUser(currentUser); });
    const fetchAllData = async () => {
      if (!campaignId) { setLoading(false); return; };
      const campaignRef = doc(db, "campaigns", campaignId);
      const campaignSnap = await getDoc(campaignRef);
      let campData: DocumentData | null = null;
      if (campaignSnap.exists()) { campData = campaignSnap.data(); setCampaign(campData); } else { setCampaign(null); }
      if (user && campData) { setIsDM(campData.createdBy === user.uid); setIsMember(campData.members?.includes(user.uid) || false); } else { setIsDM(false); setIsMember(false); }
      const proposalsCol = collection(db, "campaigns", campaignId, "proposals");
      const proposalSnapshot = await getDocs(proposalsCol);
      const proposalsList = proposalSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllProposals(proposalsList);
      setLoading(false);
    };
    fetchAllData();
    return () => onAuthChange();
  }, [campaignId, user]);
  const handleJoinCampaign = async () => {
    if (!user) return;
    const campaignRef = doc(db, "campaigns", campaignId);
    await updateDoc(campaignRef, { members: arrayUnion(user.uid) });
    setIsMember(true);
    alert("You have joined the campaign!");
  };
  if (loading) return <div className="text-center p-10 bg-gray-800 text-white min-h-screen">Loading...</div>;
  if (!campaign) return <div className="text-center p-10 bg-gray-800 text-white min-h-screen">Campaign not found.</div>;
  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-800">
      <h1 className="text-4xl font-bold mb-2 text-white">Campaign: {campaign.name}</h1>
      {campaign.finalizedSession ? (
        <FinalizedSessionView campaignId={campaignId} campaign={campaign} isDM={isDM} />
      ) : (
        <>
          {user && !isMember && ( <div className="my-4"><button onClick={handleJoinCampaign} className="bg-green-600 text-white py-2 px-6 rounded">Join This Campaign</button></div> )}
          {isMember ? (
            <>
              <p className="text-lg text-gray-400 mb-4">You are the <span className="font-bold text-white">{isDM ? "Dungeon Master" : "Player"}</span>.</p>
              {isDM ? <DMView campaignId={campaignId} user={user} allProposals={allProposals} /> : <PlayerView campaignId={campaignId} user={user} allProposals={allProposals} />}
            </>
          ) : ( user && <p className="text-white">Join the campaign to see the schedule.</p> )}
          {!user && <p className="text-white mt-4">Please log in to join or view this campaign.</p>}
        </>
      )}
    </main>
  );
}