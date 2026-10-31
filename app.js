const boardEl = document.querySelector("#board");
const messageEl = document.querySelector("#coach-message");
const moveListEl = document.querySelector("#move-list");
const overlay = document.querySelector("#thinking-overlay");
const engineStatus = document.querySelector("#engine-status");
const files = "abcdefgh";
const values = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
const glyphs = { wp: "♙", wn: "♘", wb: "♗", wr: "♖", wq: "♕", wk: "♔", bp: "♟", bn: "♞", bb: "♝", br: "♜", bq: "♛", bk: "♚" };
let position, selected, legalTargets, history, lastMove, engine, engineReady = false;
let gameOver = false;

function initialPosition() {
  const rows = ["rnbqkbnr", "pppppppp", "........", "........", "........", "........", "PPPPPPPP", "RNBQKBNR"];
  return rows.map(row => [...row].map(piece => piece === "." ? null : { type: piece.toLowerCase(), color: piece === piece.toUpperCase() ? "w" : "b" }));
}
function squareName(r, c) { return files[c] + (8 - r); }
function parseSquare(name) { return [8 - Number(name[1]), files.indexOf(name[0])]; }
function inBoard(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function isCenter(r, c) { return (r === 3 || r === 4) && (c === 3 || c === 4); }
function cloneBoard() { return position.map(row => row.map(piece => piece && { ...piece })); }
function pseudoMoves(r, c, board = position) {
  const piece = board[r][c]; if (!piece) return [];
  const moves = [], add = (nr, nc) => { if (!inBoard(nr, nc)) return false; const target = board[nr][nc]; if (!target) { moves.push([nr, nc]); return true; } if (target.color !== piece.color && target.type !== "k") moves.push([nr, nc]); return false; };
  if (piece.type === "p") {
    const dir = piece.color === "w" ? -1 : 1, start = piece.color === "w" ? 6 : 1;
    if (inBoard(r + dir, c) && !board[r + dir][c]) { moves.push([r + dir, c]); if (r === start && !board[r + dir * 2][c]) moves.push([r + dir * 2, c]); }
    for (const dc of [-1, 1]) { const nr = r + dir, nc = c + dc; if (inBoard(nr, nc) && board[nr][nc] && board[nr][nc].color !== piece.color && board[nr][nc].type !== "k") moves.push([nr, nc]); }
  } else if (piece.type === "n") for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) add(r + dr, c + dc);
  else if (piece.type === "k") for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) add(r + dr, c + dc);
  else { const dirs = piece.type === "b" ? [[-1,-1],[-1,1],[1,-1],[1,1]] : piece.type === "r" ? [[-1,0],[1,0],[0,-1],[0,1]] : [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]; for (const [dr, dc] of dirs) { let nr = r + dr, nc = c + dc; while (add(nr, nc)) { nr += dr; nc += dc; } } }
  return moves;
}
function findKing(color, board = position) { for (let r=0;r<8;r++) for (let c=0;c<8;c++) if (board[r][c]?.type === "k" && board[r][c].color === color) return [r,c]; return null; }
function attacked(r, c, byColor, board = position) {
  for (let sr = 0; sr < 8; sr++) for (let sc = 0; sc < 8; sc++) {
    const piece = board[sr][sc];
    if (!piece || piece.color !== byColor) continue;
    if (piece.type === "p") {
      const direction = byColor === "w" ? -1 : 1;
      if (sr + direction === r && Math.abs(sc - c) === 1) return true;
    } else if (pseudoMoves(sr, sc, board).some(([mr, mc]) => mr === r && mc === c)) return true;
  }
  return false;
}
function inCheck(color, board = position) { const king = findKing(color, board); return king ? attacked(...king, color === "w" ? "b" : "w", board) : true; }
function legalMoves(r, c) { const piece = position[r][c]; if (!piece) return []; return pseudoMoves(r, c).filter(([nr,nc]) => { const next = position.map(row => row.map(p => p && {...p})); next[nr][nc] = next[r][c]; next[r][c] = null; return !inCheck(piece.color, next); }); }
function render() {
  boardEl.innerHTML = "";
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const cell = document.createElement("button"); cell.className = `square ${(r+c)%2 ? "dark":"light"}`; cell.setAttribute("role","gridcell"); cell.dataset.square = squareName(r,c);
    if (lastMove?.some(([mr,mc]) => mr === r && mc === c)) cell.classList.add("last-move");
    if (selected?.[0] === r && selected?.[1] === c) cell.classList.add("selected");
    if (legalTargets.some(([mr,mc]) => mr === r && mc === c)) { cell.classList.add(position[r][c] ? "capture" : "legal"); }
    if (c === 0) { const label=document.createElement("span"); label.className="rank-label"; label.textContent=8-r; cell.append(label); }
    if (r === 7) { const label=document.createElement("span"); label.className="file-label"; label.textContent=files[c]; cell.append(label); }
    const piece = position[r][c]; if (piece) { const span=document.createElement("span"); span.className=`piece ${piece.color === "w" ? "white":"black"}`; span.textContent=glyphs[piece.color+piece.type]; cell.append(span); }
    cell.addEventListener("click", () => selectSquare(r,c)); boardEl.append(cell);
  }
}
function selectSquare(r,c) {
  if (gameOver || overlay.classList.contains("hidden") === false) return;
  const piece = position[r][c];
  if (selected && legalTargets.some(([mr,mc]) => mr === r && mc === c)) { makeMove(selected[0], selected[1], r, c); return; }
  if (piece?.color === "w") { selected=[r,c]; legalTargets=legalMoves(r,c); render(); updateMessage(piece); } else if (!piece) { selected=null; legalTargets=[]; render(); }
}
function makeMove(fr,fc,tr,tc, computer = false) {
  const piece = position[fr][fc], captured = position[tr][tc]; position[tr][tc] = piece; position[fr][fc] = null; if (piece.type === "p" && (tr === 0 || tr === 7)) piece.type = "q";
  lastMove=[[fr,fc],[tr,tc]]; history.push({ from:squareName(fr,fc), to:squareName(tr,tc), piece:piece.type, color:piece.color, captured:captured?.type }); selected=null; legalTargets=[]; render(); updateHistory(); updateEvaluation();
  const nextColor = piece.color === "w" ? "b" : "w";
  if (finishIfNeeded(nextColor)) return;
  if (!computer) { teachMove(piece, fr, fc, tr, tc, captured); window.setTimeout(computerTurn, 420); }
}
function teachMove(piece, fr, fc, tr, tc, captured) {
  const move = `${squareName(fr,fc)}${squareName(tr,tc)}`, center = isCenter(tr,tc), opening = history.length <= 2;
  let title = "Good thinking"; let text = center ? "Nice — that move puts influence on the center, where your pieces become more powerful." : opening && ["n","b"].includes(piece.type) ? "Good development. Bringing a minor piece out makes castling and connecting your pieces easier." : captured ? "You spotted a capture. Before every move, ask: what changed, and what can my opponent take next?" : "Keep scanning for checks, captures, and threats before you commit.";
  if (piece.type === "q" && history.length < 6) { title = "A teaching moment"; text = "Your queen is powerful, but developing smaller pieces first usually keeps her safe from being chased."; }
  messageEl.innerHTML = `<div class="message-icon">${title === "Good thinking" ? "✓" : "✦"}</div><div><strong>${title}</strong><p>${text}</p></div>`;
}
function computerTurn() {
  if (gameOver || (history.length > 0 && history[history.length-1].color !== "w")) return;
  overlay.classList.remove("hidden"); engineStatus.innerHTML='<span class="status-dot"></span>Coach is thinking'; setTimeout(() => {
    const moves=[]; for(let r=0;r<8;r++) for(let c=0;c<8;c++) if(position[r][c]?.color==="b") for(const [tr,tc] of legalMovesFor("b",r,c)) moves.push({fr:r,fc:c,tr,tc,score:(position[tr][tc]?values[position[tr][tc].type]:0)+(isCenter(tr,tc)?18:0)+Math.random()*12});
    moves.sort((a,b)=>b.score-a.score); const move=moves[0]; if(move) makeMove(move.fr,move.fc,move.tr,move.tc,true); overlay.classList.add("hidden"); if (!gameOver) { engineStatus.innerHTML='<span class="status-dot"></span>Coach ready'; messageEl.innerHTML='<div class="message-icon">♞</div><div><strong>Your turn</strong><p>What is your opponent threatening? Find a useful move for White.</p></div>'; }
  }, 500);
}
function legalMovesFor(color,r,c) { const piece=position[r][c]; return pseudoMoves(r,c).filter(([nr,nc])=>{const next=cloneBoard();next[nr][nc]=next[r][c];next[r][c]=null;return !inCheck(color,next);}); }
function hasLegalMove(color) { for (let r=0;r<8;r++) for (let c=0;c<8;c++) if (position[r][c]?.color === color && legalMovesFor(color,r,c).length) return true; return false; }
function finishIfNeeded(color) {
  if (hasLegalMove(color)) return false;
  gameOver = true;
  const checked = inCheck(color);
  const title = checked ? (color === "b" ? "Checkmate — you win!" : "Checkmate") : "Draw by stalemate";
  const text = checked ? (color === "b" ? "A strong finish. You created a threat your opponent could not escape." : "The king has no legal escape. Start a new game and look for the pattern that led here.") : "The side to move has no legal move, but its king is safe.";
  messageEl.innerHTML = `<div class="message-icon">${checked ? "♔" : "＝"}</div><div><strong>${title}</strong><p>${text}</p></div>`;
  engineStatus.innerHTML = `<span class="status-dot"></span>${checked ? "Game over" : "Draw"}`;
  return true;
}
function updateHistory(){moveListEl.innerHTML=""; for(let i=0;i<history.length;i+=2){const row=document.createElement("div");row.className="move-row";row.innerHTML=`<span class="move-number">${i/2+1}.</span><span>${history[i].from}–${history[i].to}</span><span>${history[i+1]?history[i+1].from+"–"+history[i+1].to:""}</span>`;moveListEl.append(row)}document.querySelector("#move-count").textContent=history.length}
function updateMessage(piece){messageEl.innerHTML=`<div class="message-icon">◎</div><div><strong>${piece.type==="p"?"A pawn's first step":"A decision point"}</strong><p>${legalTargets.length ? "These highlighted squares are legal. Which move improves your position?" : "That piece has no legal moves right now."}</p></div>`}
function updateEvaluation(){const white=position.flat().reduce((s,p)=>s+(p?.color==="w"?values[p.type]:0),0),black=position.flat().reduce((s,p)=>s+(p?.color==="b"?values[p.type]:0),0);const pct=Math.max(9,Math.min(91,50+(white-black)/40));document.querySelector("#eval-fill").style.width=pct+"%";document.querySelector("#eval-label").textContent=Math.abs(white-black)<40?"Balanced":white>black?"White is ahead":"Black is ahead"}
function hint(){let best=null;for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(position[r][c]?.color==="w")for(const [tr,tc] of legalMoves(r,c)){const score=(position[tr][tc]?values[position[tr][tc].type]:0)+(isCenter(tr,tc)?24:0)+(["n","b"].includes(position[r][c].type)&&history.length<8?15:0);if(!best||score>best.score)best={r,c,tr,tc,score}}if(best){selected=[best.r,best.c];legalTargets=legalMoves(best.r,best.c);render();messageEl.innerHTML=`<div class="message-icon">💡</div><div><strong>Try ${squareName(best.r,best.c)}–${squareName(best.tr,best.tc)}</strong><p>It develops your position and helps contest the center. You still make the final decision.</p></div>`}}
function reset(){position=initialPosition();selected=null;legalTargets=[];history=[];lastMove=null;gameOver=false;render();updateHistory();updateEvaluation();engineStatus.innerHTML='<span class="status-dot"></span>Coach ready';messageEl.innerHTML='<div class="message-icon">✦</div><div><strong>Welcome to your first lesson</strong><p>Try developing a piece toward the center. Click any white piece to begin.</p></div>'}
document.querySelector("#hint-button").addEventListener("click",hint);document.querySelector("#new-game").addEventListener("click",reset);document.addEventListener("keydown",e=>{if(e.key.toLowerCase()==="h")hint()});document.querySelectorAll(".tab").forEach(tab=>tab.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));tab.classList.add("active");document.querySelector("#coach-tab").classList.toggle("hidden",tab.dataset.tab!=="coach");document.querySelector("#moves-tab").classList.toggle("hidden",tab.dataset.tab!=="moves")}));
reset();
