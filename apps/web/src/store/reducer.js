import { initialState } from "./initialState.js";

export function reducer(state, a) {
  switch (a.type) {
    case "AUTH_START":   return { ...state, authLoading:true, authError:null };
    case "AUTH_OK":      return { ...state, authLoading:false, authError:null, session:a.session };
    case "AUTH_ERR":     return { ...state, authLoading:false, authError:a.error };
    case "SIGN_OUT":     return { ...initialState,
      // 세션만 초기화하고 공유 데이터는 유지 (역할 전환 데모가 로그아웃 후에도 이어지도록)
      comments:state.comments, reports:state.reports,
      teacherApplications:state.teacherApplications, students:state.students,
      adminUsers:state.adminUsers, announcements:state.announcements,
      graph:state.graph };
    case "GRAPH_LOADING":return { ...state, graph:{ ...state.graph, loading:true } };
    case "GRAPH_SET":    return { ...state, graph:{ nodes:a.nodes, edges:a.edges, loading:false } };
    case "GRAPH_ADD_NODE":return { ...state, graph:{ ...state.graph, nodes:[...state.graph.nodes, a.node] } };
    case "GRAPH_DEL_NODE":return { ...state, graph:{ ...state.graph, nodes:state.graph.nodes.filter(n=>n.id!==a.id), edges:state.graph.edges.filter(e=>e.from!==a.id&&e.to!==a.id) } };
    case "COMMENTS_SET": return { ...state, comments:a.items };
    case "COMMENT_ADD":  return { ...state, comments:[a.item, ...state.comments] };
    case "COMMENT_REPORT":return { ...state, comments:state.comments.map(c=>c.id===a.id?{ ...c, reports:(c.reports||0)+1, status:"검토 중" }:c) };
    case "COMMENT_DEL":  return { ...state, comments:state.comments.filter(c=>c.id!==a.id) };
    case "STUDENTS_SET": return { ...state, students:a.items };
    case "SELECT_STUDENT":return { ...state, selectedStudent:a.student };
    case "TVERIFY_SET":  return { ...state, teacherVerification:a.item };
    case "TAPP_SET":     return { ...state, teacherApplications:a.items };
    case "TAPP_ADD":     return { ...state, teacherApplications:[a.item, ...state.teacherApplications] };
    case "TAPP_UPD":     return { ...state, teacherApplications:state.teacherApplications.map(t=>t.id===a.id?{ ...t, ...a.patch }:t) };
    case "ADMIN_USERS_SET":return { ...state, adminUsers:a.items };
    case "ADMIN_USER_UPD":return { ...state, adminUsers:state.adminUsers.map(u=>u.id===a.id?{ ...u, ...a.patch }:u) };
    case "REPORTS_SET":  return { ...state, reports:a.items };
    case "REPORT_ADD":   return { ...state, reports:[a.item, ...state.reports] };
    case "REPORT_UPD":   return { ...state, reports:state.reports.map(r=>r.id===a.id?{ ...r, ...a.patch }:r) };
    case "ANN_SET":      return { ...state, announcements:a.items };
    case "ANN_ADD":      return { ...state, announcements:[a.item, ...state.announcements] };
    case "TOAST":        return { ...state, toast:a.toast };
    default: return state;
  }
}

const StoreCtx = createContext(null);

