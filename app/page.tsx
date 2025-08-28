// app/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, serverTimestamp, query, where, getDocs, DocumentData } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [myCampaigns, setMyCampaigns] = useState<DocumentData[]>([]);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const fetchCampaigns = async () => {
        const campaignsRef = collection(db, "campaigns");
        const q = query(campaignsRef, where("members", "array-contains", user.uid));
        const querySnapshot = await getDocs(q);
        const campaigns: DocumentData[] = [];
        querySnapshot.forEach((doc) => {
          campaigns.push({ id: doc.id, ...doc.data() });
        });
        setMyCampaigns(campaigns);
      };
      fetchCampaigns();
    } else {
      setMyCampaigns([]);
    }
  }, [user]);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName.trim() || !user) return;

    try {
        const docRef = await addDoc(collection(db, "campaigns"), {
            name: campaignName,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            members: [user.uid]
        });
        router.push(`/${docRef.id}`);
    } catch (error) {
        console.error("Error creating campaign: ", error);
        alert("Could not create campaign. Please check the console for errors.");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-800 text-white">
      <div className="w-full max-w-4xl">
        <h1 className="text-4xl font-bold mb-8 text-center">Your D&D Dashboard</h1>
        {user ? (
          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-gray-700 p-6 rounded-lg">
              <h2 className="text-2xl font-bold mb-4">Create a New Campaign</h2>
              <form onSubmit={handleCreateCampaign} className="flex flex-col gap-4">
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Enter New Campaign Name"
                  className="px-4 py-2 border rounded-md text-black"
                />
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 font-bold py-2 px-4 rounded">
                  Create Campaign
                </button>
              </form>
            </div>
            
            <div className="bg-gray-700 p-6 rounded-lg">
              <h2 className="text-2xl font-bold mb-4">My Campaigns</h2>
              {myCampaigns.length > 0 ? (
                <div className="space-y-3">
                  {myCampaigns.map((campaign) => (
                    <Link key={campaign.id} href={`/${campaign.id}`}
                      className="block bg-gray-800 hover:bg-gray-900 p-4 rounded-md transition-colors"
                    >
                      <p className="font-bold">{campaign.name}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p>You haven't joined any campaigns yet.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-center text-lg">Please log in to see your dashboard.</p>
        )}
      </div>
    </main>
  );
}