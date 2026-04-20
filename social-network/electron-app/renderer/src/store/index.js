import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // ── Auth ────────────────────────────────────────────────
  me:  null,
  tok: localStorage.getItem('sn_tok') || '',

  setMe:    (me)  => set({ me }),
  setTok:   (tok) => { localStorage.setItem('sn_tok', tok); set({ tok }) },
  clearAuth: ()   => {
    localStorage.removeItem('sn_tok')
    set({ me: null, tok: '', ws: null, wsOn: false })
  },

  // ── Navigation ──────────────────────────────────────────
  page: 'feed',
  setPage: (page) => set({ page }),

  // ── Users / Online ──────────────────────────────────────
  users:     [],
  onlineIDs: new Set(),

  setUsers:    (users)    => set({ users }),
  setOnlineIDs:(ids)      => set({ onlineIDs: new Set(ids) }),
  addOnline:   (id)       => set(s => ({ onlineIDs: new Set([...s.onlineIDs, id]) })),
  removeOnline:(id)       => set(s => { const o = new Set(s.onlineIDs); o.delete(id); return { onlineIDs: o } }),

  // ── Chat ────────────────────────────────────────────────
  activeChatID: null,
  unreadDM:     {},
  cachedMsgs:   {},

  setActiveChatID: (id)       => set({ activeChatID: id }),
  clearUnread:     (id)       => set(s => ({ unreadDM: { ...s.unreadDM, [id]: 0 } })),
  addUnread:       (id)       => set(s => ({ unreadDM: { ...s.unreadDM, [id]: (s.unreadDM[id] || 0) + 1 } })),
  setCachedMsgs:   (key, msgs)=> set(s => ({ cachedMsgs: { ...s.cachedMsgs, [key]: msgs } })),
  pushMsg:         (key, msg) => set(s => ({ cachedMsgs: { ...s.cachedMsgs, [key]: [...(s.cachedMsgs[key] || []), msg] } })),

  // ── WebSocket ────────────────────────────────────────────
  ws:    null,
  wsOn:  false,
  setWs:   (ws)   => set({ ws }),
  setWsOn: (wsOn) => set({ wsOn }),

  // ── Notifications ─────────────────────────────────────────
  notifCnt: 0,
  incNotif:   () => set(s => ({ notifCnt: s.notifCnt + 1 })),
  resetNotif: () => set({ notifCnt: 0 }),

  // ── Toast ────────────────────────────────────────────────
  toast: null,
  showToast: (msg, dur = 3000) => {
    set({ toast: msg })
    setTimeout(() => set(s => s.toast === msg ? { toast: null } : {}), dur)
  },
}))
