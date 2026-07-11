import { useState, useEffect, useCallback, useReducer,
         useContext, createContext, useMemo, useRef } from "react";
import { initialState } from "./initialState.js";
import { reducer } from "./reducer.js";
import { _uid } from "../utils/time.js";
import api from "../api/index.js";

const StoreCtx = createContext(null);

export const useStore = () => {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within <StoreProvider>");
  return ctx;
};

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;   // 매 렌더마다 최신 state 참조 (actions 클로저용)
  const toast = useCallback((type, msg) => {
    dispatch({ type:"TOAST", toast:{ type, msg } });
    setTimeout(()=>dispatch({ type:"TOAST", toast:null }), 2600);
  }, []);

  const actions = useMemo(() => ({
    /* ── 인증 ── */
    async signInPassword(email, password) {
      dispatch({ type:"AUTH_START" });
      try { const s = await api.auth.signInWithPassword(email, password); dispatch({ type:"AUTH_OK", session:s }); return s; }
      catch (e) { dispatch({ type:"AUTH_ERR", error:e.message }); throw e; }
    },
    async signInGoogle() {
      dispatch({ type:"AUTH_START" });
      try { const s = await api.auth.signInWithGoogle(); dispatch({ type:"AUTH_OK", session:s }); return s; }
      catch (e) { dispatch({ type:"AUTH_ERR", error:e.message }); throw e; }
    },
    async signInAdmin(email, password, mfa) {
      dispatch({ type:"AUTH_START" });
      try { const s = await api.auth.signInAdmin(email, password, mfa); dispatch({ type:"AUTH_OK", session:s }); return s; }
      catch (e) { dispatch({ type:"AUTH_ERR", error:e.message }); throw e; }
    },
    async signOut() { await api.auth.signOut(); dispatch({ type:"SIGN_OUT" }); },

    /* ── 그래프 ── */
    async loadGraph(userId) {
      dispatch({ type:"GRAPH_LOADING" });
      const g = await api.graph.fetch(userId);
      dispatch({ type:"GRAPH_SET", nodes:g.nodes, edges:g.edges });
    },
    async addNode(node) { const n = await api.graph.addNode(node); dispatch({ type:"GRAPH_ADD_NODE", node:n }); toast("success","노드가 추가되었습니다."); return n; },
    async deleteNode(id){ await api.graph.removeNode(id); dispatch({ type:"GRAPH_DEL_NODE", id }); toast("success","노드가 삭제되었습니다."); },
    async generateGraph(keywords) {
      dispatch({ type:"GRAPH_LOADING" });
      const newNodes = await api.graph.generateFromSeeds(keywords);
      const cur = stateRef.current.graph.nodes;
      // 기존 그래프에 이어붙이기 (겹치지 않게 살짝 오프셋). 비어있으면 그대로 배치.
      const offset = cur.length ? newNodes.map((n,i)=>({ ...n, x:`${(15+(i*11)%70)}%`, y:`${(70+(i*7)%20)}%` })) : newNodes;
      dispatch({ type:"GRAPH_SET", nodes:[...cur, ...offset], edges:stateRef.current.graph.edges });
      toast("success",`${newNodes.length}개 노드가 그래프에 추가되었습니다.`);
    },

    /* ── 코멘트 / 신고 ── */
    async loadComments(targetId) { const items = await api.comments.list(targetId); dispatch({ type:"COMMENTS_SET", items }); },
    async postComment(c) { const item = await api.comments.create(c); dispatch({ type:"COMMENT_ADD", item }); toast("success","코멘트가 등록되었습니다."); return item; },
    async reportComment(id, reason) {
      await api.comments.report(id, reason);
      dispatch({ type:"COMMENT_REPORT", id });
      // 신고를 관리자 신고 큐에도 추가 (화면 간 데이터 흐름)
      const c = (stateRef.current.comments||[]).find(x=>x.id===id);
      dispatch({ type:"REPORT_ADD", item:{ id:_uid("R"), target:id, type:"코멘트", reason, reports:1, status:"검토 중", content:c?.content, author:c?.author } });
      toast("info","신고가 접수되었습니다. 관리자 큐로 전달됩니다.");
    },
    async removeComment(id) { await api.comments.remove(id); dispatch({ type:"COMMENT_DEL", id }); toast("success","코멘트가 삭제되었습니다."); },

    /* ── 교사 자격 검증 / 담당 학생 ── */
    async loadStudents(teacherId) { const items = await api.teacher.listStudents(teacherId); dispatch({ type:"STUDENTS_SET", items }); },
    selectStudent(student) { dispatch({ type:"SELECT_STUDENT", student }); },
    async submitTeacherVerification(payload) {
      const app = await api.teacher.submitVerification(payload);
      dispatch({ type:"TVERIFY_SET", item:{ status:app.status, school:app.school, subject:app.subject, submittedAt:app.submittedAt } });
      // 관리자 교사 검증 큐에도 추가 (화면 간 데이터 흐름)
      dispatch({ type:"TAPP_ADD", item:{ id:app.id, name:stateRef.current.session?.user?.name||"교사", school:app.school, subject:app.subject, teacherNo:app.teacherNo, status:"검토 중", submittedAt:app.submittedAt } });
      toast("success","자격 검증 신청이 제출되었습니다.");
      return app;
    },
    async approveTeacherApp(id, ok) {
      await api.admin.verifyTeacher(id, ok);
      dispatch({ type:"TAPP_UPD", id, patch:{ status: ok?"승인됨":"반려됨" } });
      // 신청자 본인의 상태도 갱신 (같은 store)
      if (stateRef.current.teacherVerification) dispatch({ type:"TVERIFY_SET", item:{ ...stateRef.current.teacherVerification, status: ok?"승인됨":"반려됨" } });
      toast("success", ok?"교사 자격을 승인했습니다.":"교사 자격을 반려했습니다.");
    },

    /* ── 관리자 ── */
    async loadAdminUsers(q) { const items = await api.admin.listUsers(q); dispatch({ type:"ADMIN_USERS_SET", items }); },
    async suspendUser(id, reason) { await api.admin.suspendUser(id, reason); dispatch({ type:"ADMIN_USER_UPD", id, patch:{ status:"정지됨" } }); toast("success","사용자를 정지했습니다."); },
    async restoreUser(id) { await api.admin.suspendUser(id, "해제"); dispatch({ type:"ADMIN_USER_UPD", id, patch:{ status:"활성" } }); toast("success","정지를 해제했습니다."); },
    async deleteUser(id) { await api.admin.deleteUser(id); dispatch({ type:"ADMIN_USER_UPD", id, patch:{ status:"삭제됨" } }); toast("success","사용자를 삭제했습니다."); },
    async loadReports() { const items = await api.admin.listReports(); dispatch({ type:"REPORTS_SET", items }); },
    async resolveReport(id, action) { await api.admin.resolveReport(id, action); dispatch({ type:"REPORT_UPD", id, patch:{ status:"처리됨" } }); toast("success","신고를 처리했습니다."); },
    async loadAnnouncements() { const items = await api.admin.listAnnouncements(); dispatch({ type:"ANN_SET", items }); },
    async publishAnnouncement(a) { const item = await api.admin.publishAnnouncement(a); dispatch({ type:"ANN_ADD", item }); toast("success","공지를 발행했습니다."); return item; },
    async verifyTeacher(id, ok) { await api.admin.verifyTeacher(id, ok); toast("success", ok?"교사 자격을 승인했습니다.":"교사 자격을 반려했습니다."); },

    toast,
  }), [toast]);

  return <StoreCtx.Provider value={{ state, actions }}>{children}</StoreCtx.Provider>;
}

/* 전역 토스트 렌더러 */

