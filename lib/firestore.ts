import { db } from '@/lib/firebase';
import { addDoc, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';
import type { CampaignDoc, CampaignID, SessionDoc, UID } from './types';

export async function createCampaign(userId: UID, name: string, description = '') {
  const ref = await addDoc(collection(db, 'campaigns'), {
    name,
    description,
    gmId: userId,
    players: [userId],
    createdAt: Date.now(),
  } satisfies CampaignDoc);
  return ref.id as CampaignID;
}

export async function joinCampaign(campaignId: CampaignID, userId: UID) {
  const ref = doc(db, 'campaigns', campaignId);
  await updateDoc(ref, { players: arrayUnion(userId) });
}

export async function createSession(campaignId: CampaignID, title: string, notes = '') {
  const ref = await addDoc(collection(doc(db, 'campaigns', campaignId), 'sessions'), {
    title,
    notes,
    createdAt: Date.now(),
    proposedTimes: [],
    availability: {},
    confirmedTime: null,
  } satisfies SessionDoc);
  return ref.id;
}

export async function addProposedTime(campaignId: CampaignID, sessionId: string, proposedTime: { id: string; startISO: string; endISO: string; proposedBy: UID; }) {
  const ref = doc(db, 'campaigns', campaignId, 'sessions', sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Session not found');
  const data = snap.data() as SessionDoc;
  const exists = data.proposedTimes.some(pt => pt.id === proposedTime.id);
  if (exists) return;
  data.proposedTimes.push(proposedTime);
  data.availability[proposedTime.id] = { yes: [], maybe: [], no: [] };
  await setDoc(ref, data);
}

export async function setAvailability(campaignId: CampaignID, sessionId: string, timeId: string, uid: UID, value: 'yes'|'maybe'|'no') {
  const ref = doc(db, 'campaigns', campaignId, 'sessions', sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Session not found');
  const data = snap.data() as SessionDoc;
  if (!data.availability[timeId]) data.availability[timeId] = { yes: [], maybe: [], no: [] };
  // remove from all buckets then push to selected
  (['yes','maybe','no'] as const).forEach(k => {
    const arr = data.availability[timeId][k];
    data.availability[timeId][k] = arr.filter(u => u !== uid);
  });
  data.availability[timeId][value].push(uid);
  await setDoc(ref, data);
}

export async function confirmTime(campaignId: CampaignID, sessionId: string, timeId: string) {
  const ref = doc(db, 'campaigns', campaignId, 'sessions', sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Session not found');
  const data = snap.data() as SessionDoc;
  const pt = data.proposedTimes.find(p => p.id === timeId);
  if (!pt) throw new Error('Time not found');
  data.confirmedTime = { startISO: pt.startISO, endISO: pt.endISO };
  await setDoc(ref, data);
}

