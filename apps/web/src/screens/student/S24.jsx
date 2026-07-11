import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";
import { timeAgo } from "../../utils/time.js";

export function S24({ onNav }) {
  const { state, actions } = useStore();
  const comments = state.comments;
  const [replyFor, setReplyFor] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [newText, setNewText] = useState("");

  useEffect(()=>{ if(!comments.length) actions.loadComments(); /* eslint-disable-next-line */ }, []);

  const sendReply = async (c) => {
    if(!replyText.trim()) return;
    await actions.postComment({ author:state.session?.user?.name||"나", type:c.type, target:c.target, content:replyText.trim(), replied:false });
    setReplyText(""); setReplyFor(null);
  };
  const addComment = async () => {
    if(!newText.trim()) return;
    await actions.postComment({ author:state.session?.user?.name||"나", type:"그래프", target:"전체 그래프", content:newText.trim(), replied:false });
    setNewText("");
  };
  const report = async (c) => { await actions.reportComment(c.id, "부적절한 내용"); };

  return (
    <div className="content"><div className="content-narrow">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="sec-title">코멘트 목록</div>
        <span style={{fontSize:13,color:TDS.textTertiary}}>{comments.length}개</span>
      </div>

      {/* 새 코멘트 작성 */}
      <Card className="mb16" style={{marginBottom:16}}>
        <div style={{display:"flex",gap:8}}>
          <input className="inp" style={{flex:1,height:40,fontSize:14}} placeholder="전체 그래프에 코멘트 남기기..." value={newText} onChange={e=>setNewText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addComment()} />
          <Btn v="primary" s="sm" onClick={addComment} disabled={!newText.trim()}>등록</Btn>
        </div>
      </Card>

      {!comments.length && <div style={{textAlign:"center",padding:"48px 0",color:TDS.textTertiary,fontSize:14}}>아직 코멘트가 없습니다</div>}

      {comments.map(c=>(
        <Card key={c.id} className="mb16" style={{marginBottom:16}}>
          <div className="row g-12 mb12" style={{gap:12,marginBottom:12,alignItems:"flex-start"}}>
            <Av name={(c.author||"?")[0]} size="md" />
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:15,fontWeight:700,color:TDS.textPrimary}}>{c.author}</div>
              <div style={{fontSize:12,color:TDS.textTertiary}}>{timeAgo(c.createdAt)} · <Badge t="blue">{c.type}</Badge> {c.target}</div>
            </div>
            {c.reports>0 && <Badge t="red">신고 {c.reports}</Badge>}
            {c.replied&&<Badge t="green">답글 완료</Badge>}
          </div>
          <div style={{fontSize:15,color:TDS.textSecondary,lineHeight:1.7,marginBottom:14}}>{c.content}</div>

          <div className="row g-8" style={{gap:8,alignItems:"center"}}>
            {replyFor===c.id ? (
              <>
                <input className="inp" style={{flex:1,height:40,fontSize:14}} placeholder="답글 작성..." value={replyText} onChange={e=>setReplyText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendReply(c)} autoFocus />
                <Btn v="primary" s="sm" onClick={()=>sendReply(c)}>답글</Btn>
                <Btn v="secondary" s="sm" onClick={()=>{setReplyFor(null);setReplyText("");}}>취소</Btn>
              </>
            ) : (
              <>
                <Btn v="secondary" s="sm" onClick={()=>{setReplyFor(c.id);setReplyText("");}}>답글 달기</Btn>
                <Btn v="secondary" s="sm" style={{color:TDS.danger}} onClick={()=>report(c)}>신고</Btn>
              </>
            )}
          </div>
        </Card>
      ))}

      <Notice type="info">신고한 코멘트는 관리자 신고 큐(A08)로 전달됩니다.</Notice>
    </div></div>
  );
}

/* S25 알림 */

