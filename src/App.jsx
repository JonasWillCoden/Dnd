import React, { useEffect, useRef, useState } from 'react';
import {
  Scroll,
  Pizza,
  Plus,
  Check,
  Crown,
  Trash2,
  Users,
  ArrowRight,
  Gem,
  Map,
  MessageCircle,
  X,
  LogIn,
  Settings,
  LogOut,
  User,
  Menu,
  Home,
  Calendar,
} from 'lucide-react';
import {
  arrayRemove,
  arrayUnion,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  applyActionCode,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, db } from './firebase.js';
import logo from './assets/logo.png';

const weekDays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const defaultXpTable = [
  { level: 1, xp: 0 },
  { level: 2, xp: 300 },
  { level: 3, xp: 900 },
  { level: 4, xp: 2700 },
  { level: 5, xp: 6500 },
  { level: 6, xp: 14000 },
  { level: 7, xp: 23000 },
  { level: 8, xp: 34000 },
  { level: 9, xp: 48000 },
  { level: 10, xp: 64000 },
  { level: 11, xp: 85000 },
  { level: 12, xp: 100000 },
  { level: 13, xp: 120000 },
  { level: 14, xp: 140000 },
  { level: 15, xp: 165000 },
  { level: 16, xp: 195000 },
  { level: 17, xp: 225000 },
  { level: 18, xp: 265000 },
  { level: 19, xp: 305000 },
  { level: 20, xp: 355000 },
];

const TENOR_API_KEY = import.meta.env.VITE_TENOR_KEY || 'LIVDSRZULELA';
const TENOR_CLIENT_KEY = 'guildhall';
const GIPHY_PUBLIC_KEY = 'dc6zaTOxFJmzC';
const GIF_SEARCH_ENABLED = false;

const normalizeXpTable = (table) =>
  (Array.isArray(table) ? table : [])
    .map((row) => ({
      level: Number.parseInt(row.level, 10),
      xp: Number.parseInt(row.xp, 10),
    }))
    .filter((row) => Number.isFinite(row.level) && Number.isFinite(row.xp))
    .sort((a, b) => a.level - b.level);

const getLevelForXp = (xp, table) => {
  const safeXp = Number.isFinite(xp) ? xp : 0;
  const normalized = normalizeXpTable(table);
  if (normalized.length === 0) {
    return { level: 1, nextXp: null };
  }
  let level = normalized[0].level;
  let nextXp = null;
  for (let i = 0; i < normalized.length; i += 1) {
    if (safeXp >= normalized[i].xp) {
      level = normalized[i].level;
      nextXp = normalized[i + 1] ? normalized[i + 1].xp : null;
    } else {
      nextXp = normalized[i].xp;
      break;
    }
  }
  return { level, nextXp };
};

const deriveGifUrlFromText = (text) => {
  if (!text) return '';
  const trimmed = text.trim();
  const directGif = trimmed.match(/https?:\/\/\S+\.gif(\?\S*)?$/i);
  if (directGif?.[0]) return directGif[0];
  const mediaGiphy = trimmed.match(/https?:\/\/media\.giphy\.com\/media\/([a-zA-Z0-9]+)\/giphy\.gif/i);
  if (mediaGiphy?.[0]) return mediaGiphy[0];
  const giphyMatch = trimmed.match(/giphy\.com\/(?:gifs|media)\/[^/]*-([a-zA-Z0-9]+)/i);
  if (giphyMatch?.[1]) {
    return `https://media.giphy.com/media/${giphyMatch[1]}/giphy.gif`;
  }
  const tenorMatch = trimmed.match(/tenor\.com\/view\/[^/]*-(\d+)/i);
  if (tenorMatch?.[1]) {
    return `https://media.tenor.com/${tenorMatch[1]}/tenor.gif`;
  }
  return '';
};

const normalizeGifUrl = async (url) => {
  if (!url) return '';
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return '';
  const derived = deriveGifUrlFromText(trimmed);
  if (derived) return derived;
  if (trimmed.includes('media.giphy.com') || trimmed.endsWith('.gif')) {
    return trimmed;
  }
  const giphyMatch = trimmed.match(/giphy\.com\/(?:gifs|media)\/[^/]*-([a-zA-Z0-9]+)/);
  if (giphyMatch?.[1]) {
    return `https://media.giphy.com/media/${giphyMatch[1]}/giphy.gif`;
  }
  if (trimmed.includes('tenor.com')) {
    try {
      const res = await fetch(`https://tenor.com/oembed?url=${encodeURIComponent(trimmed)}`);
      if (!res.ok) return '';
      const data = await res.json();
      return data?.url || '';
    } catch {
      return '';
    }
  }
  return '';
};

const avatarPresets = [
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><rect width='120' height='120' fill='%23130f0c'/><polygon points='60,18 96,46 82,96 38,96 24,46' fill='%23d97706'/><text x='60' y='70' text-anchor='middle' font-size='28' fill='%23130f0c' font-family='Cinzel,serif'>20</text></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><rect width='120' height='120' fill='%230f172a'/><path d='M26 84 L60 30 L94 84 Z' fill='%2322c55e'/><path d='M60 30 L60 90' stroke='%230f172a' stroke-width='6'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><rect width='120' height='120' fill='%23181722'/><path d='M38 34 H82 L74 92 H46 Z' fill='%23f43f5e'/><path d='M60 38 L60 86' stroke='%23181722' stroke-width='6'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><rect width='120' height='120' fill='%23111617'/><path d='M60 24 C78 24 92 38 92 56 C92 76 76 92 60 92 C44 92 28 76 28 56 C28 38 42 24 60 24 Z' fill='%2363b3ed'/><circle cx='48' cy='54' r='6' fill='%23111617'/><circle cx='72' cy='54' r='6' fill='%23111617'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><rect width='120' height='120' fill='%231a120b'/><path d='M36 90 C36 70 44 58 60 58 C76 58 84 70 84 90' stroke='%23f59e0b' stroke-width='10' fill='none'/><circle cx='60' cy='46' r='16' fill='%23f59e0b'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><rect width='120' height='120' fill='%230a0a0a'/><path d='M32 80 L60 28 L88 80' stroke='%238b5cf6' stroke-width='10' fill='none'/><circle cx='60' cy='86' r='10' fill='%238b5cf6'/></svg>",
];

const guildPresets = [
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 120'><rect width='180' height='120' fill='%231c1917'/><path d='M12 96 L90 18 L168 96 Z' fill='%23d97706'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 120'><rect width='180' height='120' fill='%230f172a'/><circle cx='90' cy='60' r='36' fill='%2322c55e'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 120'><rect width='180' height='120' fill='%23181722'/><rect x='30' y='24' width='120' height='72' rx='8' fill='%23f43f5e'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 120'><rect width='180' height='120' fill='%23111617'/><path d='M24 90 L90 30 L156 90' stroke='%2363b3ed' stroke-width='12' fill='none'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 120'><rect width='180' height='120' fill='%231a120b'/><circle cx='90' cy='60' r='40' stroke='%23f59e0b' stroke-width='10' fill='none'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 120'><rect width='180' height='120' fill='%230a0a0a'/><path d='M36 84 H144 V96 H36 Z' fill='%238b5cf6'/><path d='M60 36 H120 V72 H60 Z' fill='%234c1d95'/></svg>",
];

const generateInviteCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

const buildSeedCalendar = () => {
  const days = [];
  const today = new Date();
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateKey = d.toISOString().slice(0, 10);
    days.push({
      dateKey,
      dayName: weekDays[d.getDay()],
      dateStr: d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
    });
  }
  return days;
};

const HeatmapCell = ({ slotData, onClick, max = 5 }) => {
  const totalCount = slotData.partyCount + (slotData.userVote ? 1 : 0);
  const isFullParty = totalCount >= max;
  const isUserIn = slotData.userVote;

  let bgClass =
    'bg-stone-900/60 border-stone-800 text-stone-600 hover:bg-stone-900/60 hover:border-stone-800';
  if (totalCount > 0) {
    bgClass =
      'bg-amber-950/40 border-amber-900/40 text-amber-600 hover:bg-amber-950/40 hover:border-amber-900/40';
  }
  if (totalCount >= 3) {
    bgClass =
      'bg-amber-900/40 border-amber-700/60 text-amber-200 shadow-[0_0_10px_rgba(180,83,9,0.1)] hover:bg-amber-900/40 hover:border-amber-700/60';
  }
  if (isFullParty) {
    bgClass =
      'bg-gradient-to-br from-emerald-950 to-emerald-900 border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.18)] font-bold';
  }

  return (
    <button
      onClick={onClick}
      className={`h-10 sm:h-12 w-full rounded-sm border flex flex-col items-center justify-center transition-none active:scale-95 group relative overflow-hidden ${bgClass} ${
        isUserIn ? 'ring-1 ring-amber-500 ring-offset-1 ring-offset-stone-950 border-amber-500/50' : ''
      }`}
    >
      {isUserIn && <div className="absolute inset-0 bg-amber-500/5 animate-pulse"></div>}
      <span
        className={`text-base sm:text-lg font-fantasy relative z-10 ${
          isFullParty ? 'drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]' : ''
        }`}
      >
        {totalCount}/{max}
      </span>
      {isUserIn && (
        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse" />
      )}
    </button>
  );
};

const ScheduleView = ({ scheduleData, toggleSlot, memberCount }) => {
  const effectiveMax = memberCount && memberCount > 0 ? memberCount : 5;
  const rankedSlots = scheduleData
    .flatMap((date) => {
      const afternoonCount = date.slots.afternoon.partyCount + (date.slots.afternoon.userVote ? 1 : 0);
      const eveningCount = date.slots.evening.partyCount + (date.slots.evening.userVote ? 1 : 0);
      return [
        {
          id: `${date.id}-afternoon`,
          label: `${date.dayName} ${date.dateStr} · Day`,
          count: afternoonCount,
        },
        {
          id: `${date.id}-evening`,
          label: `${date.dayName} ${date.dateStr} · Night`,
          count: eveningCount,
        },
      ];
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return (
    <div className="space-y-6 animate-fade-slide">
      <div className="rpg-panel p-4 sm:p-6 rounded-md">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-6 border-b border-stone-800 pb-4">
          <div>
            <h2 className="text-2xl text-amber-500 flex items-center gap-3 drop-shadow-md">
              <span className="p-1.5 bg-stone-900 rounded border border-stone-800">
                <Map className="w-5 h-5 text-amber-700" />
              </span>
              Calendar
            </h2>
            <p className="text-stone-500 text-sm mt-1 font-body tracking-wide">
              "Time is the most precious of treasures."
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 w-full lg:w-auto">
            <div className="bg-stone-950/60 border border-stone-800 rounded-sm px-4 py-3 text-xs uppercase tracking-[0.2em] text-stone-500">
              Party size
              <div className="text-amber-500 text-xl font-fantasy mt-1">
                {memberCount || 0}
              </div>
            </div>
            <div className="bg-stone-950/60 border border-stone-800 rounded-sm px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-stone-500">Top slots</div>
              {rankedSlots.length === 0 ? (
                <div className="text-stone-600 text-sm mt-2">No votes yet.</div>
              ) : (
                <div className="mt-2 space-y-2">
                  {rankedSlots.map((slot) => {
                    const percent = Math.min(100, Math.round((slot.count / effectiveMax) * 100));
                    return (
                      <div key={slot.id} className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-stone-500">
                          <span>{slot.label}</span>
                          <span className="text-amber-500">{slot.count}/{effectiveMax}</span>
                        </div>
                        <div className="h-1 bg-stone-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-700/60"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[52px_1fr_1fr] sm:grid-cols-[60px_1fr_1fr] gap-3 mb-2 text-stone-600 uppercase tracking-[0.2em] text-[9px] sm:text-[10px] text-center font-bold">
          <div className="text-left pl-1">Date</div>
          <div>Day</div>
          <div>Night</div>
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin ">
          {scheduleData.map((date) => (
            <div
              key={date.id}
            className="grid grid-cols-[52px_1fr_1fr] sm:grid-cols-[60px_1fr_1fr] gap-3 items-center p-2 rounded border border-transparent"
          >
            <div className="flex flex-col border-r border-stone-800/50 pr-2">
              <span
                className={`font-bold font-fantasy text-base sm:text-lg leading-none ${
                  ['Sa', 'So'].includes(date.dayName)
                    ? 'text-amber-500 drop-shadow-sm'
                    : 'text-stone-400'
                }`}
              >
                {date.dayName}
              </span>
              <span className="text-stone-600 text-[9px] sm:text-[10px] font-mono mt-1 tracking-wider">
                {date.dateStr}
              </span>
            </div>
              <HeatmapCell
                slotData={date.slots.afternoon}
                max={effectiveMax}
                onClick={() => toggleSlot(date.id, 'afternoon')}
              />
              <HeatmapCell
                slotData={date.slots.evening}
                max={effectiveMax}
                onClick={() => toggleSlot(date.id, 'evening')}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
const MembersView = ({
  members,
  membersLoading,
  membersError,
  onKickMember,
  onGrantXp,
  isAdmin,
  currentUserId,
  xpTable,
  guildCreatedBy,
}) => {
  const [grantInputs, setGrantInputs] = useState({});

  const updateGrantInput = (memberId, value) => {
    setGrantInputs((prev) => ({ ...prev, [memberId]: value }));
  };

  const handleGrant = (memberId) => {
    const raw = grantInputs[memberId];
    const amount = Number.parseInt(raw, 10);
    if (!Number.isFinite(amount) || amount === 0) return;
    onGrantXp(memberId, amount);
    setGrantInputs((prev) => ({ ...prev, [memberId]: '' }));
  };

  return (
    <div className="space-y-6 animate-fade-slide">
      <div className="rpg-panel p-4 sm:p-6 rounded-md">
        <div className="mb-6 border-b border-stone-800 pb-4">
          <h2 className="text-2xl text-amber-500 flex items-center gap-3">
            <span className="p-1.5 bg-stone-900 rounded border border-stone-800">
              <Users className="w-5 h-5 text-amber-700" />
            </span>
            Member Roster
          </h2>
          <p className="text-stone-500 text-sm mt-1 font-body">
            Everyone inside the guild walls. XP is shared view; only the DM can grant.
          </p>
        </div>

        {membersLoading && (
          <div className="text-sm text-stone-500 italic">Loading members...</div>
        )}
        {membersError && (
          <div className="text-xs text-red-400 border border-red-900/40 bg-red-950/40 py-2 rounded text-center mb-3">
            {membersError}
          </div>
        )}
        {!membersLoading && members.length === 0 && (
          <div className="text-stone-700 italic pl-4 py-4 border-l-2 border-stone-800">
            The hall is empty...
          </div>
        )}
        <div className="grid grid-cols-1 gap-3">
          {members.map((member) => {
            const xpValue = Number.isFinite(member.xp) ? member.xp : 0;
            const levelInfo = getLevelForXp(xpValue, xpTable);
            const nextXpLabel = levelInfo.nextXp ? `${levelInfo.nextXp} XP` : 'Max level';
            const isDm = member.role === 'admin' || member.id === guildCreatedBy;
            return (
              <div
                key={member.id}
                className="bg-stone-950/50 border border-stone-800 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-sm group hover:border-stone-600 transition-all shadow-inner"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full border border-stone-800 bg-stone-950 overflow-hidden flex items-center justify-center">
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt={member.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <User size={16} className="text-stone-600" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-stone-200 font-fantasy">
                      {member.displayName || 'Unknown Adventurer'}
                    </div>
                    <div className="text-[10px] text-stone-600 uppercase tracking-[0.2em]">
                      {isDm ? 'Dungeon Master' : 'Member'}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-stone-500">
                    Level {levelInfo.level} · {xpValue} XP
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-stone-600">
                    Next: {nextXpLabel}
                  </div>
                  <div className="flex items-center gap-2">
                    {isDm && <Crown size={14} className="text-amber-500" />}
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="+XP"
                          className="w-20 rpg-input text-stone-200 px-2 py-1 rounded-sm text-xs font-body focus:outline-none placeholder:text-stone-700"
                          value={grantInputs[member.id] || ''}
                          onChange={(e) => updateGrantInput(member.id, e.target.value)}
                        />
                        <button
                          onClick={() => handleGrant(member.id)}
                          className="text-xs uppercase tracking-[0.2em] bg-amber-900/20 px-3 py-2 rounded-sm border border-amber-900/50 text-amber-400 hover:text-amber-300 transition-colors"
                        >
                          Give
                        </button>
                      </div>
                    )}
                    {isAdmin && member.id !== currentUserId && (
                      <button
                        onClick={() => onKickMember(member.id)}
                        className="text-xs uppercase tracking-[0.2em] bg-red-900/20 px-3 py-2 rounded-sm border border-red-900/50 text-red-400 hover:text-red-300 transition-colors"
                      >
                        Kick
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const renderChatText = (text) => {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, idx) => {
    if (part.match(/https?:\/\/[^\s]+/)) {
      return (
        <a
          key={`link-${idx}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="text-amber-400 underline"
        >
          {part}
        </a>
      );
    }
    return <span key={`text-${idx}`}>{part}</span>;
  });
};

const ChatView = ({
  messages,
  loading,
  error,
  hasMore,
  onLoadMore,
  chatInput,
  setChatInput,
  onSend,
  gifOpen,
  setGifOpen,
  gifQuery,
  setGifQuery,
  gifResults,
  gifLoading,
  gifError,
  onSendGif,
  guilds,
  chatGuildId,
  setChatGuildId,
  onClose,
  autoScrollKey,
}) => {
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [autoScrollKey]);

  return (
  <div className="fixed bottom-6 right-6 z-[80] w-[320px] sm:w-[360px] rounded-2xl border border-stone-800 bg-[#14110e]/95 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-md overflow-hidden animate-fade">
    <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800">
      <div className="flex items-center gap-2 text-sm text-amber-400 uppercase tracking-[0.2em] font-bold">
        <MessageCircle size={14} />
        Chat
      </div>
      <button
        onClick={onClose}
        className="text-stone-500 hover:text-amber-400 transition-colors"
        aria-label="Close chat"
      >
        <X size={16} />
      </button>
    </div>

    <div className="px-4 py-3 border-b border-stone-800 flex items-center gap-2">
      <select
        className="flex-1 bg-stone-950/70 border border-stone-800 text-stone-200 px-3 py-2 rounded-full text-xs uppercase tracking-[0.2em] focus:outline-none"
        value={chatGuildId}
        onChange={(e) => setChatGuildId(e.target.value)}
      >
        {guilds.length === 0 && <option value="">No guilds</option>}
        {guilds.map((guild) => (
          <option key={guild.guildId} value={guild.guildId}>
            {guild.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          if (!GIF_SEARCH_ENABLED) return;
          setGifOpen((prev) => !prev);
        }}
        className={`text-[10px] uppercase tracking-[0.2em] px-3 py-2 rounded-full border transition-colors ${
          GIF_SEARCH_ENABLED
            ? 'bg-stone-900/60 border-stone-800 text-stone-400 hover:text-amber-500'
            : 'bg-stone-900/30 border-stone-900 text-stone-600 cursor-not-allowed'
        }`}
      >
        {GIF_SEARCH_ENABLED ? 'GIFs' : 'GIFs soon'}
      </button>
    </div>

    {gifOpen && GIF_SEARCH_ENABLED && (
      <div className="px-4 py-3 border-b border-stone-800 space-y-3">
        <input
          type="text"
          placeholder="Search GIFs..."
          className="w-full rpg-input text-stone-200 px-3 py-2 rounded-sm text-sm font-body focus:outline-none placeholder:text-stone-700"
          value={gifQuery}
          onChange={(e) => setGifQuery(e.target.value)}
        />
        {gifLoading && <div className="text-xs text-stone-500">Searching...</div>}
        {gifError && <div className="text-xs text-red-400">{gifError}</div>}
        {!gifLoading && !gifError && gifResults.length === 0 && (
          <div className="text-xs text-stone-600">No GIFs found.</div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {gifResults.map((gif) => {
            const thumb = gif?.images?.fixed_width_small?.url
              || gif?.images?.fixed_width?.url
              || gif?.images?.original?.url
              || gif?.media_formats?.tinygif?.url
              || gif?.media_formats?.gif?.url;
            if (!thumb) return null;
            return (
              <button
                key={gif.id || thumb}
                onClick={() => onSendGif(gif)}
                className="rounded-sm overflow-hidden border border-stone-800 hover:border-amber-600/60 transition-colors"
              >
                <img src={thumb} alt={gif.content_description || 'GIF'} className="w-full h-full object-cover" />
              </button>
            );
          })}
        </div>
      </div>
    )}

    {error && (
      <div className="text-xs text-red-400 border border-red-900/40 bg-red-950/40 py-2 rounded text-center m-3">
        {error}
      </div>
    )}

    <div className="px-4 pb-3 space-y-3">
      <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb">
        {hasMore && (
          <button
            onClick={onLoadMore}
            className="w-full text-[10px] uppercase tracking-[0.2em] bg-stone-900/60 px-3 py-2 rounded-full border border-stone-800 text-stone-400 hover:text-amber-500 transition-colors"
          >
            Load older messages
          </button>
        )}
        {loading && <div className="text-sm text-stone-500 italic">Loading chat...</div>}
        {messages.length === 0 && !loading && (
          <div className="text-stone-700 italic">No messages yet. Start the tale.</div>
        )}
        {messages.map((msg) => {
          const time =
            msg.createdAt?.toDate?.() instanceof Date
              ? msg.createdAt.toDate().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
              : '';
          return (
            <div key={msg.id} className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full border border-stone-800 bg-stone-950 overflow-hidden flex items-center justify-center">
                {msg.avatarUrl ? (
                  <img src={msg.avatarUrl} alt={msg.displayName} className="w-full h-full object-cover" />
                ) : (
                  <User size={12} className="text-stone-600" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                  {msg.displayName || 'Unknown'} {time && <span className="ml-2 text-stone-600">{time}</span>}
                </div>
                {msg.type === 'gif' && msg.gifUrl ? (
                  <div className="mt-2 space-y-1">
                    <img
                      src={msg.gifUrl}
                      alt="GIF"
                      className="max-w-[200px] rounded-sm border border-stone-800"
                    />
                    <a
                      href={msg.gifUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[9px] uppercase tracking-[0.2em] text-stone-500 hover:text-amber-400 transition-colors"
                    >
                      Open GIF
                    </a>
                  </div>
                ) : (() => {
                  const derivedGif = deriveGifUrlFromText(msg.text || '');
                  if (derivedGif) {
                    return (
                      <div className="mt-2 space-y-1">
                        <img
                          src={derivedGif}
                          alt="GIF"
                          className="max-w-[200px] rounded-sm border border-stone-800"
                        />
                        <a
                          href={derivedGif}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[9px] uppercase tracking-[0.2em] text-stone-500 hover:text-amber-400 transition-colors"
                        >
                          Open GIF
                        </a>
                      </div>
                    );
                  }
                  return <div className="text-sm text-stone-200 mt-1">{renderChatText(msg.text || '')}</div>;
                })()}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Message or GIF URL..."
            className="flex-1 rpg-input text-stone-200 px-3 py-2 rounded-full text-sm font-body focus:outline-none placeholder:text-stone-700"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
          />
          <button
            onClick={onSend}
            className="fantasy-btn bg-amber-900/20 hover:bg-amber-800/40 text-amber-500 border border-amber-900/50 px-4 py-2 rounded-full transition-all text-xs uppercase tracking-widest"
          >
            Send
          </button>
        </div>
        {deriveGifUrlFromText(chatInput) && (
          <div className="border border-stone-800 rounded-sm bg-stone-950/60 p-2">
            <div className="text-[9px] uppercase tracking-[0.2em] text-stone-500 mb-2">
              GIF preview
            </div>
            <img
              src={deriveGifUrlFromText(chatInput)}
              alt="GIF preview"
              className="max-w-[200px] rounded-sm border border-stone-800"
            />
          </div>
        )}
      </div>
    </div>
  </div>
  );
};

const RulesView = ({
  rules,
  removeRule,
  newRuleTitle,
  setNewRuleTitle,
  newRuleDesc,
  setNewRuleDesc,
  addRule,
  isAdmin,
}) => (
  <div className="space-y-6 animate-fade-slide">
    <div className="rpg-panel p-4 sm:p-6 rounded-md">
      <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none text-amber-500">
        <Crown size={140} />
      </div>

      <div className="mb-6 border-b border-stone-800 pb-4">
        <h2 className="text-2xl text-amber-500 flex items-center gap-3">
          <span className="p-1.5 bg-stone-900 rounded border border-stone-800">
            <Scroll className="w-5 h-5 text-amber-700" />
          </span>
          Laws of the Land
        </h2>
        <p className="text-stone-500 text-sm mt-1 font-body">
          {isAdmin ? 'Proclaim your edicts, ruler.' : 'The unbreakable laws of this realm.'}
        </p>
      </div>

      <div className="grid gap-4 pl-2">
        {rules.length === 0 && (
          <div className="text-stone-700 italic pl-4 py-4 border-l-2 border-stone-800">
            The scrolls are still empty...
          </div>
        )}
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="relative pl-8 py-3 border-l-2 border-stone-800 hover:border-amber-700/50 transition-colors group"
          >
            <div className="absolute -left-[9px] top-4 w-4 h-4 rounded-full bg-stone-900 border-2 border-stone-700 group-hover:border-amber-600 flex items-center justify-center transition-colors shadow-lg">
              <div className="w-1.5 h-1.5 bg-stone-600 group-hover:bg-amber-500 rounded-full transition-colors" />
            </div>

            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-fantasy text-stone-300 group-hover:text-amber-100 transition-colors tracking-wide">
                  {rule.title}
                </h3>
                <p className="text-stone-500 italic text-sm group-hover:text-stone-400 transition-colors mt-1 font-body leading-relaxed">
                  {rule.desc}
                </p>
              </div>

              {isAdmin && (
                <button
                  onClick={() => removeRule(rule.id)}
                  className="text-stone-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1.5 hover:bg-stone-900 rounded"
                  title="Repeal law"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {isAdmin ? (
        <div className="mt-8 pt-6 border-t border-stone-800 grid gap-4 bg-stone-950/30 p-4 rounded-sm border border-stone-800/50 shadow-inner">
          <h4 className="text-xs uppercase tracking-[0.2em] text-stone-500 font-bold mb-2">
            Proclaim a new law
          </h4>
          <input
            type="text"
            placeholder="Title of the law..."
            className="w-full rpg-input text-stone-200 px-3 py-2 rounded-sm text-lg font-fantasy focus:outline-none placeholder:text-stone-700"
            value={newRuleTitle}
            onChange={(e) => setNewRuleTitle(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Describe the rule..."
              className="flex-1 rpg-input text-stone-200 px-3 py-2 rounded-sm text-sm font-body focus:outline-none placeholder:text-stone-700"
              value={newRuleDesc}
              onChange={(e) => setNewRuleDesc(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRule()}
            />
            <button
              onClick={addRule}
              disabled={!newRuleTitle}
              className="fantasy-btn bg-amber-900/20 hover:bg-amber-800/40 text-amber-500 border border-amber-900/50 px-6 rounded-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm uppercase tracking-widest hover:shadow-[0_0_15px_rgba(180,83,9,0.2)] active:translate-y-0.5"
            >
              Sign
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 pt-4 border-t border-stone-800 text-center text-xs text-stone-700 uppercase tracking-widest font-bold">
          <span className="flex items-center justify-center gap-2">
            <Gem size={12} /> Only the DM holds this power <Gem size={12} />
          </span>
        </div>
      )}
    </div>
  </div>
);
const SnackView = ({
  snacks,
  toggleSnack,
  removeSnack,
  newSnackItem,
  setNewSnackItem,
  addSnack,
  currentUser,
  currentUserId,
  currentUserAvatar,
}) => (
  <div className="space-y-6 animate-fade-slide">
    <div className="rpg-panel p-4 sm:p-6 rounded-md">
      <div className="mb-6 border-b border-stone-800 pb-4">
        <h2 className="text-2xl text-amber-500 flex items-center gap-3">
          <span className="p-1.5 bg-stone-900 rounded border border-stone-800">
            <Pizza className="w-5 h-5 text-amber-700" />
          </span>
          Tavern Stock
        </h2>
        <p className="text-stone-500 text-sm mt-1 font-body">
          A hungry hero never hits. Stock the larder.
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {snacks.map((snack) => (
          <div
            key={snack.id}
            className="flex items-center justify-between p-3 bg-stone-950/60 border border-stone-800 rounded-sm group hover:border-stone-600 transition-all"
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-10 h-10 rounded-sm flex items-center justify-center font-fantasy font-bold text-lg border-2 shadow-lg overflow-hidden ${
                  snack.brought
                    ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-600'
                    : 'bg-amber-950/40 border-amber-900/60 text-amber-600'
                }`}
              >
                {snack.userAvatar || (snack.userId === currentUserId && currentUserAvatar) ? (
                  <img
                    src={snack.userAvatar || currentUserAvatar}
                    alt={snack.user}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  snack.user.substring(0, 1).toUpperCase()
                )}
              </div>
              <div>
                <p
                  className={`font-fantasy text-lg leading-none mb-1 transition-colors ${
                    snack.brought ? 'text-stone-500 line-through decoration-stone-700' : 'text-stone-200'
                  }`}
                >
                  {snack.item}
                </p>
                <p className="text-stone-600 text-[10px] uppercase tracking-[0.2em] flex items-center gap-1 font-bold">
                  By {snack.user}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleSnack(snack)}
                className={`p-2 rounded-full transition-all border ${
                  snack.brought
                    ? 'text-emerald-500 bg-emerald-950/20 border-emerald-900/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                    : 'text-stone-600 border-stone-800 hover:border-amber-700 hover:text-amber-500'
                }`}
                title={snack.brought ? 'Mark as missing' : 'Mark as looted'}
              >
                {snack.brought ? <Check size={16} /> : <div className="w-4 h-4" />}
              </button>
              <button
                onClick={() => removeSnack(snack.id)}
                className="text-stone-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 hover:bg-stone-900 rounded"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-4 border-t border-stone-800">
        <input
          type="text"
          placeholder={`I (${currentUser}) bring...`}
          className="flex-1 rpg-input text-stone-200 px-4 py-3 rounded-sm font-body placeholder:text-stone-700 focus:outline-none"
          value={newSnackItem}
          onChange={(e) => setNewSnackItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addSnack()}
        />
        <button
          onClick={addSnack}
          disabled={!newSnackItem}
          className="fantasy-btn bg-stone-900 hover:bg-amber-900/30 text-stone-400 hover:text-amber-500 p-3 rounded-sm border border-stone-800 hover:border-amber-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  </div>
);

const AuthScreen = ({
  mode,
  setMode,
  email,
  setEmail,
  password,
  setPassword,
  displayName,
  setDisplayName,
  onSubmit,
  error,
  loading,
  pendingInviteCode,
  verifyNotice,
}) => (
  <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
    <div className="max-w-md w-full rpg-panel p-6 sm:p-10 rounded-lg animate-zoom flex flex-col items-center">
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="w-24 h-24 bg-[#0c0a09] rounded-full flex items-center justify-center border-4 border-[#1c1917] shadow-2xl animate-glow overflow-hidden">
          <img src={logo} alt="Guildhall" className="w-full h-full object-cover rounded-full" />
        </div>
      </div>

      <div className="text-center mt-12 mb-8">
        <h1 className="text-4xl text-amber-500 font-bold mb-2 tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          Welcome to the GuildHall
        </h1>
        <div className="h-px w-32 bg-gradient-to-r from-transparent via-amber-900 to-transparent mx-auto my-4"></div>
        <p className="text-stone-500 italic font-body">"Identify yourself, wanderer."</p>
      </div>

      <div className="w-full space-y-4">
        {pendingInviteCode && (
          <div className="text-xs text-emerald-400 text-center border border-emerald-900/40 bg-emerald-950/30 py-2 rounded uppercase tracking-[0.2em]">
            Invite detected · {pendingInviteCode}
          </div>
        )}
        {verifyNotice && (
          <div className="text-xs text-amber-300 text-center border border-amber-900/40 bg-amber-950/30 py-2 rounded uppercase tracking-[0.2em]">
            {verifyNotice}
          </div>
        )}
        {mode === 'signup' && (
          <div className="relative group">
            <input
              type="text"
              className="w-full bg-stone-950 border-2 border-stone-800 text-stone-200 px-6 py-3 rounded-md text-lg font-fantasy text-center focus:outline-none focus:border-amber-700 transition-colors shadow-inner placeholder:text-stone-800"
              placeholder="Hero name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <div className="absolute inset-0 border border-amber-500/20 rounded-md pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
          </div>
        )}

        <div className="relative group">
          <input
            type="email"
            className="w-full bg-stone-950 border-2 border-stone-800 text-stone-200 px-6 py-3 rounded-md text-lg font-fantasy text-center focus:outline-none focus:border-amber-700 transition-colors shadow-inner placeholder:text-stone-800"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          <div className="absolute inset-0 border border-amber-500/20 rounded-md pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
        </div>

        <div className="relative group">
          <input
            type="password"
            className="w-full bg-stone-950 border-2 border-stone-800 text-stone-200 px-6 py-3 rounded-md text-lg font-fantasy text-center focus:outline-none focus:border-amber-700 transition-colors shadow-inner placeholder:text-stone-800"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          />
          <div className="absolute inset-0 border border-amber-500/20 rounded-md pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
        </div>

        {error && (
          <div className="text-xs text-red-400 text-center border border-red-900/40 bg-red-950/40 py-2 rounded">
            {error}
          </div>
        )}

        <button
          onClick={onSubmit}
          disabled={loading || !email || !password || (mode === 'signup' && !displayName)}
          className="fantasy-btn w-full bg-gradient-to-b from-amber-800 to-amber-950 hover:from-amber-700 hover:to-amber-900 text-amber-100 py-4 rounded-md font-bold uppercase tracking-[0.2em] text-sm transition-all disabled:opacity-50 disabled:grayscale border-t border-amber-700/50 shadow-[0_5px_15px_rgba(0,0,0,0.5)] active:translate-y-0.5"
        >
          {mode === 'login' ? 'Enter the hall' : 'Forge the pact'}
        </button>

        <button
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          className="text-xs text-stone-600 hover:text-amber-600 transition-colors uppercase tracking-widest font-bold flex items-center justify-center gap-2 mx-auto"
        >
          <LogIn size={12} />
          {mode === 'login' ? 'No account yet? Sign up' : 'Already registered? Sign in'}
        </button>
      </div>

      <div className="mt-8 text-[10px] text-stone-700 uppercase tracking-widest font-bold">
        v2.0 Session Manager
      </div>
    </div>
  </div>
);

const VerifyScreen = ({ email, onResend, onRefresh, onSignOut, notice, loading }) => (
  <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
    <div className="max-w-md w-full rpg-panel p-6 sm:p-10 rounded-lg animate-zoom flex flex-col items-center">
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="w-24 h-24 bg-[#0c0a09] rounded-full flex items-center justify-center border-4 border-[#1c1917] shadow-2xl animate-glow overflow-hidden">
          <img src={logo} alt="Guildhall" className="w-full h-full object-cover rounded-full" />
        </div>
      </div>

      <div className="text-center mt-12 mb-8">
        <h1 className="text-3xl text-amber-500 font-bold mb-2 tracking-wide">
          Verify your email
        </h1>
        <div className="h-px w-32 bg-gradient-to-r from-transparent via-amber-900 to-transparent mx-auto my-4"></div>
        <p className="text-stone-500 italic font-body">
          We sent a verification link to
        </p>
        <p className="text-stone-200 font-mono text-sm mt-2">{email}</p>
      </div>

      {notice && (
        <div className="text-xs text-amber-300 text-center border border-amber-900/40 bg-amber-950/30 py-2 rounded uppercase tracking-[0.2em] w-full mb-4">
          {notice}
        </div>
      )}

      <div className="w-full space-y-3">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="fantasy-btn w-full bg-gradient-to-b from-amber-800 to-amber-950 hover:from-amber-700 hover:to-amber-900 text-amber-100 py-4 rounded-md font-bold uppercase tracking-[0.2em] text-sm transition-all border-t border-amber-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Checking...' : 'I verified, continue'}
        </button>
        <button
          onClick={onResend}
          className="w-full text-xs uppercase tracking-[0.2em] bg-stone-900/60 px-4 py-3 rounded-sm border border-stone-800 text-stone-400 hover:text-amber-500 transition-colors"
        >
          Resend verification email
        </button>
        <button
          onClick={onSignOut}
          className="w-full text-xs uppercase tracking-[0.2em] bg-red-900/20 px-4 py-3 rounded-sm border border-red-900/50 text-red-400 hover:text-red-300 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  </div>
);
const GroupSelectScreen = ({
  userName,
  guildName,
  setGuildName,
  guilds,
  guildsLoading,
  guildsError,
  onJoinGroup,
  onOpenCreateGuild,
  onSelectGuild,
  onLeaveGuild,
  onSignOut,
  onSkip,
  joinError,
  createError,
  loading,
  userAvatar,
}) => {
  const [joinCode, setJoinCode] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
      <div className="max-w-xl w-full rpg-panel p-5 sm:p-8 rounded-lg animate-fade-slide">
        <div className="mb-10 border-b border-stone-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-stone-800 bg-stone-950 overflow-hidden flex items-center justify-center">
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
              ) : (
                <User size={16} className="text-stone-600" />
              )}
            </div>
            <h2 className="text-3xl text-stone-300 font-fantasy">
              Welcome, <span className="text-amber-500 drop-shadow-md">{userName}</span>.
            </h2>
          </div>
          <p className="text-stone-500 text-sm mt-2 font-body tracking-wide">
            Your fate awaits. Choose wisely.
          </p>
        </div>

        <div className="grid gap-6">
          <GuildList
            guilds={guilds}
            guildsLoading={guildsLoading}
            guildsError={guildsError}
            onSelectGuild={onSelectGuild}
            onLeaveGuild={onLeaveGuild}
          />
          <div className="group relative bg-stone-950 hover:bg-black border border-stone-800 hover:border-amber-700 p-6 rounded-md text-left transition-all hover:shadow-[0_0_20px_rgba(217,119,6,0.1)] overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Crown size={80} />
            </div>
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-950/30 rounded-full border border-amber-900/50 flex items-center justify-center text-amber-600 group-hover:text-amber-400 group-hover:scale-110 transition-all">
                  <Crown size={24} />
                </div>
                <div>
                  <h3 className="text-xl text-stone-300 group-hover:text-amber-500 transition-colors font-fantasy">
                    Found a new guild
                  </h3>
                  <p className="text-stone-600 text-xs mt-0.5 uppercase tracking-wider font-bold">
                    Dungeon Master Mode
                  </p>
                </div>
              </div>
              <ArrowRight
                size={20}
                className="text-stone-700 group-hover:text-amber-500 transition-all -translate-x-4 group-hover:translate-x-0 opacity-50 group-hover:opacity-100"
              />
            </div>
            <p className="text-stone-500 text-sm pl-[64px] font-body leading-relaxed group-hover:text-stone-400 transition-colors">
              Create a new pact. You become the admin, keeper of the laws.
            </p>
            <div className="mt-4 pl-[64px]">
              <input
                type="text"
                placeholder="Guild name (optional)"
                className="w-full bg-stone-900 border border-stone-700 text-stone-200 px-4 py-3 rounded-sm text-sm focus:outline-none focus:border-amber-600 transition-colors font-body shadow-inner"
                value={guildName}
                onChange={(e) => setGuildName(e.target.value)}
              />
              {createError && (
                <div className="text-xs text-red-400 mt-2 border border-red-900/40 bg-red-950/40 py-2 rounded text-center">
                  {createError}
                </div>
              )}
                            <button
                              onClick={onOpenCreateGuild}
                              disabled={loading}
                              className="fantasy-btn mt-3 bg-amber-900/20 hover:bg-amber-800/40 text-amber-500 border border-amber-900/50 px-6 py-2 rounded-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm uppercase tracking-widest hover:shadow-[0_0_15px_rgba(180,83,9,0.2)]"
                            >
                              Create guild
                            </button>
            </div>
          </div>

          <div className="bg-stone-950 border border-stone-800 p-6 rounded-md relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Users size={80} />
            </div>
            <div className="flex items-center gap-4 mb-6 relative z-10">
              <div className="w-12 h-12 bg-emerald-950/30 rounded-full border border-emerald-900/50 flex items-center justify-center text-emerald-700">
                <Users size={24} />
              </div>
              <div>
                <h3 className="text-xl text-stone-300 font-fantasy">Join a guild</h3>
                <p className="text-stone-600 text-xs mt-0.5 uppercase tracking-wider font-bold">
                  Player Mode
                </p>
              </div>
            </div>
            <div className="flex gap-2 relative z-10">
              <input
                type="text"
                placeholder="INVITE CODE"
                className="flex-1 bg-stone-900 border border-stone-700 text-stone-200 px-4 py-3 rounded-sm text-sm focus:outline-none focus:border-emerald-600 transition-colors font-mono tracking-widest shadow-inner"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              />
              <button
                onClick={() => joinCode && onJoinGroup(joinCode)}
                disabled={!joinCode || loading}
                className="fantasy-btn min-w-[120px] bg-emerald-900/20 hover:bg-emerald-800/40 text-emerald-500 border border-emerald-900/50 px-6 py-3 rounded-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm uppercase tracking-widest font-bold hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
              >
                Join
              </button>
            </div>
            {joinError && (
              <div className="text-xs text-red-400 mt-3 border border-red-900/40 bg-red-950/40 py-2 rounded text-center">
                {joinError}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={onSignOut}
            className="text-xs text-stone-600 hover:text-amber-600 transition-colors uppercase tracking-widest font-bold flex items-center justify-center gap-2 mx-auto"
          >
            <ArrowRight size={12} className="rotate-180" /> Sign out
          </button>
          <button
            onClick={onSkip}
            className="mt-4 text-[10px] text-stone-600 hover:text-emerald-500 transition-colors uppercase tracking-widest font-bold"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
};

const PreGuildHome = ({
  userName,
  guilds,
  guildsLoading,
  guildsError,
  onSelectGuild,
  onLeaveGuild,
  onCreateGuild,
  onJoinGuild,
  joinCode,
  setJoinCode,
  joinError,
  loading,
  onBack,
}) => (
  <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
    <div className="max-w-3xl w-full rpg-panel p-5 sm:p-8 rounded-lg animate-fade-slide">
      <div className="mb-8 border-b border-stone-800 pb-6">
        <h2 className="text-3xl text-stone-300 font-fantasy">
          Welcome, <span className="text-amber-500 drop-shadow-md">{userName}</span>.
        </h2>
        <p className="text-stone-500 text-sm mt-2 font-body tracking-wide">
          This hub keeps your party aligned: vote on sessions, track rules, members, and loot.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-stone-950/70 border border-stone-800 rounded-md p-4">
            <h3 className="text-xs uppercase tracking-[0.3em] text-stone-500 font-bold mb-3">
              Quick actions
            </h3>
            <div className="grid gap-2">
              <button
                onClick={onCreateGuild}
                disabled={loading}
                className="text-left text-xs uppercase tracking-[0.2em] bg-amber-900/20 px-4 py-3 rounded-sm border border-amber-900/50 text-amber-500 hover:text-amber-300 transition-colors disabled:opacity-30"
              >
                Create a guild
              </button>
              <button
                onClick={() => joinCode && onJoinGuild(joinCode)}
                disabled={!joinCode || loading}
                className="text-left text-xs uppercase tracking-[0.2em] bg-emerald-900/20 px-4 py-3 rounded-sm border border-emerald-900/50 text-emerald-500 hover:text-emerald-300 transition-colors disabled:opacity-30"
              >
                Join with code
              </button>
              <button
                onClick={onBack}
                className="text-left text-xs uppercase tracking-[0.2em] bg-stone-900/60 px-4 py-3 rounded-sm border border-stone-800 text-stone-400 hover:text-amber-500 transition-colors"
              >
                Back to selection
              </button>
            </div>
          </div>

          <div className="bg-stone-950/70 border border-stone-800 rounded-md p-4">
            <h3 className="text-xs uppercase tracking-[0.3em] text-stone-500 font-bold mb-3">
              Join a guild
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="INVITE CODE"
                className="flex-1 bg-stone-900 border border-stone-700 text-stone-200 px-4 py-3 rounded-sm text-sm focus:outline-none focus:border-emerald-600 transition-colors font-mono tracking-widest shadow-inner"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              />
              <button
                onClick={() => joinCode && onJoinGuild(joinCode)}
                disabled={!joinCode || loading}
                className="fantasy-btn min-w-[140px] bg-emerald-900/20 hover:bg-emerald-800/40 text-emerald-500 border border-emerald-900/50 px-6 rounded-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm uppercase tracking-widest font-bold"
              >
                Join
              </button>
            </div>
            {joinError && (
              <div className="text-xs text-red-400 mt-3 border border-red-900/40 bg-red-950/40 py-2 rounded text-center">
                {joinError}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-stone-950/70 border border-stone-800 rounded-md p-4">
            <h3 className="text-xs uppercase tracking-[0.3em] text-stone-500 font-bold mb-3">
              Your guilds
            </h3>
            <GuildList
              guilds={guilds}
              guildsLoading={guildsLoading}
              guildsError={guildsError}
              onSelectGuild={onSelectGuild}
              onLeaveGuild={onLeaveGuild}
              leaveError={leaveError}
            />
          </div>
          <div className="bg-stone-950/70 border border-stone-800 rounded-md p-4">
            <h3 className="text-xs uppercase tracking-[0.3em] text-stone-500 font-bold mb-3">
              What this tool does
            </h3>
            <ul className="text-sm text-stone-500 space-y-2">
              <li>- Live scheduling with realtime votes.</li>
              <li>- Member roster and campaign rules.</li>
              <li>- Party loot and snack tracking.</li>
              <li>- Unified profiles and guild management.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const App = () => {
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState({ displayName: '', bio: '', avatarUrl: '' });
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState('');
  const [emailVerified, setEmailVerified] = useState(true);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const [activeGuildId, setActiveGuildId] = useState('');
  const [guildData, setGuildData] = useState(null);
  const [memberRole, setMemberRole] = useState('');
  const [joinError, setJoinError] = useState('');
  const [createError, setCreateError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [guildName, setGuildName] = useState('');

  const [activeTab, setActiveTab] = useState('home');
  const [preGuildScreen, setPreGuildScreen] = useState('select');
  const [scheduleData, setScheduleData] = useState([]);
  const [guildMembers, setGuildMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [rules, setRules] = useState([]);
  const [snacks, setSnacks] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatLastDoc, setChatLastDoc] = useState(null);
  const [chatHasMore, setChatHasMore] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatGuildId, setChatGuildId] = useState('');
  const [chatAutoScrollKey, setChatAutoScrollKey] = useState(0);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState('');
  const [userGuilds, setUserGuilds] = useState([]);
  const [guildsLoading, setGuildsLoading] = useState(false);
  const [guildsError, setGuildsError] = useState('');
  const [overviewJoinCode, setOverviewJoinCode] = useState('');
  const [createGuildOpen, setCreateGuildOpen] = useState(false);
  const [createGuildForm, setCreateGuildForm] = useState({
    name: '',
    description: '',
    imageUrl: '',
  });

  const [newRuleTitle, setNewRuleTitle] = useState('');
  const [newRuleDesc, setNewRuleDesc] = useState('');
  const [newSnackItem, setNewSnackItem] = useState('');
  const [profileForm, setProfileForm] = useState({ displayName: '', bio: '', avatarUrl: '' });
  const [guildForm, setGuildForm] = useState({ name: '', description: '', imageUrl: '', xpTable: [] });
  const [profileAvatarPreview, setProfileAvatarPreview] = useState('');
  const [xpLevelInput, setXpLevelInput] = useState('');
  const [xpValueInput, setXpValueInput] = useState('');
  const [guildImagePreview, setGuildImagePreview] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [guildSaving, setGuildSaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingInviteCode, setPendingInviteCode] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');
    const inviteParam = params.get('invite');

    const clearQuery = () => {
      window.history.replaceState({}, '', window.location.pathname);
    };

    if (mode === 'verifyEmail' && oobCode) {
      applyActionCode(auth, oobCode)
        .then(() => {
          setVerifyNotice('Email verified. You can continue.');
          setEmailVerified(true);
        })
        .catch(() => {
          setVerifyNotice('Verification failed or expired. Please resend.');
        })
        .finally(() => {
          clearQuery();
        });
      return;
    }

    if (inviteParam) {
      const cleaned = inviteParam.trim().toUpperCase();
      if (cleaned) {
        localStorage.setItem('dndhub:pendingInvite', cleaned);
        setPendingInviteCode(cleaned);
        setOverviewJoinCode((prev) => prev || cleaned);
      }
      clearQuery();
    }
  }, []);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthUser(null);
        setProfile({ displayName: '' });
        setEmailVerified(true);
        setAuthReady(true);
        return;
      }

      setAuthUser(user);
      setEmailVerified(user.emailVerified);
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        const storedAvatar = localStorage.getItem(`dndhub:avatar:${user.uid}`) || '';
        const avatarUrl = data.avatarUrl || storedAvatar || '';
        const displayName = data.displayName || user.displayName || '';
        setProfile({
          displayName,
          bio: data.bio || '',
          avatarUrl,
        });
        if (avatarUrl && data.avatarUrl !== avatarUrl) {
          setDoc(
            userRef,
            {
              displayName,
              bio: data.bio || '',
              avatarUrl,
            },
            { merge: true }
          ).catch(() => {});
        }
        if (avatarUrl) {
          localStorage.setItem(`dndhub:avatar:${user.uid}`, avatarUrl);
        }
      } else {
        const nameFromAuth = user.displayName || '';
        if (nameFromAuth) {
          await setDoc(userRef, {
            displayName: nameFromAuth,
            email: user.email,
            createdAt: serverTimestamp(),
          });
        }
        setProfile({ displayName: nameFromAuth, bio: '', avatarUrl: '' });
      }

      setAuthReady(true);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authUser) return;
    const storedInvite = localStorage.getItem('dndhub:pendingInvite') || '';
    if (storedInvite) {
      setPendingInviteCode(storedInvite);
      setOverviewJoinCode((prev) => prev || storedInvite);
    }
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      setActiveGuildId('');
      return;
    }
    const stored = localStorage.getItem(`dndhub:activeGuild:${authUser.uid}`);
    if (stored) {
      setActiveGuildId(stored);
    }
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      setUserGuilds([]);
      setGuildsError('');
      return undefined;
    }
    setGuildsLoading(true);
    setGuildsError('');
    const userRef = doc(db, 'users', authUser.uid);
    const unsub = onSnapshot(
      userRef,
      async (snap) => {
        const data = snap.data() || {};
        const guildIds = data.guildIds || [];
        if (!Array.isArray(guildIds) || guildIds.length === 0) {
          setUserGuilds([]);
          setGuildsLoading(false);
          return;
        }
        const guildDocs = await Promise.all(
          guildIds.map(async (guildId) => {
            const [guildSnap, memberSnap] = await Promise.all([
              getDoc(doc(db, 'guilds', guildId)),
              getDoc(doc(db, 'guilds', guildId, 'members', authUser.uid)),
            ]);
            if (!guildSnap.exists() || !memberSnap.exists()) return null;
            const guildData = guildSnap.data();
            const memberData = memberSnap.data();
            return {
              guildId,
              role: memberData.role,
              inviteCode: memberData.inviteCode || guildData.inviteCode,
              name: guildData.name,
              description: guildData.description || '',
              imageUrl: guildData.imageUrl || '',
            };
          })
        );
        setUserGuilds(guildDocs.filter(Boolean));
        setGuildsLoading(false);
      },
      (err) => {
        setGuildsLoading(false);
        setGuildsError(err?.message || 'Failed to load guilds.');
      }
    );
    return () => unsub();
  }, [authUser]);

  useEffect(() => {
    if (!authUser || !activeGuildId) {
      setGuildData(null);
      setMemberRole('');
      return undefined;
    }

    const guildRef = doc(db, 'guilds', activeGuildId);
    const memberRef = doc(db, 'guilds', activeGuildId, 'members', authUser.uid);

    const unsubGuild = onSnapshot(guildRef, (snap) => {
      setGuildData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });

    const unsubMember = onSnapshot(memberRef, (snap) => {
      setMemberRole(snap.exists() ? snap.data().role : '');
    });

    return () => {
      unsubGuild();
      unsubMember();
    };
  }, [authUser, activeGuildId]);

  useEffect(() => {
    if (!authUser || !activeGuildId || !guildData) return;
    if (guildData.createdBy === authUser.uid && memberRole !== 'admin') {
      updateDoc(doc(db, 'guilds', activeGuildId, 'members', authUser.uid), {
        role: 'admin',
      }).catch(() => {});
    }
  }, [authUser, activeGuildId, guildData, memberRole]);

  useEffect(() => {
    if (!authUser || !activeGuildId) return;
    setDoc(
      doc(db, 'users', authUser.uid),
      { guildIds: arrayUnion(activeGuildId) },
      { merge: true }
    ).catch(() => {});
  }, [authUser, activeGuildId]);

  useEffect(() => {
    if (!authUser || !activeGuildId) {
      setScheduleData([]);
      setRules([]);
      setSnacks([]);
      return undefined;
    }

    const calendarQuery = query(
      collection(db, 'guilds', activeGuildId, 'calendar'),
      orderBy('dateKey', 'asc')
    );
    const rulesQuery = query(
      collection(db, 'guilds', activeGuildId, 'rules'),
      orderBy('createdAt', 'asc')
    );
    const snacksQuery = query(
      collection(db, 'guilds', activeGuildId, 'snacks'),
      orderBy('createdAt', 'asc')
    );

    const unsubCalendar = onSnapshot(calendarQuery, (snap) => {
      const next = snap.docs.map((docSnap) => {
        const data = docSnap.data();
        const afternoonVoters = data.slots?.afternoon?.voters || [];
        const eveningVoters = data.slots?.evening?.voters || [];
        const afternoonHasUser = afternoonVoters.includes(authUser.uid);
        const eveningHasUser = eveningVoters.includes(authUser.uid);
        return {
          id: docSnap.id,
          dayName: data.dayName,
          dateStr: data.dateStr,
          slots: {
            afternoon: {
              userVote: afternoonHasUser,
              partyCount: afternoonVoters.length - (afternoonHasUser ? 1 : 0),
            },
            evening: {
              userVote: eveningHasUser,
              partyCount: eveningVoters.length - (eveningHasUser ? 1 : 0),
            },
          },
        };
      });
      setScheduleData(next);
    });

    const unsubRules = onSnapshot(rulesQuery, (snap) => {
      setRules(
        snap.docs.map((docSnap) => ({
          id: docSnap.id,
          title: docSnap.data().title,
          desc: docSnap.data().desc,
        }))
      );
    });

    const unsubSnacks = onSnapshot(snacksQuery, (snap) => {
      setSnacks(
        snap.docs.map((docSnap) => ({
          id: docSnap.id,
          item: docSnap.data().item,
          user: docSnap.data().userName,
          userId: docSnap.data().userId,
          userAvatar: docSnap.data().userAvatar || '',
          brought: docSnap.data().brought,
        }))
      );
    });

    return () => {
      unsubCalendar();
      unsubRules();
      unsubSnacks();
    };
  }, [authUser, activeGuildId]);

  useEffect(() => {
    if (!authUser || !activeGuildId) {
      setGuildMembers([]);
      setMembersLoading(false);
      setMembersError('');
      return undefined;
    }
    setMembersLoading(true);
    setMembersError('');
    const membersQuery = query(collection(db, 'guilds', activeGuildId, 'members'));
    const unsub = onSnapshot(
      membersQuery,
      (snap) => {
        const next = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        next.sort((a, b) => {
          const roleA = a.role === 'admin' ? 0 : 1;
          const roleB = b.role === 'admin' ? 0 : 1;
          if (roleA !== roleB) return roleA - roleB;
          return (a.displayName || '').localeCompare(b.displayName || '');
        });
        setGuildMembers(next);
        setMembersLoading(false);
      },
      (err) => {
        setMembersLoading(false);
        setMembersError(err?.message || 'Failed to load members.');
      }
    );
    return () => unsub();
  }, [authUser, activeGuildId]);

  useEffect(() => {
    if (!authUser || !chatGuildId) {
      setChatMessages([]);
      setChatLoading(false);
      setChatError('');
      setChatLastDoc(null);
      setChatHasMore(false);
      return undefined;
    }
    setChatLoading(true);
    setChatError('');
    const baseQuery = query(
      collection(db, 'guilds', chatGuildId, 'chat'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(
      baseQuery,
      (snap) => {
        const docs = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setChatMessages(docs.reverse());
      setChatLastDoc(snap.docs[snap.docs.length - 1] || null);
      setChatHasMore(snap.docs.length === 50);
      setChatLoading(false);
      setChatAutoScrollKey((prev) => prev + 1);
    },
      (err) => {
        setChatLoading(false);
        setChatError(err?.message || 'Failed to load chat.');
      }
    );
    return () => unsub();
  }, [authUser, chatGuildId]);

  useEffect(() => {
    if (!gifOpen || !GIF_SEARCH_ENABLED) return undefined;
    const queryText = gifQuery.trim();
    setGifLoading(true);
    setGifError('');
    const timer = setTimeout(() => {
      const endpoint = queryText
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_PUBLIC_KEY}&q=${encodeURIComponent(
            queryText
          )}&limit=12&rating=pg`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_PUBLIC_KEY}&limit=12&rating=pg`;
      fetch(endpoint)
        .then(async (res) => {
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `HTTP ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          const results = Array.isArray(data?.data) ? data.data : [];
          setGifResults(results);
        })
        .catch((err) => {
          setGifError(`Failed to load GIFs. ${err?.message || ''}`.trim());
        })
        .finally(() => {
          setGifLoading(false);
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [gifOpen, gifQuery]);

  useEffect(() => {
    if (!authUser) {
      setChatGuildId('');
      return;
    }
    if (activeGuildId) {
      setChatGuildId(activeGuildId);
      return;
    }
    if (userGuilds.length > 0) {
      setChatGuildId(userGuilds[0].guildId);
    }
  }, [authUser, activeGuildId, userGuilds]);

  useEffect(() => {
    if (chatOpen) {
      setChatAutoScrollKey((prev) => prev + 1);
    }
  }, [chatOpen, chatGuildId]);

  useEffect(() => {
    setProfileForm({
      displayName: profile.displayName || '',
      bio: profile.bio || '',
      avatarUrl: profile.avatarUrl || '',
    });
  }, [profile.displayName, profile.bio, profile.avatarUrl]);

  useEffect(() => {
    if (!guildData) return;
    setGuildForm({
      name: guildData.name || '',
      description: guildData.description || '',
      imageUrl: guildData.imageUrl || '',
      xpTable: Array.isArray(guildData.xpTable) ? guildData.xpTable : [],
    });
  }, [guildData]);

  useEffect(() => {
    setProfileAvatarPreview(profileForm.avatarUrl || '');
  }, [profileForm.avatarUrl]);

  useEffect(() => {
    setGuildImagePreview(guildForm.imageUrl || '');
  }, [guildForm.imageUrl]);

  const isAdmin = memberRole === 'admin' || guildData?.createdBy === authUser?.uid;

  const persistProfile = async (nextProfile) => {
    if (!authUser) return;
    setProfileSaving(true);
    try {
      const avatarUrl = nextProfile.avatarUrl || '';
      await setDoc(
        doc(db, 'users', authUser.uid),
        {
          displayName: nextProfile.displayName.trim(),
          bio: nextProfile.bio.trim(),
          avatarUrl,
        },
        { merge: true }
      );
      if (activeGuildId) {
        await updateDoc(doc(db, 'guilds', activeGuildId, 'members', authUser.uid), {
          displayName: nextProfile.displayName.trim(),
          avatarUrl,
        });
      }
      await updateProfile(authUser, { displayName: nextProfile.displayName.trim(), photoURL: avatarUrl });
      setProfile((prev) => ({
        ...prev,
        displayName: nextProfile.displayName.trim(),
        bio: nextProfile.bio.trim(),
        avatarUrl,
      }));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    await persistProfile(profileForm);
  };

  const handleSelectProfileAvatar = async (preset) => {
    if (authUser) {
      localStorage.setItem(`dndhub:avatar:${authUser.uid}`, preset);
    }
    const nextProfile = { ...profileForm, avatarUrl: preset };
    setProfileForm(nextProfile);
    await persistProfile(nextProfile);
  };

  const handleSaveGuild = async () => {
    if (!authUser || !activeGuildId || !isAdmin) return;
    setGuildSaving(true);
    try {
      const imageUrl = guildForm.imageUrl || '';
      await updateDoc(doc(db, 'guilds', activeGuildId), {
        name: guildForm.name.trim(),
        description: guildForm.description.trim(),
        imageUrl,
        xpTable: Array.isArray(guildForm.xpTable) ? guildForm.xpTable : [],
      });
    } finally {
      setGuildSaving(false);
    }
  };

  const handleSelectGuildImage = async (preset) => {
    if (!authUser || !activeGuildId || !isAdmin) return;
    const nextGuild = { ...guildForm, imageUrl: preset };
    setGuildForm(nextGuild);
    setGuildSaving(true);
    try {
      await updateDoc(doc(db, 'guilds', activeGuildId), {
        name: nextGuild.name.trim(),
        description: nextGuild.description.trim(),
        imageUrl: preset,
        xpTable: Array.isArray(nextGuild.xpTable) ? nextGuild.xpTable : [],
      });
    } finally {
      setGuildSaving(false);
    }
  };

  const handleAddXpRow = () => {
    if (!isAdmin) return;
    const level = Number.parseInt(xpLevelInput, 10);
    const xp = Number.parseInt(xpValueInput, 10);
    if (!Number.isFinite(level) || !Number.isFinite(xp) || level <= 0 || xp < 0) return;
    const next = Array.isArray(guildForm.xpTable) ? [...guildForm.xpTable] : [];
    const existingIndex = next.findIndex((row) => row.level === level);
    if (existingIndex >= 0) {
      next[existingIndex] = { level, xp };
    } else {
      next.push({ level, xp });
    }
    next.sort((a, b) => a.level - b.level);
    setGuildForm({ ...guildForm, xpTable: next });
    setXpLevelInput('');
    setXpValueInput('');
  };

  const handleRemoveXpRow = (level) => {
    if (!isAdmin) return;
    const next = (guildForm.xpTable || []).filter((row) => row.level !== level);
    setGuildForm({ ...guildForm, xpTable: next });
  };

  const handleLoadDefaultXp = () => {
    if (!isAdmin) return;
    setGuildForm({ ...guildForm, xpTable: defaultXpTable });
  };

  const leaveGuild = async (guildId) => {
    if (!authUser || !guildId) return;
    setLeaveError('');
    try {
      const membersSnap = await getDocs(collection(db, 'guilds', guildId, 'members'));
      const members = membersSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      const current = members.find((member) => member.id === authUser.uid);
      if (!current) return;
      if (members.length === 1) {
        const guildSnap = await getDoc(doc(db, 'guilds', guildId));
        const inviteCode = guildSnap.exists() ? guildSnap.data().inviteCode : '';

        const collections = ['calendar', 'safety', 'rules', 'snacks'];
        for (const sub of collections) {
          const subSnap = await getDocs(collection(db, 'guilds', guildId, sub));
          const batch = writeBatch(db);
          subSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
          await batch.commit();
        }

        if (inviteCode) {
          await deleteDoc(doc(db, 'inviteCodes', inviteCode));
        }
        await deleteDoc(doc(db, 'guilds', guildId));
        await deleteDoc(doc(db, 'guilds', guildId, 'members', authUser.uid));
      } else if (current.role === 'admin') {
        const others = members.filter((member) => member.id !== authUser.uid);
        if (others.length === 0) {
          setLeaveError('You are the last member. Invite someone before leaving.');
          return;
        }
        const nextAdmin = others[Math.floor(Math.random() * others.length)];
        const batch = writeBatch(db);
        batch.update(doc(db, 'guilds', guildId, 'members', nextAdmin.id), { role: 'admin' });
        batch.delete(doc(db, 'guilds', guildId, 'members', authUser.uid));
        await batch.commit();
      } else {
        await deleteDoc(doc(db, 'guilds', guildId, 'members', authUser.uid));
      }
      if (activeGuildId === guildId) {
        localStorage.removeItem(`dndhub:activeGuild:${authUser.uid}`);
        setActiveGuildId('');
        setActiveTab('schedule');
      }
      await updateDoc(doc(db, 'users', authUser.uid), { guildIds: arrayRemove(guildId) });
      setUserGuilds((prev) => prev.filter((guild) => guild.guildId !== guildId));
    } catch (err) {
      setLeaveError('Could not leave the guild.');
    }
  };


  const handleAuthSubmit = async () => {
    setAuthError('');
    setVerifyNotice('');
    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName });
        await setDoc(doc(db, 'users', cred.user.uid), {
          displayName,
          email: cred.user.email,
          createdAt: serverTimestamp(),
        });
        await sendEmailVerification(cred.user);
        setVerifyNotice('Check your email to verify your account.');
        setEmailVerified(false);
      }
    } catch (err) {
      setAuthError(err?.message || 'Auth failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setVerifyNotice('');
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
      setVerifyNotice('Verification email resent.');
    } catch (err) {
      setVerifyNotice('Could not resend verification email.');
    }
  };

  const handleCheckVerification = async () => {
    if (!auth.currentUser) return;
    setVerifyLoading(true);
    setVerifyNotice('');
    try {
      await reload(auth.currentUser);
      if (auth.currentUser.emailVerified) {
        setEmailVerified(true);
        setVerifyNotice('Verified. Welcome!');
      } else {
        setVerifyNotice('Not verified yet. Please click the link in your email.');
      }
    } catch (err) {
      setVerifyNotice('Could not refresh verification status.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setActiveGuildId('');
    setActiveTab('schedule');
    setEmail('');
    setPassword('');
    setMenuOpen(false);
    setEmailVerified(true);
  };
  const createGuild = async (details = null) => {
    if (!authUser) return;
    setCreateError('');
    setJoinError('');
    setActionLoading(true);
    try {
      let inviteCode = generateInviteCode();
      const inviteRef = doc(db, 'inviteCodes', inviteCode);
      let inviteSnap = await getDoc(inviteRef);
      let tries = 0;
      while (inviteSnap.exists() && tries < 5) {
        inviteCode = generateInviteCode();
        inviteSnap = await getDoc(doc(db, 'inviteCodes', inviteCode));
        tries += 1;
      }
      if (inviteSnap.exists()) {
        throw new Error('Invite code collision');
      }

      const draft = details || {
        name: guildName,
        description: '',
        imageUrl: '',
      };
      const guildRef = await addDoc(collection(db, 'guilds'), {
        name: draft.name?.trim() || `Guild ${inviteCode}`,
        description: draft.description?.trim() || '',
        imageUrl: draft.imageUrl || '',
        inviteCode,
        xpTable: defaultXpTable,
        createdAt: serverTimestamp(),
        createdBy: authUser.uid,
      });

      await setDoc(doc(db, 'inviteCodes', inviteCode), {
        guildId: guildRef.id,
        createdBy: authUser.uid,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'guilds', guildRef.id, 'members', authUser.uid), {
        userId: authUser.uid,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl || '',
        xp: 0,
        role: 'admin',
        inviteCode,
        joinedAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, 'users', authUser.uid),
        {
          guildIds: arrayUnion(guildRef.id),
        },
        { merge: true }
      );

      const batch = writeBatch(db);
      buildSeedCalendar().forEach((day) => {
        const dayRef = doc(db, 'guilds', guildRef.id, 'calendar', day.dateKey);
        batch.set(dayRef, {
          dateKey: day.dateKey,
          dayName: day.dayName,
          dateStr: day.dateStr,
          slots: {
            afternoon: { voters: [] },
            evening: { voters: [] },
          },
        });
      });
      await batch.commit();

      setActiveGuildId(guildRef.id);
      localStorage.setItem(`dndhub:activeGuild:${authUser.uid}`, guildRef.id);
      setGuildName('');
      setCreateGuildOpen(false);
      setCreateGuildForm({ name: '', description: '', imageUrl: '' });
    } catch (err) {
      setCreateError('Could not create guild.');
    } finally {
      setActionLoading(false);
    }
  };

  const joinGuild = async (code) => {
    if (!authUser) return;
    setJoinError('');
    setCreateError('');
    setActionLoading(true);
    try {
      const cleanedCode = (code || '').trim().toUpperCase();
      if (!cleanedCode) {
        setJoinError('Unknown invite code.');
        return;
      }
      const inviteSnap = await getDoc(doc(db, 'inviteCodes', cleanedCode));
      if (!inviteSnap.exists()) {
        setJoinError('Unknown invite code.');
        return;
      }
      const guildId = inviteSnap.data().guildId;
      const memberRef = doc(db, 'guilds', guildId, 'members', authUser.uid);
      await setDoc(
        memberRef,
        {
          userId: authUser.uid,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl || '',
          xp: 0,
          role: 'member',
          inviteCode: cleanedCode,
          joinedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, 'users', authUser.uid),
        {
          guildIds: arrayUnion(guildId),
        },
        { merge: true }
      );

      setActiveGuildId(guildId);
      localStorage.setItem(`dndhub:activeGuild:${authUser.uid}`, guildId);
      setOverviewJoinCode('');
      if (pendingInviteCode && pendingInviteCode === cleanedCode) {
        localStorage.removeItem('dndhub:pendingInvite');
        setPendingInviteCode('');
      }
    } catch (err) {
      setJoinError('Join failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSlot = async (dayId, timeSlot) => {
    if (!authUser || !activeGuildId) return;
    const day = scheduleData.find((entry) => entry.id === dayId);
    if (!day) return;
    const hasVote = day.slots[timeSlot]?.userVote;
    const slotRef = doc(db, 'guilds', activeGuildId, 'calendar', dayId);
    const fieldPath = `slots.${timeSlot}.voters`;

    await updateDoc(slotRef, {
      [fieldPath]: hasVote ? arrayRemove(authUser.uid) : arrayUnion(authUser.uid),
    });
  };

  const kickMember = async (memberId) => {
    if (!authUser || !activeGuildId || !isAdmin) return;
    if (!memberId || memberId === authUser.uid) return;
    setMembersError('');
    try {
      await deleteDoc(doc(db, 'guilds', activeGuildId, 'members', memberId));
    } catch (err) {
      setMembersError(err?.message || 'Failed to remove member.');
    }
  };

  const grantMemberXp = async (memberId, amount) => {
    if (!authUser || !activeGuildId || !isAdmin) return;
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    if (!safeAmount) return;
    try {
      await updateDoc(doc(db, 'guilds', activeGuildId, 'members', memberId), {
        xp: increment(safeAmount),
      });
    } catch (err) {
      setMembersError(err?.message || 'Failed to grant XP.');
    }
  };

  const addRule = async () => {
    if (!newRuleTitle.trim() || !activeGuildId || !isAdmin) return;
    await addDoc(collection(db, 'guilds', activeGuildId, 'rules'), {
      title: newRuleTitle.trim(),
      desc: newRuleDesc.trim(),
      createdAt: serverTimestamp(),
    });
    setNewRuleTitle('');
    setNewRuleDesc('');
  };

  const removeRule = async (id) => {
    if (!activeGuildId || !isAdmin) return;
    await deleteDoc(doc(db, 'guilds', activeGuildId, 'rules', id));
  };

  const addSnack = async () => {
    if (!newSnackItem.trim() || !activeGuildId || !authUser) return;
    await addDoc(collection(db, 'guilds', activeGuildId, 'snacks'), {
      item: newSnackItem.trim(),
      userName: profile.displayName,
      userId: authUser.uid,
      userAvatar: profile.avatarUrl || '',
      brought: false,
      createdAt: serverTimestamp(),
    });
    setNewSnackItem('');
  };

  const removeSnack = async (id) => {
    if (!activeGuildId) return;
    await deleteDoc(doc(db, 'guilds', activeGuildId, 'snacks', id));
  };

  const toggleSnack = async (snack) => {
    if (!activeGuildId) return;
    await updateDoc(doc(db, 'guilds', activeGuildId, 'snacks', snack.id), {
      brought: !snack.brought,
    });
  };

  const sendChatMessage = async () => {
    if (!authUser || !chatGuildId) return;
    const text = chatInput.trim();
    if (!text) return;
    try {
      const normalizedGif = await normalizeGifUrl(text);
      if (normalizedGif) {
        await addDoc(collection(db, 'guilds', chatGuildId, 'chat'), {
          type: 'gif',
          gifUrl: normalizedGif,
          createdAt: serverTimestamp(),
          createdBy: authUser.uid,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl || '',
        });
        setChatInput('');
        setChatAutoScrollKey((prev) => prev + 1);
        return;
      }
      await addDoc(collection(db, 'guilds', chatGuildId, 'chat'), {
        type: 'text',
        text,
        createdAt: serverTimestamp(),
        createdBy: authUser.uid,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl || '',
      });
      setChatInput('');
      setChatAutoScrollKey((prev) => prev + 1);
    } catch (err) {
      setChatError(err?.message || 'Failed to send message.');
    }
  };

  const sendGifMessage = async (gif) => {
    if (!authUser || !chatGuildId) return;
    const giphyUrl = gif?.images?.fixed_width?.url || gif?.images?.original?.url;
    const tenorUrl = gif?.media_formats?.gif?.url || gif?.media_formats?.tinygif?.url;
    const gifUrl = giphyUrl || tenorUrl;
    if (!gifUrl) return;
    try {
      await addDoc(collection(db, 'guilds', chatGuildId, 'chat'), {
        type: 'gif',
        gifUrl,
        createdAt: serverTimestamp(),
        createdBy: authUser.uid,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl || '',
      });
      setGifOpen(false);
      setGifQuery('');
    } catch (err) {
      setChatError(err?.message || 'Failed to send GIF.');
    }
  };

  const loadMoreChat = async () => {
    if (!authUser || !chatGuildId || !chatLastDoc || !chatHasMore) return;
    try {
      const olderQuery = query(
        collection(db, 'guilds', chatGuildId, 'chat'),
        orderBy('createdAt', 'desc'),
        startAfter(chatLastDoc),
        limit(50)
      );
      const snap = await getDocs(olderQuery);
      const docs = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setChatMessages((prev) => [...docs.reverse(), ...prev]);
      setChatLastDoc(snap.docs[snap.docs.length - 1] || chatLastDoc);
      setChatHasMore(snap.docs.length === 50);
    } catch (err) {
      setChatError(err?.message || 'Failed to load more messages.');
    }
  };

  if (!authReady) {
    return <div className="min-h-screen flex items-center justify-center text-stone-500">Loading...</div>;
  }

  if (authUser && !emailVerified) {
    return (
      <div className="relative min-h-screen">
        <div className="fixed inset-0 bg-noise opacity-30 pointer-events-none z-0 mix-blend-overlay"></div>
        <div className="fixed inset-0 bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 opacity-90 z-[-1]"></div>
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div
            className="absolute top-[10%] left-[20%] w-2 h-2 bg-amber-600 rounded-full opacity-20 blur-sm animate-float"
            style={{ animationDuration: '8s' }}
          ></div>
          <div
            className="absolute top-[40%] right-[15%] w-1 h-1 bg-emerald-900 rounded-full opacity-30 blur-sm animate-float"
            style={{ animationDuration: '12s' }}
          ></div>
          <div
            className="absolute bottom-[20%] left-[30%] w-3 h-3 bg-red-900 rounded-full opacity-10 blur-xl animate-float"
            style={{ animationDuration: '15s' }}
          ></div>
        </div>
        <VerifyScreen
          email={authUser.email}
          onResend={handleResendVerification}
          onRefresh={handleCheckVerification}
          onSignOut={handleSignOut}
          notice={verifyNotice}
          loading={verifyLoading}
        />
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="relative min-h-screen">
        <div className="fixed inset-0 bg-noise opacity-30 pointer-events-none z-0 mix-blend-overlay"></div>
        <div className="fixed inset-0 bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 opacity-90 z-[-1]"></div>
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div
            className="absolute top-[10%] left-[20%] w-2 h-2 bg-amber-600 rounded-full opacity-20 blur-sm animate-float"
            style={{ animationDuration: '8s' }}
          ></div>
          <div
            className="absolute top-[40%] right-[15%] w-1 h-1 bg-emerald-900 rounded-full opacity-30 blur-sm animate-float"
            style={{ animationDuration: '12s' }}
          ></div>
          <div
            className="absolute bottom-[20%] left-[30%] w-3 h-3 bg-red-900 rounded-full opacity-10 blur-xl animate-float"
            style={{ animationDuration: '15s' }}
          ></div>
        </div>
        <AuthScreen
          mode={authMode}
          setMode={setAuthMode}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          displayName={displayName}
          setDisplayName={setDisplayName}
          onSubmit={handleAuthSubmit}
          error={authError}
          loading={authLoading}
          pendingInviteCode={pendingInviteCode}
          verifyNotice={verifyNotice}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 animate-fade relative z-10">
      <div className="fixed inset-0 bg-noise opacity-30 pointer-events-none z-0 mix-blend-overlay"></div>
      <div className="fixed inset-0 bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 opacity-90 z-[-1]"></div>
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div
          className="absolute top-[10%] left-[20%] w-2 h-2 bg-amber-600 rounded-full opacity-20 blur-sm animate-float"
          style={{ animationDuration: '8s' }}
        ></div>
        <div
          className="absolute top-[40%] right-[15%] w-1 h-1 bg-emerald-900 rounded-full opacity-30 blur-sm animate-float"
          style={{ animationDuration: '12s' }}
        ></div>
        <div
          className="absolute bottom-[20%] left-[30%] w-3 h-3 bg-red-900 rounded-full opacity-10 blur-xl animate-float"
          style={{ animationDuration: '15s' }}
        ></div>
      </div>

      {menuOpen && (
        <button
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 bg-black/60 z-[60]"
          aria-label="Close menu"
        />
      )}
      <div
        className={`fixed top-0 right-0 h-full w-72 bg-stone-950/95 border-l border-stone-800 z-[70] transform transition-transform ${
          menuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-stone-800 bg-stone-950 overflow-hidden flex items-center justify-center">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
              ) : (
                <User size={16} className="text-stone-600" />
              )}
            </div>
            <div>
              <div className="text-sm text-stone-200 font-fantasy">{profile.displayName}</div>
              <div className="text-[10px] text-stone-600 uppercase tracking-[0.2em]">
                {isAdmin ? 'Admin' : 'Member'}
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-3">
          <button
            onClick={() => {
              setActiveTab('home');
              setMenuOpen(false);
            }}
            className="w-full text-left text-xs uppercase tracking-[0.2em] bg-stone-900/60 px-4 py-3 rounded-sm border border-stone-800 text-stone-400 hover:text-amber-500 transition-colors"
          >
            Home
          </button>
          <button
            onClick={() => {
              if (activeGuildId) {
                setActiveTab('guild');
                setMenuOpen(false);
              }
            }}
            className={`w-full text-left text-xs uppercase tracking-[0.2em] px-4 py-3 rounded-sm border ${
              activeGuildId
                ? 'bg-stone-900/60 border-stone-800 text-stone-400 hover:text-amber-500'
                : 'bg-stone-900/30 border-stone-900 text-stone-600 cursor-not-allowed'
            } transition-colors`}
          >
            Guild dashboard
          </button>
          <button
            onClick={() => {
              setActiveTab('overview');
              setMenuOpen(false);
            }}
            className="w-full text-left text-xs uppercase tracking-[0.2em] bg-stone-900/60 px-4 py-3 rounded-sm border border-stone-800 text-stone-400 hover:text-amber-500 transition-colors"
          >
            Guild overview
          </button>
          <button
            onClick={() => {
              setActiveTab('account');
              setMenuOpen(false);
            }}
            className="w-full text-left text-xs uppercase tracking-[0.2em] bg-stone-900/60 px-4 py-3 rounded-sm border border-stone-800 text-stone-400 hover:text-amber-500 transition-colors"
          >
            Account settings
          </button>
          <button
            onClick={handleSignOut}
            className="w-full text-left text-xs uppercase tracking-[0.2em] bg-red-900/20 px-4 py-3 rounded-sm border border-red-900/50 text-red-400 hover:text-red-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {activeTab === 'home' && (
      <div className="bg-[#1c1917]/90 backdrop-blur-md border-b border-stone-800 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-stone-500 font-bold">
            <span className="w-8 h-8 rounded-full border border-stone-800 bg-stone-950 overflow-hidden flex items-center justify-center">
              <img src={logo} alt="Guildhall" className="w-full h-full object-cover rounded-full" />
            </span>
            The GuildHall
          </div>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] bg-stone-900/60 px-3 py-1.5 rounded-full border border-stone-800 text-stone-400 hover:text-amber-500 transition-colors"
          >
            <Menu size={12} />
            Menu
          </button>
        </div>
      </div>
      )}

      {activeTab !== 'home' && (
      <div className="bg-[#1c1917]/90 backdrop-blur-md border-b border-stone-800 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-950 rounded-lg border border-stone-800 shadow-inner flex items-center justify-center text-amber-500 relative overflow-hidden group">
              <div className="absolute inset-0 bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity animate-pulse"></div>
              {guildData?.imageUrl ? (
                <img src={guildData.imageUrl} alt="Guild" className="w-full h-full object-cover" />
              ) : (
                <img src={logo} alt="Guildhall" className="w-full h-full object-cover rounded-full" />
              )}
            </div>
            <div>
              <h1 className="text-lg font-fantasy text-stone-200 tracking-wide drop-shadow-md">
                {guildData?.name || 'The Guild'}
              </h1>
              <div className="text-[9px] text-amber-600 tracking-[0.2em] uppercase flex items-center gap-2 font-bold">
                <span className="w-4 h-4 rounded-full border border-stone-800 bg-stone-950 overflow-hidden flex items-center justify-center">
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <User size={10} className="text-stone-600" />
                  )}
                </span>
                {isAdmin ? <Crown size={10} className="text-amber-500" /> : <Users size={10} />}
                {profile.displayName}
              </div>
              {guildData?.inviteCode && (
                <p className="text-[9px] text-stone-600 tracking-[0.2em] uppercase font-mono">
                  Code {guildData.inviteCode}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:self-auto self-start w-full sm:w-auto justify-end">
            <button
              onClick={() => setActiveTab('home')}
              className="flex items-center gap-2 px-3 py-1.5 border border-stone-800 bg-stone-950/70 text-[10px] uppercase tracking-[0.2em] text-stone-400 hover:text-amber-500 rounded-full transition-colors"
            >
              <Home size={12} />
              Home
            </button>
            <div className="hidden md:flex items-center gap-2 text-[10px] bg-black/40 px-3 py-1.5 rounded-full border border-stone-800 text-stone-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)] animate-pulse"></span>
              Live Uplink
            </div>
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] bg-stone-900/60 px-3 py-1.5 rounded-full border border-stone-800 text-stone-400 hover:text-amber-500 transition-colors"
            >
              <Menu size={12} />
              Menu
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 flex justify-start gap-1 overflow-x-auto relative no-scrollbar mt-1">
          {[
            { id: 'guild', icon: Crown, label: 'GUILD' },
            { id: 'schedule', icon: Calendar, label: 'CALENDAR' },
            { id: 'members', icon: Users, label: 'MEMBERS' },
            { id: 'rules', icon: Scroll, label: 'LAWS' },
            { id: 'snacks', icon: Pizza, label: 'LOOT' },
            { id: 'guild-settings', icon: Settings, label: 'SETTINGS' }
          ].map((tab) => {
            const needsGuild = ['guild', 'schedule', 'members', 'guild-settings', 'rules', 'snacks'].includes(tab.id);
            const disabled = needsGuild && !activeGuildId;
            return (
            <button
              key={tab.id}
              onClick={() => {
                if (!disabled) setActiveTab(tab.id);
              }}
              className={`flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-3 border-t-2 transition-all whitespace-nowrap text-[11px] sm:text-xs font-bold tracking-[0.15em] ${
                activeTab === tab.id
                  ? 'border-amber-600 bg-gradient-to-b from-stone-800/50 to-transparent text-amber-500 shadow-[0_-5px_15px_rgba(0,0,0,0.2)]'
                  : 'border-transparent text-stone-600 hover:text-stone-300 hover:bg-stone-800/30'
              }`}
            >
              <tab.icon size={14} className={activeTab === tab.id ? 'text-amber-500 drop-shadow-sm' : 'text-stone-700'} />
              {tab.label}
            </button>
            );
          })}
        </div>
        <div className="h-px w-full bg-stone-800 absolute bottom-0 z-0"></div>
      </div>
      )}

      <CreateGuildModal
        open={createGuildOpen}
        onClose={() => setCreateGuildOpen(false)}
        onCreate={createGuild}
        form={createGuildForm}
        setForm={setCreateGuildForm}
        loading={actionLoading}
      />

      <div className="mx-auto px-4 py-8 relative z-10 max-w-6xl">
      {activeTab === 'home' && (
        <div className="mx-auto px-2 py-10">
          <HomeView
            onNavigate={setActiveTab}
            guilds={userGuilds}
            guildsLoading={guildsLoading}
            guildsError={guildsError}
            onSelectGuild={(guildId) => {
              setActiveGuildId(guildId);
              localStorage.setItem(`dndhub:activeGuild:${authUser.uid}`, guildId);
              setActiveTab('guild');
            }}
            onLeaveGuild={leaveGuild}
            onOpenCreateGuild={() => setCreateGuildOpen(true)}
            onJoinGuild={joinGuild}
            joinCode={overviewJoinCode}
            setJoinCode={setOverviewJoinCode}
            joinError={joinError}
            loading={actionLoading}
            leaveError={leaveError}
            pendingInviteCode={pendingInviteCode}
          />
        </div>
      )}
        {activeTab === 'guild' && (
          activeGuildId ? (
            <GuildDashboard
              onNavigate={setActiveTab}
              guildName={guildData?.name}
              guildImageUrl={guildData?.imageUrl}
              inviteCode={guildData?.inviteCode}
            />
          ) : (
            <div className="rpg-panel p-4 sm:p-6 rounded-md text-stone-500">
              Select a guild to open its dashboard.
            </div>
          )
        )}
        {activeTab === 'schedule' && (
          activeGuildId ? (
            <ScheduleView
              scheduleData={scheduleData}
              toggleSlot={toggleSlot}
              memberCount={guildMembers.length}
            />
          ) : (
            <div className="rpg-panel p-4 sm:p-6 rounded-md text-stone-500">
              Join or create a guild to access the quest board.
            </div>
          )
        )}
        {activeTab === 'overview' && (
          <GuildOverviewView
            guilds={userGuilds}
            guildsLoading={guildsLoading}
            guildsError={guildsError}
            onSelectGuild={(guildId) => {
              setActiveGuildId(guildId);
              localStorage.setItem(`dndhub:activeGuild:${authUser.uid}`, guildId);
              setActiveTab('home');
            }}
            onLeaveGuild={leaveGuild}
            activeGuildId={activeGuildId}
            joinCode={overviewJoinCode}
            setJoinCode={setOverviewJoinCode}
            onJoinGuild={joinGuild}
            joinError={joinError}
            loading={actionLoading}
            leaveError={leaveError}
          />
        )}
        {activeTab === 'members' && (
          activeGuildId ? (
            <MembersView
              members={guildMembers}
              membersLoading={membersLoading}
              membersError={membersError}
              onKickMember={kickMember}
              onGrantXp={grantMemberXp}
              isAdmin={isAdmin}
              currentUserId={authUser?.uid || ''}
              xpTable={guildData?.xpTable?.length ? guildData.xpTable : defaultXpTable}
              guildCreatedBy={guildData?.createdBy}
            />
          ) : (
            <div className="rpg-panel p-4 sm:p-6 rounded-md text-stone-500">
              Join or create a guild to access the roster.
            </div>
          )
        )}
        {activeTab === 'rules' && (
          activeGuildId ? (
            <RulesView
              rules={rules}
              removeRule={removeRule}
              newRuleTitle={newRuleTitle}
              setNewRuleTitle={setNewRuleTitle}
              newRuleDesc={newRuleDesc}
              setNewRuleDesc={setNewRuleDesc}
              addRule={addRule}
              isAdmin={isAdmin}
            />
          ) : (
            <div className="rpg-panel p-4 sm:p-6 rounded-md text-stone-500">
              Join or create a guild to access laws.
            </div>
          )
        )}
        {activeTab === 'snacks' && (
          activeGuildId ? (
            <SnackView
              snacks={snacks}
              toggleSnack={toggleSnack}
              removeSnack={removeSnack}
              newSnackItem={newSnackItem}
              setNewSnackItem={setNewSnackItem}
              addSnack={addSnack}
              currentUser={profile.displayName}
              currentUserId={authUser.uid}
              currentUserAvatar={profile.avatarUrl}
            />
          ) : (
            <div className="rpg-panel p-4 sm:p-6 rounded-md text-stone-500">
              Join or create a guild to access loot.
            </div>
          )
        )}
        {activeTab === 'account' && (
          <AccountSettingsView
            profileForm={profileForm}
            setProfileForm={setProfileForm}
            profileAvatarPreview={profileAvatarPreview}
            onSaveProfile={handleSaveProfile}
            profileSaving={profileSaving}
            onSelectProfileAvatar={handleSelectProfileAvatar}
          />
        )}
        {activeTab === 'guild-settings' && (
          activeGuildId ? (
            <GuildSettingsView
              guildForm={guildForm}
              setGuildForm={setGuildForm}
              guildImagePreview={guildImagePreview}
              onSaveGuild={handleSaveGuild}
              guildSaving={guildSaving}
              isAdmin={isAdmin}
              onLeaveGuild={() => leaveGuild(activeGuildId)}
              leaveError={leaveError}
              onSelectGuildImage={handleSelectGuildImage}
              xpLevelInput={xpLevelInput}
              xpValueInput={xpValueInput}
              setXpLevelInput={setXpLevelInput}
              setXpValueInput={setXpValueInput}
              onAddXpRow={handleAddXpRow}
              onRemoveXpRow={handleRemoveXpRow}
              onLoadDefaultXp={handleLoadDefaultXp}
            />
          ) : (
            <div className="rpg-panel p-4 sm:p-6 rounded-md text-stone-500">
              Join or create a guild to access settings.
            </div>
          )
        )}
      </div>

      {chatOpen && (
        <ChatView
          messages={chatMessages}
          loading={chatLoading}
          error={chatError}
          hasMore={chatHasMore}
          onLoadMore={loadMoreChat}
          chatInput={chatInput}
          setChatInput={setChatInput}
          onSend={sendChatMessage}
          gifOpen={gifOpen}
          setGifOpen={setGifOpen}
          gifQuery={gifQuery}
          setGifQuery={setGifQuery}
          gifResults={gifResults}
          gifLoading={gifLoading}
          gifError={gifError}
          onSendGif={sendGifMessage}
          guilds={userGuilds}
          chatGuildId={chatGuildId}
          setChatGuildId={setChatGuildId}
          onClose={() => setChatOpen(false)}
          autoScrollKey={chatAutoScrollKey}
        />
      )}

      {!chatOpen && authUser && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-[70] w-14 h-14 rounded-full bg-amber-900/30 border border-amber-900/60 text-amber-400 shadow-[0_10px_30px_rgba(0,0,0,0.6)] flex items-center justify-center hover:text-amber-200 hover:border-amber-500 transition-colors"
          aria-label="Open chat"
        >
          <MessageCircle size={20} />
        </button>
      )}
    </div>
  );
};

const GuildList = ({
  guilds,
  guildsLoading,
  guildsError,
  onSelectGuild,
  onLeaveGuild,
  activeGuildId = '',
  leaveError,
}) => (
  <div className="rpg-panel p-4 rounded-md border border-stone-800/60 bg-stone-950/40">
    <h3 className="text-xs uppercase tracking-[0.3em] text-stone-500 font-bold mb-3">Your guilds</h3>
    {guildsLoading && <div className="text-stone-600 text-sm">Loading...</div>}
    {!guildsLoading && guildsError && (
      <div className="text-red-400 text-xs border border-red-900/40 bg-red-950/40 py-2 px-3 rounded">
        {guildsError}
      </div>
    )}
    {!guildsLoading && !guildsError && leaveError && (
      <div className="text-red-400 text-xs border border-red-900/40 bg-red-950/40 py-2 px-3 rounded">
        {leaveError}
      </div>
    )}
    {!guildsLoading && guilds.length === 0 && (
      <div className="text-stone-600 text-sm">No guilds yet.</div>
    )}
    <div className="grid gap-3">
      {guilds.map((guild) => (
        <div
          key={guild.guildId}
          className={`flex items-center justify-between gap-3 border p-3 rounded-sm ${
            activeGuildId === guild.guildId
              ? 'bg-stone-900/70 border-amber-700/40'
              : 'bg-stone-950/70 border-stone-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md border border-stone-800 bg-stone-900 flex items-center justify-center overflow-hidden">
              {guild.imageUrl ? (
                <img src={guild.imageUrl} alt="Guild" className="w-full h-full object-cover" />
              ) : (
                <Crown size={16} className="text-stone-600" />
              )}
            </div>
            <div>
              <div className="text-sm text-stone-200 font-fantasy">{guild.name}</div>
              <div className="text-[9px] text-stone-600 uppercase tracking-[0.2em] font-mono">
                {guild.role} {guild.inviteCode ? `- ${guild.inviteCode}` : ''}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectGuild(guild.guildId)}
              className="text-xs uppercase tracking-[0.2em] bg-stone-900/60 px-3 py-2 rounded-sm border border-stone-800 text-stone-400 hover:text-amber-500 transition-colors"
            >
              Open
            </button>
            <button
              onClick={() => onLeaveGuild(guild.guildId)}
              className="text-xs uppercase tracking-[0.2em] bg-red-900/20 px-3 py-2 rounded-sm border border-red-900/50 text-red-400 hover:text-red-300 transition-colors"
            >
              Leave
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const GuildOverviewView = ({
  guilds,
  guildsLoading,
  guildsError,
  onSelectGuild,
  onLeaveGuild,
  activeGuildId,
  joinCode,
  setJoinCode,
  onJoinGuild,
  joinError,
  loading,
  leaveError,
}) => (
  <div className="space-y-6 animate-fade-slide">
    <GuildList
      guilds={guilds}
      guildsLoading={guildsLoading}
      guildsError={guildsError}
      onSelectGuild={onSelectGuild}
      onLeaveGuild={onLeaveGuild}
      activeGuildId={activeGuildId}
      leaveError={leaveError}
    />
    <div className="rpg-panel p-5 rounded-md border border-stone-800/60 bg-stone-950/40">
      <h3 className="text-xs uppercase tracking-[0.3em] text-stone-500 font-bold mb-3">
        Join a guild
      </h3>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="INVITE CODE"
          className="flex-1 bg-stone-900 border border-stone-700 text-stone-200 px-4 py-3 rounded-sm text-sm focus:outline-none focus:border-emerald-600 transition-colors font-mono tracking-widest shadow-inner"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
        />
        <button
          onClick={() => joinCode && onJoinGuild(joinCode)}
          disabled={!joinCode || loading}
          className="min-w-[120px] fantasy-btn bg-emerald-900/20 hover:bg-emerald-800/40 text-emerald-500 border border-emerald-900/50 px-6 py-3 rounded-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm uppercase tracking-widest font-bold hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
        >
          Join
        </button>
      </div>
      {joinError && (
        <div className="text-xs text-red-400 mt-3 border border-red-900/40 bg-red-950/40 py-2 rounded text-center">
          {joinError}
        </div>
      )}
    </div>
  </div>
);

const HomeView = ({
  onNavigate,
  guilds,
  guildsLoading,
  guildsError,
  onSelectGuild,
  onLeaveGuild,
  onOpenCreateGuild,
  onJoinGuild,
  joinCode,
  setJoinCode,
  joinError,
  loading,
  leaveError,
  pendingInviteCode,
}) => (
  <div className="space-y-6 animate-fade-slide">
    <div className="rpg-panel p-4 sm:p-6 rounded-md">
      <div className="flex items-center gap-4 border-b border-stone-800 pb-4 mb-6">
        <div className="w-14 h-14 rounded-md border border-stone-800 bg-stone-950 overflow-hidden flex items-center justify-center">
          <img src={logo} alt="Guildhall" className="w-full h-full object-cover rounded-full" />
        </div>
        <div>
          <h2 className="text-2xl text-amber-500 font-fantasy">GuildHall</h2>
          <p className="text-stone-500 text-sm font-body">The First DnD Session Hub</p>
        </div>
      </div>

      {pendingInviteCode && (
        <div className="mb-6 bg-emerald-950/30 border border-emerald-900/50 rounded-md p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-emerald-400 font-bold">
              Invite link detected
            </div>
            <div className="text-sm text-stone-300 font-mono mt-1">{pendingInviteCode}</div>
          </div>
          <button
            onClick={() => onJoinGuild(pendingInviteCode)}
            disabled={loading}
            className="fantasy-btn bg-emerald-900/20 hover:bg-emerald-800/40 text-emerald-500 border border-emerald-900/50 px-6 py-3 rounded-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm uppercase tracking-widest font-bold"
          >
            Join now
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-stone-950/70 border border-stone-800 rounded-md p-4">
          <h3 className="text-xs uppercase tracking-[0.3em] text-stone-500 font-bold mb-3">
            Quick actions
          </h3>
            <div className="grid gap-2">
              <button
                onClick={onOpenCreateGuild}
                disabled={loading}
                className="text-left text-xs uppercase tracking-[0.2em] bg-amber-900/20 px-4 py-3 rounded-sm border border-amber-900/50 text-amber-500 hover:text-amber-300 transition-colors disabled:opacity-30"
              >
                Create a guild
            </button>
            <button
              onClick={() => joinCode && onJoinGuild(joinCode)}
              disabled={!joinCode || loading}
              className="text-left text-xs uppercase tracking-[0.2em] bg-emerald-900/20 px-4 py-3 rounded-sm border border-emerald-900/50 text-emerald-500 hover:text-emerald-300 transition-colors disabled:opacity-30"
            >
              Join with code
            </button>
          </div>
        </div>
        <div className="bg-stone-950/70 border border-stone-800 rounded-md p-4">
          <h3 className="text-xs uppercase tracking-[0.3em] text-stone-500 font-bold mb-3">
            Join a guild
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center">
            <input
              type="text"
              placeholder="INVITE CODE"
              className="w-full min-w-0 bg-stone-900 border border-stone-700 text-stone-200 px-4 py-3 rounded-sm text-sm focus:outline-none focus:border-emerald-600 transition-colors font-mono tracking-widest shadow-inner"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <button
              onClick={() => joinCode && onJoinGuild(joinCode)}
              disabled={!joinCode || loading}
              className="w-full sm:w-auto min-w-[120px] fantasy-btn bg-emerald-900/20 hover:bg-emerald-800/40 text-emerald-500 border border-emerald-900/50 px-6 py-3 rounded-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm uppercase tracking-widest font-bold whitespace-nowrap"
            >
              Join
            </button>
          </div>
          {joinError && (
            <div className="text-xs text-red-400 mt-3 border border-red-900/40 bg-red-950/40 py-2 rounded text-center">
              {joinError}
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {[
          { id: 'overview', label: 'Guild overview', icon: Users, desc: 'See and manage your guilds.' },
        ].map((card) => (
          <button
            key={card.id}
            onClick={() => onNavigate(card.id)}
            className="group text-left bg-stone-950/70 border border-stone-800 rounded-md p-4 hover:border-amber-700/50 hover:bg-stone-950 transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-md border border-stone-800 bg-stone-900 flex items-center justify-center text-amber-500">
                <card.icon size={16} />
              </div>
              <div className="text-sm uppercase tracking-[0.2em] text-stone-300 font-bold">
                {card.label}
              </div>
            </div>
            <div className="text-xs text-stone-600">{card.desc}</div>
          </button>
        ))}
      </div>
      <div className="mt-6">
        <GuildList
          guilds={guilds}
          guildsLoading={guildsLoading}
          guildsError={guildsError}
          onSelectGuild={onSelectGuild}
          onLeaveGuild={onLeaveGuild}
          leaveError={leaveError}
        />
      </div>
    </div>
  </div>
);

const GuildDashboard = ({ onNavigate, guildName, guildImageUrl, inviteCode }) => {
  const [inviteCopied, setInviteCopied] = useState(false);
  const inviteLink =
    inviteCode && typeof window !== 'undefined'
      ? `${window.location.origin}?invite=${inviteCode}`
      : '';

  const copyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch (err) {
      setInviteCopied(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-slide">
      <div className="rpg-panel p-4 sm:p-6 rounded-md">
        <div className="flex flex-col md:flex-row md:items-center gap-4 border-b border-stone-800 pb-4 mb-6">
          <div className="w-14 h-14 rounded-md border border-stone-800 bg-stone-950 overflow-hidden flex items-center justify-center">
            {guildImageUrl ? (
              <img src={guildImageUrl} alt={guildName} className="w-full h-full object-cover" />
            ) : (
              <img src={logo} alt="Guildhall" className="w-full h-full object-cover rounded-full" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl text-amber-500 font-fantasy">{guildName || 'Guild'}</h2>
            <p className="text-stone-500 text-sm font-body">
              {inviteCode ? `Invite code: ${inviteCode}` : 'Choose your next action.'}
            </p>
          </div>
          {inviteLink && (
            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <div className="flex items-stretch rounded-sm border border-stone-800 bg-stone-950/60 overflow-hidden">
                <div className="w-10 h-10 border-r border-stone-800 bg-stone-950 flex items-center justify-center">
                  <img src={logo} alt="Guildhall" className="w-full h-full object-cover rounded-full" />
                </div>
                <div className="px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                    Invite link
                  </div>
                  <div className="text-stone-300 font-mono text-[11px] lowercase mt-1 max-w-[260px] truncate">
                    {inviteLink}
                  </div>
                </div>
              </div>
              <button
                onClick={copyInvite}
                className="fantasy-btn bg-amber-900/20 hover:bg-amber-800/40 text-amber-500 border border-amber-900/50 px-4 py-2 rounded-sm transition-all text-xs uppercase tracking-widest"
              >
                {inviteCopied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          )}
        </div>

      <div className="grid md:grid-cols-2 gap-4">
        {[
          { id: 'schedule', label: 'Calendar', icon: Map, desc: 'Vote for session times.' },
          { id: 'members', label: 'Members', icon: Users, desc: 'Roster and roles.' },
          { id: 'guild-settings', label: 'Guild settings', icon: Settings, desc: 'Banner, name, and description.' },
          { id: 'rules', label: 'Laws', icon: Scroll, desc: 'House rules and edicts.' },
          { id: 'snacks', label: 'Loot', icon: Pizza, desc: 'Who brings what.' },
        ].map((card) => (
          <button
            key={card.id}
            onClick={() => onNavigate(card.id)}
            className="group text-left bg-stone-950/70 border border-stone-800 rounded-md p-4 hover:border-amber-700/50 hover:bg-stone-950 transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-md border border-stone-800 bg-stone-900 flex items-center justify-center text-amber-500">
                <card.icon size={16} />
              </div>
              <div className="text-sm uppercase tracking-[0.2em] text-stone-300 font-bold">
                {card.label}
              </div>
            </div>
            <div className="text-xs text-stone-600">{card.desc}</div>
          </button>
        ))}
      </div>
      </div>
    </div>
  );
};

const CreateGuildModal = ({ open, onClose, onCreate, form, setForm, loading }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <button
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
        aria-label="Close create guild"
      />
      <div className="relative z-[90] w-full max-w-lg rpg-panel p-4 sm:p-6 rounded-md">
        <div className="mb-4 border-b border-stone-800 pb-4">
          <h3 className="text-xl text-amber-500 font-fantasy">Create a guild</h3>
          <p className="text-stone-500 text-sm">Set the name, description, and a crest.</p>
        </div>
        <div className="grid gap-4">
          <input
            type="text"
            placeholder="Guild name"
            className="w-full rpg-input text-stone-200 px-3 py-2 rounded-sm text-lg font-fantasy focus:outline-none placeholder:text-stone-700"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <textarea
            rows={3}
            placeholder="Guild description..."
            className="w-full rpg-input text-stone-200 px-3 py-2 rounded-sm text-sm font-body focus:outline-none placeholder:text-stone-700"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-stone-500 font-bold mb-2">
              Choose a crest
            </div>
            <div className="grid grid-cols-6 gap-2">
              {guildPresets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setForm({ ...form, imageUrl: preset })}
                  className={`w-12 h-8 rounded-sm border overflow-hidden ${
                    form.imageUrl === preset
                      ? 'border-amber-500/60 ring-1 ring-amber-500/40'
                      : 'border-stone-800'
                  }`}
                >
                  <img src={preset} alt="Preset" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="text-xs uppercase tracking-[0.2em] bg-stone-900/60 px-4 py-2 rounded-sm border border-stone-800 text-stone-400 hover:text-amber-500 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onCreate(form)}
              disabled={loading || !form.name.trim()}
              className="fantasy-btn bg-amber-900/20 hover:bg-amber-800/40 text-amber-500 border border-amber-900/50 px-4 py-2 rounded-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed text-xs uppercase tracking-widest"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AccountSettingsView = ({
  profileForm,
  setProfileForm,
  profileAvatarPreview,
  onSaveProfile,
  profileSaving,
  onSelectProfileAvatar,
}) => (
  <div className="space-y-6 animate-fade-slide">
    <div className="rpg-panel p-4 sm:p-6 rounded-md">
      <div className="mb-6 border-b border-stone-800 pb-4">
        <h2 className="text-2xl text-amber-500 flex items-center gap-3">
          <span className="p-1.5 bg-stone-900 rounded border border-stone-800">
            <User className="w-5 h-5 text-amber-700" />
          </span>
          Account
        </h2>
        <p className="text-stone-500 text-sm mt-1 font-body">Your face and your story.</p>
      </div>

      <div className="grid gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full border border-stone-800 bg-stone-950 flex items-center justify-center overflow-hidden">
            {profileAvatarPreview ? (
              <img src={profileAvatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User size={28} className="text-stone-600" />
            )}
          </div>
          <div className="flex-1">
            <label className="text-xs uppercase tracking-[0.2em] text-stone-500 font-bold">
              Profile image
            </label>
            <div className="mt-3 grid grid-cols-6 gap-2">
              {avatarPresets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => onSelectProfileAvatar(preset)}
                  className={`w-10 h-10 rounded-full border overflow-hidden ${
                    profileForm.avatarUrl === preset
                      ? 'border-amber-500/60 ring-1 ring-amber-500/40'
                      : 'border-stone-800'
                  }`}
                >
                  <img src={preset} alt="Preset" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
        <input
          type="text"
          placeholder="Display name"
          className="w-full rpg-input text-stone-200 px-3 py-2 rounded-sm text-lg font-fantasy focus:outline-none placeholder:text-stone-700"
          value={profileForm.displayName}
          onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
        />
        <textarea
          rows={3}
          placeholder="Short bio..."
          className="w-full rpg-input text-stone-200 px-3 py-2 rounded-sm text-sm font-body focus:outline-none placeholder:text-stone-700"
          value={profileForm.bio}
          onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
        />
        <button
          onClick={onSaveProfile}
          disabled={profileSaving || !profileForm.displayName}
          className="fantasy-btn bg-amber-900/20 hover:bg-amber-800/40 text-amber-500 border border-amber-900/50 px-6 py-2 rounded-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm uppercase tracking-widest hover:shadow-[0_0_15px_rgba(180,83,9,0.2)]"
        >
          Save account
        </button>
      </div>
    </div>
  </div>
);

const GuildSettingsView = ({
  guildForm,
  setGuildForm,
  guildImagePreview,
  onSaveGuild,
  guildSaving,
  isAdmin,
  onLeaveGuild,
  leaveError,
  onSelectGuildImage,
  xpLevelInput,
  xpValueInput,
  setXpLevelInput,
  setXpValueInput,
  onAddXpRow,
  onRemoveXpRow,
  onLoadDefaultXp,
}) => (
  <div className="space-y-6 animate-fade-slide">
    <div className="rpg-panel p-4 sm:p-6 rounded-md">
      <div className="mb-6 border-b border-stone-800 pb-4">
        <h2 className="text-2xl text-amber-500 flex items-center gap-3">
          <span className="p-1.5 bg-stone-900 rounded border border-stone-800">
            <Settings className="w-5 h-5 text-amber-700" />
          </span>
          Guild settings
        </h2>
        <p className="text-stone-500 text-sm mt-1 font-body">
          {isAdmin ? 'Manage banner, name, and description.' : 'Only the admin can shape the guild.'}
        </p>
      </div>

      <div className={`grid gap-4 ${isAdmin ? '' : 'opacity-50 pointer-events-none'}`}>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-md border border-stone-800 bg-stone-950 flex items-center justify-center overflow-hidden">
            {guildImagePreview ? (
              <img src={guildImagePreview} alt="Guild" className="w-full h-full object-cover" />
            ) : (
              <Crown size={28} className="text-stone-600" />
            )}
          </div>
          <div className="flex-1">
            <label className="text-xs uppercase tracking-[0.2em] text-stone-500 font-bold">
              Guild image
            </label>
            <div className="mt-3 grid grid-cols-6 gap-2">
              {guildPresets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => onSelectGuildImage(preset)}
                  className={`w-12 h-8 rounded-sm border overflow-hidden ${
                    guildForm.imageUrl === preset
                      ? 'border-amber-500/60 ring-1 ring-amber-500/40'
                      : 'border-stone-800'
                  }`}
                >
                  <img src={preset} alt="Preset" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
        <input
          type="text"
          placeholder="Guild name"
          className="w-full rpg-input text-stone-200 px-3 py-2 rounded-sm text-lg font-fantasy focus:outline-none placeholder:text-stone-700"
          value={guildForm.name}
          onChange={(e) => setGuildForm({ ...guildForm, name: e.target.value })}
        />
        <textarea
          rows={3}
          placeholder="Guild description..."
          className="w-full rpg-input text-stone-200 px-3 py-2 rounded-sm text-sm font-body focus:outline-none placeholder:text-stone-700"
          value={guildForm.description}
          onChange={(e) => setGuildForm({ ...guildForm, description: e.target.value })}
        />
        <button
          onClick={onSaveGuild}
          disabled={guildSaving || !isAdmin}
          className="fantasy-btn bg-amber-900/20 hover:bg-amber-800/40 text-amber-500 border border-amber-900/50 px-6 py-2 rounded-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm uppercase tracking-widest hover:shadow-[0_0_15px_rgba(180,83,9,0.2)]"
        >
          Save guild
        </button>
      </div>
    </div>

    <div className="rpg-panel p-4 sm:p-6 rounded-md">
      <div className="mb-6 border-b border-stone-800 pb-4">
        <h3 className="text-xl text-amber-500 font-fantasy flex items-center gap-2">
          <Gem size={18} className="text-amber-700" />
          XP table
        </h3>
        <p className="text-stone-500 text-sm font-body">
          Standard DnD 5e progression. Admins can edit or replace.
        </p>
      </div>

      <div className={`space-y-4 ${isAdmin ? '' : 'opacity-50 pointer-events-none'}`}>
        <button
          onClick={onLoadDefaultXp}
          className="text-left text-xs uppercase tracking-[0.2em] bg-stone-900/60 px-4 py-3 rounded-sm border border-stone-800 text-stone-400 hover:text-amber-500 transition-colors"
        >
          Load standard 5e table
        </button>

        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min="1"
            placeholder="Level"
            className="rpg-input text-stone-200 px-3 py-2 rounded-sm text-sm font-body focus:outline-none placeholder:text-stone-700"
            value={xpLevelInput}
            onChange={(e) => setXpLevelInput(e.target.value)}
          />
          <input
            type="number"
            min="0"
            placeholder="XP"
            className="rpg-input text-stone-200 px-3 py-2 rounded-sm text-sm font-body focus:outline-none placeholder:text-stone-700"
            value={xpValueInput}
            onChange={(e) => setXpValueInput(e.target.value)}
          />
        </div>
        <button
          onClick={onAddXpRow}
          className="fantasy-btn bg-amber-900/20 hover:bg-amber-800/40 text-amber-500 border border-amber-900/50 px-6 py-2 rounded-sm transition-all text-sm uppercase tracking-widest"
        >
          Add row
        </button>

        <div className="grid gap-2">
          {(guildForm.xpTable || []).length === 0 && (
            <div className="text-stone-600 text-sm">No XP table yet.</div>
          )}
          {(guildForm.xpTable || []).map((row) => (
            <div
              key={row.level}
              className="flex items-center justify-between bg-stone-950/60 border border-stone-800 rounded-sm px-3 py-2"
            >
              <div className="text-sm text-stone-300 font-mono">
                Level {row.level} · {row.xp} XP
              </div>
              <button
                onClick={() => onRemoveXpRow(row.level)}
                className="text-xs uppercase tracking-[0.2em] bg-red-900/20 px-3 py-2 rounded-sm border border-red-900/50 text-red-400 hover:text-red-300 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="rpg-panel p-4 sm:p-6 rounded-md">
      <div className="mb-4 border-b border-stone-800 pb-4">
        <h3 className="text-lg text-amber-500 font-fantasy">Leave guild</h3>
        <p className="text-stone-500 text-xs font-body mt-1">
          You will lose access. Admin: role is handed to a random member.
        </p>
      </div>
      {leaveError && (
        <div className="text-xs text-red-400 mb-3 border border-red-900/40 bg-red-950/40 py-2 rounded text-center">
          {leaveError}
        </div>
      )}
      <button
        onClick={onLeaveGuild}
        className="fantasy-btn bg-red-900/20 hover:bg-red-800/40 text-red-400 border border-red-900/50 px-6 py-2 rounded-sm transition-all text-sm uppercase tracking-widest hover:shadow-[0_0_15px_rgba(248,113,113,0.2)]"
      >
        Leave guild
      </button>
    </div>
  </div>
);

export default App;


