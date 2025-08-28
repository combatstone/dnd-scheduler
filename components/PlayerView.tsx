// components/PlayerView.tsx

"use client";

import { useState, useEffect, useMemo } from "react";
import { doc, setDoc, DocumentData } from "firebase/firestore";
import { User } from "firebase/auth";
import { db } from "../lib/firebase";
import { format } from "date-fns";
import { ProposalBlock } from "./TimeSelectModal";

const PlayerView = ({ campaignId, user, allProposals }: { campaignId: string; user: User | null; allProposals: DocumentData[] }) => {
    const [myResponses, setMyResponses] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (user && allProposals) {
            const initialResponses: Record<string, boolean> = {};
            allProposals.forEach(proposal => {
                if (proposal.responses && proposal.responses[user.uid]) {
                    Object.assign(initialResponses, proposal.responses[user.uid]);
                }
            });
            setMyResponses(initialResponses);
        }
    }, [allProposals, user]);

    const sortedProposals = useMemo(() => {
        if (!allProposals) return [];
        const flattenedProposals: ProposalBlock[] = [];
        allProposals.forEach(proposal => {
            // CORRECTED: Using 'as' for type assertion
            const blocks = (proposal.proposalBlocks ? Object.values(proposal.proposalBlocks).flat() : []) as ProposalBlock[];
            
            flattenedProposals.push(...blocks.map((b: any) => ({
                ...b,
                start: b.start.toDate(),
                end: b.end.toDate()
            })));
        });
        return flattenedProposals.sort((a, b) => a.start.getTime() - b.start.getTime());
    }, [allProposals]);

    const handleResponseClick = (proposalId: string) => {
        setMyResponses(prev => ({ ...prev, [proposalId]: !prev[proposalId] }));
    };

    const handleSaveResponses = async () => {
        if (!user) return;
        const updatePromises: Promise<void>[] = [];
        allProposals.forEach(proposal => {
            const proposalRef = doc(db, "campaigns", campaignId, "proposals", proposal.id);
            const responsesForThisProposal: Record<string, boolean> = {};
            
            // CORRECTED: Using 'as' for type assertion
            const blocks = (proposal.proposalBlocks ? Object.values(proposal.proposalBlocks).flat() : []) as ProposalBlock[];

            blocks.forEach((block: ProposalBlock) => {
                if (myResponses[block.id] !== undefined) {
                    responsesForThisProposal[block.id] = myResponses[block.id];
                }
            });
            if (Object.keys(responsesForThisProposal).length > 0) {
                const promise = setDoc(proposalRef, { responses: { [user.uid]: responsesForThisProposal } }, { merge: true });
                updatePromises.push(promise);
            }
        });
        await Promise.all(updatePromises);
        alert("Your responses have been saved!");
    };

    if (sortedProposals.length === 0) {
        return <div className="text-white text-center mt-8">The DM has not proposed any times yet.</div>;
    }

    return (
        <div className="w-full max-w-2xl mt-8 bg-white text-black p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-center">DM's Session Proposals</h2>
            <div className="space-y-3">
                {sortedProposals.map(proposal => {
                    const isSelected = !!myResponses[proposal.id];
                    let playerCount = 0;
                    if (allProposals) {
                         allProposals.forEach(p => {
                            if(p.responses) {
                               Object.values(p.responses).forEach((res: any) => {
                                   if(res[proposal.id]) playerCount++;
                               });
                            }
                        });
                    }

                    return (
                        <div key={proposal.id} onClick={() => handleResponseClick(proposal.id)} className={`p-3 rounded-lg cursor-pointer flex justify-between items-center transition-all border-2 ${isSelected ? 'bg-green-100 border-green-500' : 'bg-gray-100 hover:border-gray-300'}`}>
                            <div>
                                <p className="font-semibold">{format(proposal.start, "EEEE, MMM d")}</p>
                                <p className="text-gray-700">{`${format(proposal.start, 'h:mma')} - ${format(proposal.end, 'h:mma')}`.toLowerCase()}</p>
                            </div>
                            <div className="text-right">
                                <p className={`font-bold ${isSelected ? 'text-green-700' : 'text-gray-600'}`}>{isSelected ? '✔️ Attending' : 'Select'}</p>
                                {playerCount > 0 && <p className="text-sm text-gray-500">{playerCount} player{playerCount > 1 ? 's' : ''}</p>}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="text-center mt-8">
                <button onClick={handleSaveResponses} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded">Save My Responses</button>
            </div>
        </div>
    );
};

export default PlayerView;