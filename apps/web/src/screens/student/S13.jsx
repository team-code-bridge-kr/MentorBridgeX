import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S13({ onNav }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const handleUpload = () => {
    if(!file) return;
    setUploading(true);
    setTimeout(()=>{ setUploading(false); onNav("S14"); }, 1800);
  };
  return (
    <div className="content" style={{maxWidth:560,margin:"0 auto"}}>
      <div style={{fontSize:22,fontWeight:700,marginBottom:6}}>PDF 업로드</div>
      <div style={{fontSize:14,color:TDS.textTertiary,marginBottom:24}}>생활기록부 PDF를 업로드하면 자동으로 텍스트를 추출합니다</div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{border:`2px dashed ${file?TDS.blue500:TDS.borderDefault}`,borderRadius:12,padding:"40px 24px",textAlign:"center",background:file?TDS.blue50:"transparent",transition:"all .2s",cursor:"pointer"}} onClick={()=>document.getElementById("pdf-inp").click()}>
          <TFI s={48}>{file?"📄":"📤"}</TFI>
          <div style={{fontSize:15,fontWeight:600,color:file?TDS.blue500:TDS.textSecondary,marginTop:12}}>{file?file.name:"파일을 선택하거나 여기로 드래그하세요"}</div>
          <div style={{fontSize:12,color:TDS.textTertiary,marginTop:6}}>{file?`${(file.size/1024/1024).toFixed(2)} MB`:"PDF 파일 · 최대 50 MB"}</div>
        </div>
        <input id="pdf-inp" type="file" accept=".pdf" style={{display:"none"}} onChange={e=>setFile(e.target.files[0])} />
        {file && <div style={{marginTop:16,padding:"12px",background:TDS.successBg,borderRadius:8,fontSize:13,color:TDS.success,display:"flex",alignItems:"center",gap:8}}><TFI>✅</TFI>파일이 선택되었습니다</div>}
      </div>
      <Notice type="info" style={{marginBottom:20}}>업로드 후 파싱이 완료되면 알림으로 안내합니다. 평균 1~3분 소요.</Notice>
      <Btn v="primary" s="lg" fw disabled={!file||uploading} onClick={handleUpload}>
        {uploading?"업로드 중...":"업로드 시작"}
      </Btn>
    </div>
  );
}

/* S14 PDF 파싱 결과 검토 */

