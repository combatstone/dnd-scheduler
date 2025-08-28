# File: package.json
{
  "name": "dnd-scheduler",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "firebase": "^10.13.0",
    "next": "^14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "clsx": "^2.1.1",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "autoprefixer": "^10.4.19",
    "eslint": "^8.57.0",
    "eslint-config-next": "^14.2.5",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.4"
  }
}

# File: tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}

# File: next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true };
module.exports = nextConfig;

# File: postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

# File: tailwind.config.ts
import type { Config } from 'tailwindcss'
export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config

# File: app/globals.css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: light dark; }
body { @apply bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100; }
.btn { @apply inline-flex items-center justify-center rounded-2xl px-4 py-2 font-medium shadow-sm bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50; }
.card { @apply rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow; }
.input { @apply w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/80 px-3 py-2; }
.label { @apply text-sm text-neutral-600 dark:text-neutral-400; }

# File: .env.local.example
NEXT_PUBLIC_FIREBASE_API_KEY=xxxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxxxx
NEXT_PUBLIC_FIREBASE_APP_ID=1:xxxx:web:xxxx

# File: lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);

# File: lib/types.ts
export type UID = string;
export type CampaignID = string;
export type SessionID = string;

export type ProposedTime = {
  id: string; // uuid
  startISO: string;
  endISO: string;
  proposedBy: UID;
};

export type AvailabilityBuckets = {
  yes: UID[];
  maybe: UID[];
  no: UID[];
};

export type SessionDoc = {
  title: string;
  notes?: string;
  createdAt: number;
  confirmedTime?: { startISO: string; endISO: string } | null;
  proposedTimes: ProposedTime[];
  availability: Record<string, AvailabilityBuckets>; // key = ProposedTime.id
};

export type CampaignDoc = {
  name: string;
  description?: string;
  gmId: UID;
  players: UID[];
  createdAt: number;
};

# File: lib/firestore.ts
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

# File: firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function isCampaignPlayer(campaignId) {
      return isSignedIn() && exists(/databases/$(database)/documents/campaigns/$(campaignId)) &&
        (request.auth.uid in get(/databases/$(database)/documents/campaigns/$(campaignId)).data.players);
    }

    match /campaigns/{campaignId} {
      allow read: if isCampaignPlayer(campaignId);
      allow create: if isSignedIn();
      allow update: if isCampaignPlayer(campaignId);

      match /sessions/{sessionId} {
        allow read, create, update, delete: if isCampaignPlayer(campaignId);
      }
    }
  }
}

# File: app/layout.tsx
import './globals.css';
import { ReactNode } from 'react';

export const metadata = { title: 'D&D Scheduler', description: 'Collaborative campaign scheduling' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="max-w-5xl mx-auto p-6">
          {children}
        </div>
      </body>
    </html>
  );
}

# File: app/page.tsx
'use client'
import { auth, provider, db } from '@/lib/firebase';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [user, setUser] = useState(auth.currentUser);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  return (
    <main className="space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">D&D Scheduler</h1>
        {user ? (
          <button className="btn" onClick={() => signOut(auth)}>Sign out</button>
        ) : null}
      </header>

      <section className="card p-6">
        <p className="mb-4 text-lg">Lightweight group scheduling for campaigns. Propose times, vote availability, and lock the session.</p>
        {user ? (
          <Link className="btn" href="/dashboard">Go to Dashboard</Link>
        ) : (
          <button className="btn" onClick={() => signInWithPopup(auth, provider)}>Sign in with Google</button>
        )}
      </section>
    </main>
  );
}

# File: app/dashboard/page.tsx
'use client'
import { useEffect, useMemo, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { addDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { createCampaign } from '@/lib/firestore';

export default function Dashboard() {
  const [user, setUser] = useState(auth.currentUser);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [name, setName] = useState('');

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'campaigns'), where('players', 'array-contains', user.uid));
    return onSnapshot(q, snap => setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user]);

  if (!user) return (
    <div className="space-y-4">
      <p>Please sign in from the home page.</p>
      <Link className="btn" href="/">Back</Link>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Your Campaigns</h2>
        <Link className="btn" href="/">Home</Link>
      </div>

      <div className="card p-4 space-y-3">
        <label className="label">Create new campaign</label>
        <div className="flex gap-2">
          <input className="input" placeholder="Campaign name" value={name} onChange={e => setName(e.target.value)} />
          <button className="btn" onClick={async () => { if (!name.trim() || !user) return; const id = await createCampaign(user.uid, name.trim()); setName(''); }}>Create</button>
        </div>
      </div>

      <ul className="grid md:grid-cols-2 gap-4">
        {campaigns.map(c => (
          <li key={c.id} className="card p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">{c.name}</h3>
              <span className="text-xs text-neutral-500">Players: {c.players?.length ?? 0}</span>
            </div>
            <Link className="btn mt-2" href={`/campaign/${c.id}`}>Open</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

# File: app/campaign/[id]/page.tsx
'use client'
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { addDoc, arrayUnion, collection, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import { addProposedTime, confirmTime, createSession, setAvailability } from '@/lib/firestore';
import type { ProposedTime, SessionDoc } from '@/lib/types';

function uuid() { return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }

export default function CampaignPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id;
  const [user, setUser] = useState(auth.currentUser);
  const [campaign, setCampaign] = useState<any>(null);
  const [sessions, setSessions] = useState<{ id: string; data: SessionDoc }[]>([]);
  const [title, setTitle] = useState('Next Session');
  const [notes, setNotes] = useState('');

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (!campaignId) return;
    const unsub = onSnapshot(doc(db, 'campaigns', campaignId), d => setCampaign({ id: d.id, ...d.data() }));
    const unsub2 = onSnapshot(collection(doc(db, 'campaigns', campaignId), 'sessions'), s => {
      const arr = s.docs.map(d => ({ id: d.id, data: d.data() as SessionDoc })).sort((a,b)=> (a.data.createdAt)-(b.data.createdAt));
      setSessions(arr);
    });
    return () => { unsub(); unsub2(); };
  }, [campaignId]);

  if (!user) return (
    <div className="space-y-4">
      <p>Please sign in from the home page.</p>
      <Link className="btn" href="/">Back</Link>
    </div>
  );
  if (!campaign) return <p>Loading…</p>;

  const isGM = campaign.gmId === user.uid;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <p className="text-sm text-neutral-500">GM: {campaign.gmId === user.uid ? 'You' : campaign.gmId}</p>
        </div>
        <Link className="btn" href="/dashboard">Back</Link>
      </div>

      <InviteBlock id={campaignId} />

      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">Create Session</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <input className="input" placeholder="Session title" value={title} onChange={e=>setTitle(e.target.value)} />
          <input className="input md:col-span-2" placeholder="Notes (optional)" value={notes} onChange={e=>setNotes(e.target.value)} />
        </div>
        <button className="btn" onClick={async ()=>{ const sid = await createSession(campaignId, title.trim()||'Next Session', notes.trim()); setTitle('Next Session'); setNotes(''); }}>Create</button>
      </div>

      <div className="space-y-4">
        {sessions.map(({id, data}) => (
          <SessionCard key={id} campaignId={campaignId} sessionId={id} data={data} isGM={isGM} uid={user.uid} />
        ))}
      </div>
    </div>
  );
}

function InviteBlock({ id }: { id: string }){
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? `${window.location.origin}/campaign/${id}` : '';
  return (
    <div className="card p-4 flex flex-wrap gap-3 items-center">
      <div>
        <div className="label">Invite link</div>
        <code className="text-sm break-all">{url}</code>
      </div>
      <button className="btn" onClick={()=>{ navigator.clipboard.writeText(url); setCopied(true); setTimeout(()=>setCopied(false), 1500); }}>{copied?'Copied!':'Copy'}</button>
    </div>
  );
}

function SessionCard({ campaignId, sessionId, data, isGM, uid }:{ campaignId: string; sessionId: string; data: SessionDoc; isGM: boolean; uid: string; }){
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">{data.title}</h3>
        {data.confirmedTime ? (
          <span className="text-sm text-green-600">Confirmed: {fmt(data.confirmedTime.startISO)} – {fmt(data.confirmedTime.endISO)}</span>
        ) : (
          <span className="text-sm text-amber-600">Awaiting confirmation</span>
        )}
      </div>
      {data.notes ? <p className="text-sm text-neutral-600">{data.notes}</p> : null}

      <div className="grid md:grid-cols-3 gap-3 items-end">
        <div>
          <label className="label">Start</label>
          <input className="input" type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} />
        </div>
        <div>
          <label className="label">End</label>
          <input className="input" type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)} />
        </div>
        <button className="btn" onClick={async()=>{
          if(!start||!end) return;
          const pt: ProposedTime = { id: uuid(), startISO: new Date(start).toISOString(), endISO: new Date(end).toISOString(), proposedBy: uid };
          await addProposedTime(campaignId, sessionId, pt);
          setStart(''); setEnd('');
        }}>Propose time</button>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium">Proposed times</h4>
        {data.proposedTimes.length===0 ? <p className="text-sm text-neutral-500">No proposals yet.</p> : null}
        <ul className="space-y-2">
          {data.proposedTimes.map(pt => (
            <li key={pt.id} className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div>
                  <div className="font-medium">{fmt(pt.startISO)} – {fmt(pt.endISO)}</div>
                  <BucketsRow availability={data.availability[pt.id]} />
                </div>
                <div className="flex gap-2">
                  <button className="btn" onClick={()=> setAvailability(campaignId, sessionId, pt.id, uid, 'yes')}>Yes</button>
                  <button className="btn !bg-amber-600 hover:!bg-amber-500" onClick={()=> setAvailability(campaignId, sessionId, pt.id, uid, 'maybe')}>Maybe</button>
                  <button className="btn !bg-neutral-700 hover:!bg-neutral-600" onClick={()=> setAvailability(campaignId, sessionId, pt.id, uid, 'no')}>No</button>
                  {isGM && (
                    <button className="btn !bg-emerald-600 hover:!bg-emerald-500" onClick={()=> confirmTime(campaignId, sessionId, pt.id)}>Confirm</button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BucketsRow({ availability }: { availability?: Record<'yes'|'maybe'|'no', string[]> }){
  const yes = availability?.yes?.length ?? 0;
  const maybe = availability?.maybe?.length ?? 0;
  const no = availability?.no?.length ?? 0;
  return (
    <div className="flex gap-3 text-sm mt-1">
      <span className="text-green-600">Yes: {yes}</span>
      <span className="text-amber-600">Maybe: {maybe}</span>
      <span className="text-red-600">No: {no}</span>
    </div>
  );
}

function fmt(iso: string){
  try { const d = new Date(iso); return d.toLocaleString(); } catch { return iso; }
}

# File: README.md
# D&D Scheduler

This project is a collaborative scheduling tool for D&D campaigns,
built with Next.js, Firebase, and Tailwind CSS.

## Setup
1. Copy `.env.local.example` → `.env.local`
2. Add your Firebase config.
3. Run `npm install`
4. Run `npm run dev`

---
## Quick start
1. Create Firebase project, enable **Authentication → Google** and **Firestore**.
2. Copy `.env.local.example` to `.env.local` and fill with Firebase web config.
3. Deploy `firestore.rules` to secure reads/writes.
4. `npm i && npm run dev`.

## Notes
- Invite link is the campaign URL; any signed-in user can open it to join via UI once you add a simple "Join" action (future).
- Availability buckets are stored in the session document for simplicity.
- Time inputs use native `datetime-local` for low dependency.
# File: END_OF_FILES