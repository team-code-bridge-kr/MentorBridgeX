import { useEffect, useCallback, useReducer,
         useContext, createContext, useMemo, useRef } from "react";
import { initialState } from "./initialState.js";
import { reducer } from "./reducer.js";
import { _uid } from "../utils/time.js";
import api from "../api/index.js";
import { saveSession, loadSession, clearSession } from "../api/client.js";
import { armExpiry, clearTimer, SESSION_EXPIRED } from "../lib/sessionExpiry.js";

const StoreCtx = createContext(null);

export const useStore = () => {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within <StoreProvider>");
  return ctx;
};

function initState(base) {
  const session = loadSession();
  // 이미 시간이 지난 토큰으로 들어오면 로그인한 것처럼 시작하지 않는다.
  // (여기서 지워도 로그인 화면의 안내는 armExpiry 가 남긴 것이 뜬다)
  if (session && !armExpiry(session.token)) {
    clearSession();
    return base;
  }
  return session ? { ...base, session } : base;
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, initState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const toast = useCallback((type, msg) => {
    dispatch({ type: "TOAST", toast: { type, msg } });
    setTimeout(() => dispatch({ type: "TOAST", toast: null }), 2600);
  }, []);

  // 세션 변경 시 localStorage 동기화
  useEffect(() => {
    if (state.session) saveSession(state.session);
  }, [state.session]);

  // 로그인 시간이 다 되면 스스로 나간다. 토큰이 바뀔 때마다 알람을 다시 건다.
  useEffect(() => {
    armExpiry(state.session?.token);
    return clearTimer;
  }, [state.session?.token]);

  // 미리 잰 알람이든 401 이든, 끝났다는 신호는 한 곳으로 모인다.
  useEffect(() => {
    const onExpired = () => { clearSession(); dispatch({ type: "SIGN_OUT" }); };
    window.addEventListener(SESSION_EXPIRED, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED, onExpired);
  }, []);

  const actions = useMemo(() => ({
    async signInPassword(email, password) {
      dispatch({ type: "AUTH_START" });
      try {
        const s = await api.auth.signInWithPassword(email, password);
        saveSession(s);
        dispatch({ type: "AUTH_OK", session: s });
        return s;
      } catch (e) {
        dispatch({ type: "AUTH_ERR", error: e.message });
        throw e;
      }
    },
    async signInGoogle() {
      dispatch({ type: "AUTH_START" });
      try {
        const s = await api.auth.signInWithGoogle();
        if (s) {
          saveSession(s);
          dispatch({ type: "AUTH_OK", session: s });
        }
        return s;
      } catch (e) {
        dispatch({ type: "AUTH_ERR", error: e.message });
        throw e;
      }
    },
    async completeGoogleSession(session) {
      saveSession(session);
      dispatch({ type: "AUTH_OK", session });
      return session;
    },
    async signInAdmin(email, password, mfa) {
      dispatch({ type: "AUTH_START" });
      try {
        const s = await api.auth.signInAdmin(email, password, mfa);
        saveSession(s);
        dispatch({ type: "AUTH_OK", session: s });
        return s;
      } catch (e) {
        dispatch({ type: "AUTH_ERR", error: e.message });
        throw e;
      }
    },
    /**
     * 세션의 사용자 정보를 부분 갱신한다 (온보딩에서 역할·학년을 정한 직후).
     * 다시 로그인하지 않아도 사이드바·게이팅이 바로 새 역할을 따르게 하려는 것.
     */
    updateSessionUser(patch) {
      const cur = stateRef.current.session;
      if (!cur) return null;
      const next = { ...cur, user: { ...cur.user, ...patch } };
      saveSession(next);
      dispatch({ type: "AUTH_OK", session: next });
      return next;
    },
    async signOut() {
      await api.auth.signOut();
      clearSession();
      dispatch({ type: "SIGN_OUT" });
    },

    async loadGraph(userId) {
      dispatch({ type: "GRAPH_LOADING" });
      const g = await api.graph.fetch(userId);
      dispatch({ type: "GRAPH_SET", nodes: g.nodes, edges: g.edges });
    },
    async addNode(node) {
      const n = await api.graph.addNode(node);
      dispatch({ type: "GRAPH_ADD_NODE", node: n });
      toast("success", "노드가 추가되었습니다.");
      return n;
    },
    async renameNode(id, label) {
      await api.graph.renameNode(id, label);
      const g = await api.graph.fetch();
      dispatch({ type: "GRAPH_SET", nodes: g.nodes, edges: g.edges });
      toast("success", "이름을 바꿨습니다.");
    },
    /**
     * 노드 고치기(이름·설명·과목). 고친 뒤 그래프를 통째로 다시 받는다 —
     * 과목이 바뀌면 아이콘뿐 아니라 **배치(어느 가지에 매달리는지)** 까지
     * 달라지므로, 그 자리에서 한 노드만 갈아 끼우면 그림이 어긋난다.
     */
    async updateNode(id, patch) {
      await api.graph.updateNode(id, patch);
      const g = await api.graph.fetch();
      dispatch({ type: "GRAPH_SET", nodes: g.nodes, edges: g.edges });
      toast("success", "노드를 수정했습니다.");
    },
    /** 연결 만들기 — 만든 뒤 다시 받는다(가지 선이 새로 계산된다) */
    async connectNodes(fromId, toId) {
      await api.graph.addEdge({ from: fromId, to: toId });
      const g = await api.graph.fetch();
      dispatch({ type: "GRAPH_SET", nodes: g.nodes, edges: g.edges });
      toast("success", "연결했습니다.");
    },
    async disconnectNodes(edgeId) {
      await api.graph.removeEdge(edgeId);
      const g = await api.graph.fetch();
      dispatch({ type: "GRAPH_SET", nodes: g.nodes, edges: g.edges });
      toast("success", "연결을 끊었습니다.");
    },
    async deleteNode(id) {
      await api.graph.removeNode(id);
      dispatch({ type: "GRAPH_DEL_NODE", id });
      toast("success", "노드가 삭제되었습니다.");
    },
    async generateGraph(keywords) {
      dispatch({ type: "GRAPH_LOADING" });
      const newNodes = await api.graph.generateFromSeeds(keywords);
      const cur = stateRef.current.graph.nodes;
      const offset = cur.length
        ? newNodes.map((n, i) => ({ ...n, x: `${(15 + (i * 11) % 70)}%`, y: `${(70 + (i * 7) % 20)}%` }))
        : newNodes;
      dispatch({ type: "GRAPH_SET", nodes: [...cur, ...offset], edges: stateRef.current.graph.edges });
      toast("success", `${newNodes.length}개 노드가 그래프에 추가되었습니다.`);
    },

    async loadComments(targetId) {
      const items = await api.comments.list(targetId);
      dispatch({ type: "COMMENTS_SET", items });
    },
    async postComment(c) {
      const item = await api.comments.create(c);
      dispatch({ type: "COMMENT_ADD", item });
      toast("success", "코멘트가 등록되었습니다.");
      return item;
    },
    async reportComment(id, reason) {
      await api.comments.report(id, reason);
      dispatch({ type: "COMMENT_REPORT", id });
      const c = (stateRef.current.comments || []).find((x) => x.id === id);
      dispatch({
        type: "REPORT_ADD",
        item: {
          id: _uid("R"), target: id, type: "코멘트", reason, reports: 1,
          status: "검토 중", content: c?.content, author: c?.author,
        },
      });
      toast("info", "신고가 접수되었습니다. 관리자 큐로 전달됩니다.");
    },
    async removeComment(id) {
      await api.comments.remove(id);
      dispatch({ type: "COMMENT_DEL", id });
      toast("success", "코멘트가 삭제되었습니다.");
    },

    async loadNotifications() {
      const items = await api.notifications.list();
      dispatch({ type: "NOTIFS_SET", items });
      return items;
    },
    async markNotificationRead(id) {
      await api.notifications.read(id);
      dispatch({ type: "NOTIF_READ", id });
    },
    async markAllNotificationsRead() {
      await api.notifications.readAll();
      dispatch({ type: "NOTIF_READ_ALL" });
    },

    async loadStudents(teacherId) {
      const items = await api.teacher.listStudents(teacherId);
      dispatch({ type: "STUDENTS_SET", items });
    },
    selectStudent(student) { dispatch({ type: "SELECT_STUDENT", student }); },
    async submitTeacherVerification(payload) {
      const app = await api.teacher.submitVerification(payload);
      dispatch({
        type: "TVERIFY_SET",
        item: { status: app.status, school: app.school, subject: app.subject, submittedAt: app.submittedAt },
      });
      dispatch({
        type: "TAPP_ADD",
        item: {
          id: app.id,
          name: stateRef.current.session?.user?.name || "교사",
          school: app.school, subject: app.subject, teacherNo: app.teacherNo,
          status: "검토 중", submittedAt: app.submittedAt,
        },
      });
      toast("success", "자격 검증 신청이 제출되었습니다.");
      return app;
    },
    async approveTeacherApp(id, ok) {
      await api.admin.verifyTeacher(id, ok);
      dispatch({ type: "TAPP_UPD", id, patch: { status: ok ? "승인됨" : "반려됨" } });
      if (stateRef.current.teacherVerification) {
        dispatch({
          type: "TVERIFY_SET",
          item: { ...stateRef.current.teacherVerification, status: ok ? "승인됨" : "반려됨" },
        });
      }
      toast("success", ok ? "교사 자격을 승인했습니다." : "교사 자격을 반려했습니다.");
    },

    async loadAdminUsers(q) {
      const items = await api.admin.listUsers(q);
      dispatch({ type: "ADMIN_USERS_SET", items });
    },
    async suspendUser(id, reason) {
      await api.admin.suspendUser(id, reason);
      dispatch({ type: "ADMIN_USER_UPD", id, patch: { status: "정지됨" } });
      toast("success", "사용자를 정지했습니다.");
    },
    async restoreUser(id) {
      await api.admin.suspendUser(id, "해제");
      dispatch({ type: "ADMIN_USER_UPD", id, patch: { status: "활성" } });
      toast("success", "정지를 해제했습니다.");
    },
    async deleteUser(id) {
      await api.admin.deleteUser(id);
      dispatch({ type: "ADMIN_USER_UPD", id, patch: { status: "삭제됨" } });
      toast("success", "사용자를 삭제했습니다.");
    },
    async loadReports() {
      const items = await api.admin.listReports();
      dispatch({ type: "REPORTS_SET", items });
    },
    async resolveReport(id, action) {
      await api.admin.resolveReport(id, action);
      dispatch({ type: "REPORT_UPD", id, patch: { status: "처리됨" } });
      toast("success", "신고를 처리했습니다.");
    },
    async loadAnnouncements() {
      const items = await api.admin.listAnnouncements();
      dispatch({ type: "ANN_SET", items });
    },
    async publishAnnouncement(a) {
      const item = await api.admin.publishAnnouncement(a);
      dispatch({ type: "ANN_ADD", item });
      toast("success", "공지를 발행했습니다.");
      return item;
    },
    async verifyTeacher(id, ok) {
      await api.admin.verifyTeacher(id, ok);
      toast("success", ok ? "교사 자격을 승인했습니다." : "교사 자격을 반려했습니다.");
    },

    toast,
  }), [toast]);

  // 로그인 세션이 있으면 알림을 불러오고, 포커스/주기적으로 갱신
  useEffect(() => {
    if (!state.session) return undefined;
    let cancelled = false;
    const refresh = async () => {
      try {
        const items = await api.notifications.list();
        if (!cancelled) dispatch({ type: "NOTIFS_SET", items });
      } catch {
        /* 헤더 배지만 조용히 실패 허용 */
      }
    };
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    const timer = setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, [state.session?.token]);

  return <StoreCtx.Provider value={{ state, actions }}>{children}</StoreCtx.Provider>;
}
