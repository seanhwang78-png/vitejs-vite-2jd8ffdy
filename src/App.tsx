import React, { useState, useCallback } from "react";

type Order = {
  제품명: string;
  수량: string;
  판매가: string;
  수령일: string;
  상태: "미입고" | "미수령" | "수령완료";
};

type Member = {
  이름: string;
  전화번호뒷자리: string;
  추가정보: string;
  주문: Order[];
};

const SHEET_ID = "1i5ssylMyIHv-lMr38y_jk4jP0j--DqI4bG2ge1MgIWQ";

function parseDate(str: string): Date | null {
  if (!str) return null;
  const match = str.match(/(\d+)\/(\d+)/);
  if (!match) return null;
  const now = new Date();
  return new Date(now.getFullYear(), parseInt(match[1]) - 1, parseInt(match[2]));
}

export default function App() {
  const [data, setData] = useState<Member[]>([]);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Member[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tab, setTab] = useState<"search" | "product">("search");
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  const loadSheet = async () => {
    setLoading(true);
    setError("");
    try {
      const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=tsv&gid=0&t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("시트 불러오기 실패");
      const text = await res.text();

      const lines = text.trim().split("\n").map(l =>
        l.split("\t").map(v => v.replace(/^"|"$/g, "").trim())
      );

      const nameRow = lines[1] || [];
      const phoneRow = lines[2] || [];
      const infoRow = lines[0] || [];

      const products: { 제품명: string; 수령일: string; 판매가: string; row: string[] }[] = [];
      for (let r = 4; r < lines.length; r++) {
        const 제품명 = lines[r]?.[7] || "";
        if (!제품명) continue;
        products.push({
          제품명,
          수령일: lines[r]?.[5] || "",
          판매가: lines[r]?.[6] || "",
          row: lines[r],
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const members: Member[] = [];
      for (let i = 11; i < nameRow.length; i += 2) {
        if (!nameRow[i]) continue;

        const orders: Order[] = [];
        for (const p of products) {
          const qty = p.row[i];
          const pickup = p.row[i + 1];
          if (!qty || qty === "0" || qty === "") continue;

          const 수령일Date = parseDate(p.수령일);
          let 상태: "미입고" | "미수령" | "수령완료" = "미수령";
          if (pickup === "O") {
            상태 = "수령완료";
          } else if (수령일Date && 수령일Date > today) {
            상태 = "미입고";
          } else {
            상태 = "미수령";
          }

          orders.push({ 제품명: p.제품명, 수량: qty, 판매가: p.판매가, 수령일: p.수령일, 상태 });
        }

        members.push({
          이름: nameRow[i],
          전화번호뒷자리: phoneRow[i] || "",
          추가정보: infoRow[i] || "",
          주문: orders,
        });
      }

      if (members.length === 0) throw new Error("회원 데이터가 없습니다");
      setData(members);
      setConnected(true);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const search = useCallback(() => {
    if (!query.trim()) return;
    const q = query.trim();
    setResult(data.filter(m =>
      m.이름.includes(q) || m.전화번호뒷자리.includes(q)
    ));
  }, [query, data]);

  const totalMembers = data.length;

  // 상품별 미수령 집계
  const productList = Array.from(
    new Set(data.flatMap(m => m.주문.map(o => o.제품명)))
  );

  const getProductStats = (제품명: string) => {
    const 미수령회원 = data.filter(m =>
      m.주문.some(o => o.제품명 === 제품명 && o.상태 === "미수령")
    );
    const 수령완료회원 = data.filter(m =>
      m.주문.some(o => o.제품명 === 제품명 && o.상태 === "수령완료")
    );
    const 미입고회원 = data.filter(m =>
      m.주문.some(o => o.제품명 === 제품명 && o.상태 === "미입고")
    );
    return { 미수령회원, 수령완료회원, 미입고회원 };
  };

  const statusStyle = (상태: string): React.CSSProperties => {
    if (상태 === "수령완료") return { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" };
    if (상태 === "미수령") return { background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" };
    return { background: "rgba(148,163,184,0.15)", color: "#94a3b8", border: "1px solid rgba(148,163,184,0.3)" };
  };

  const statusLabel = (상태: string) => {
    if (상태 === "수령완료") return "🔴 수령완료";
    if (상태 === "미수령") return "🟢 수령가능";
    return "⚪ 미입고";
  };

  const s: Record<string, React.CSSProperties> = {
    wrap: { minHeight: "100vh", background: "linear-gradient(135deg,#0f172a,#1e293b)", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 16px 60px", fontFamily: "sans-serif" },
    card: { width: "100%", maxWidth: 480, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: 20, marginBottom: 16 },
    input: { width: "100%", boxSizing: "border-box" as const, background: "rgba(255,255,255,0.07)", border: "2px solid rgba(99,102,241,0.4)", borderRadius: 14, padding: "16px", color: "#f1f5f9", fontSize: 18, outline: "none", textAlign: "center" as const },
    btn: { width: "100%", marginTop: 12, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 14, padding: 16, color: "#fff", fontSize: 17, fontWeight: 800, cursor: "pointer" },
  };

  return (
    <div style={s.wrap}>
      {/* 헤더 */}
      <div style={{ width: "100%", maxWidth: 480, textAlign: "center", padding: "40px 0 16px" }}>
        <h1 style={{ color: "#f1f5f9", fontSize: 28, fontWeight: 800, margin: 0 }}>🛍️ 공동구매 픽업 확인</h1>
        <p style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>
          {connected
            ? `✅ 연동됨 · ${totalMembers}명 · ${lastUpdated?.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준`
            : "시트 연동 필요"}
        </p>
        {connected && (
          <button onClick={loadSheet} disabled={loading} style={{
            marginTop: 8, background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)",
            borderRadius: 100, padding: "6px 16px", color: "#a5b4fc", fontSize: 13, cursor: "pointer", fontWeight: 600,
          }}>
            {loading ? "⏳ 업데이트 중..." : "🔄 새로고침"}
          </button>
        )}
      </div>

      {/* 탭 */}
      {connected && (
        <div style={{ width: "100%", maxWidth: 480, display: "flex", gap: 8, marginBottom: 16 }}>
          {(["search", "product"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setSelectedProduct(null); }} style={{
              flex: 1, padding: "12px", borderRadius: 14, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14,
              background: tab === t ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.05)",
              color: tab === t ? "#fff" : "#64748b",
            }}>
              {t === "search" ? "🔍 회원 검색" : "📦 상품별 미수령"}
            </button>
          ))}
        </div>
      )}

      {/* 연동 버튼 */}
      {!connected && (
        <div style={s.card}>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 12px" }}>구글 시트가 자동으로 연동돼요</p>
          <button onClick={loadSheet} disabled={loading} style={s.btn}>
            {loading ? "불러오는 중..." : "📊 시트 연동하기"}
          </button>
          {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>⚠️ {error}</p>}
        </div>
      )}

      {/* 회원 검색 탭 */}
      {connected && tab === "search" && (
        <>
          {!result ? (
            <div style={s.card}>
              <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 12px" }}>🔍 이름 또는 전화번호 뒷자리</p>
              <input
                autoFocus value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && search()}
                placeholder="예) 김민지 또는 5678"
                style={s.input}
              />
              <button onClick={search} style={s.btn}>조회하기</button>
            </div>
          ) : (
            <div style={{ width: "100%", maxWidth: 480 }}>
              {result.length === 0 ? (
                <div style={{ ...s.card, textAlign: "center", padding: 40 }}>
                  <div style={{ fontSize: 40 }}>😔</div>
                  <p style={{ color: "#fca5a5", fontWeight: 700, marginTop: 12 }}>회원을 찾을 수 없어요</p>
                </div>
              ) : result.map((member, i) => (
                <div key={i} style={s.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div>
                      <span style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9" }}>{member.이름}</span>
                      <span style={{ fontSize: 13, color: "#64748b", marginLeft: 8 }}>뒷자리 {member.전화번호뒷자리}</span>
                    </div>
                    {member.추가정보 && (
                      <span style={{ fontSize: 12, color: "#a5b4fc", background: "rgba(99,102,241,0.15)", borderRadius: 100, padding: "3px 10px" }}>
                        {member.추가정보}
                      </span>
                    )}
                  </div>
                  {member.주문.length === 0 ? (
                    <p style={{ color: "#64748b", fontSize: 13, textAlign: "center" }}>주문 내역이 없어요</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {member.주문.map((order, j) => (
                        <div key={j} style={{ background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                              {order.제품명}
                            </div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                              <span style={{ color: "#a5b4fc", fontSize: 28, fontWeight: 800, lineHeight: 1 }}>
                                {order.수량}
                              </span>
                              <span style={{ color: "#94a3b8", fontSize: 15, fontWeight: 600 }}>개</span>
                            </div>
                            <div style={{ color: "#64748b", fontSize: 12 }}>
                              {order.판매가} · 수령일 {order.수령일}
                            </div>
                          </div>
                          <span style={{ ...statusStyle(order.상태), borderRadius: 100, padding: "6px 12px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" as const, marginLeft: 12 }}>
                            {statusLabel(order.상태)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button onClick={() => { setResult(null); setQuery(""); }} style={{ ...s.btn, background: "rgba(255,255,255,0.06)", marginTop: 4 }}>
                ← 다시 검색
              </button>
            </div>
          )}
        </>
      )}

      {/* 상품별 미수령 탭 */}
      {connected && tab === "product" && (
        <div style={{ width: "100%", maxWidth: 480 }}>
          {!selectedProduct ? (
            // 상품 목록
            <div style={s.card}>
              <p style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700, margin: "0 0 16px" }}>📦 상품을 선택하세요</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {productList.map((제품명, i) => {
                  const { 미수령회원, 수령완료회원 } = getProductStats(제품명);
                  const 전체 = 미수령회원.length + 수령완료회원.length;
                  return (
                    <button key={i} onClick={() => setSelectedProduct(제품명)} style={{
                      background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 14, padding: "14px 16px", cursor: "pointer",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      textAlign: "left",
                    }}>
                      <span style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700 }}>{제품명}</span>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ background: "rgba(16,185,129,0.2)", color: "#10b981", borderRadius: 100, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
                          미수령 {미수령회원.length}
                        </span>
                        <span style={{ color: "#475569", fontSize: 12 }}>/ {전체}명</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            // 선택된 상품의 미수령 고객 목록
            (() => {
              const { 미수령회원, 수령완료회원, 미입고회원 } = getProductStats(selectedProduct);
              return (
                <div>
                  {/* 상품 헤더 */}
                  <div style={{ ...s.card, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 800 }}>{selectedProduct}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span style={{ background: "rgba(16,185,129,0.2)", color: "#10b981", borderRadius: 100, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
                          🟢 {미수령회원.length}
                        </span>
                        <span style={{ background: "rgba(239,68,68,0.2)", color: "#f87171", borderRadius: 100, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
                          🔴 {수령완료회원.length}
                        </span>
                        <span style={{ background: "rgba(148,163,184,0.15)", color: "#94a3b8", borderRadius: 100, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
                          ⚪ {미입고회원.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 미수령 목록 */}
                  {미수령회원.length > 0 && (
                    <div style={s.card}>
                      <p style={{ color: "#10b981", fontSize: 13, fontWeight: 700, margin: "0 0 12px" }}>🟢 수령 대기 ({미수령회원.length}명)</p>
                      {미수령회원.map((m, i) => {
                        const order = m.주문.find(o => o.제품명 === selectedProduct && o.상태 === "미수령");
                        return (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                            <div>
                              <span style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700 }}>{m.이름}</span>
                              <span style={{ color: "#64748b", fontSize: 12, marginLeft: 8 }}>뒷자리 {m.전화번호뒷자리}</span>
                            </div>
                            <span style={{ color: "#a5b4fc", fontSize: 20, fontWeight: 800 }}>{order?.수량}개</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 수령완료 목록 */}
                  {수령완료회원.length > 0 && (
                    <div style={s.card}>
                      <p style={{ color: "#f87171", fontSize: 13, fontWeight: 700, margin: "0 0 12px" }}>🔴 수령완료 ({수령완료회원.length}명)</p>
                      {수령완료회원.map((m, i) => {
                        const order = m.주문.find(o => o.제품명 === selectedProduct && o.상태 === "수령완료");
                        return (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                            <div>
                              <span style={{ color: "#94a3b8", fontSize: 15, fontWeight: 700 }}>{m.이름}</span>
                              <span style={{ color: "#475569", fontSize: 12, marginLeft: 8 }}>뒷자리 {m.전화번호뒷자리}</span>
                            </div>
                            <span style={{ color: "#64748b", fontSize: 20, fontWeight: 800 }}>{order?.수량}개</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 미입고 목록 */}
                  {미입고회원.length > 0 && (
                    <div style={s.card}>
                      <p style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700, margin: "0 0 12px" }}>⚪ 미입고 ({미입고회원.length}명)</p>
                      {미입고회원.map((m, i) => {
                        const order = m.주문.find(o => o.제품명 === selectedProduct && o.상태 === "미입고");
                        return (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                            <div>
                              <span style={{ color: "#64748b", fontSize: 15, fontWeight: 700 }}>{m.이름}</span>
                              <span style={{ color: "#475569", fontSize: 12, marginLeft: 8 }}>뒷자리 {m.전화번호뒷자리}</span>
                            </div>
                            <span style={{ color: "#64748b", fontSize: 20, fontWeight: 800 }}>{order?.수량}개</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button onClick={() => setSelectedProduct(null)} style={{ ...s.btn, background: "rgba(255,255,255,0.06)", marginTop: 4 }}>
                    ← 상품 목록으로
                  </button>
                </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}
