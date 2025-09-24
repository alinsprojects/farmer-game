import React, { useEffect, useMemo, useRef, useState } from "react";

// Visual River Crossing Puzzle — Drag and Drop, Boat Animation, Sounds
// Farmer, Goat, Wolf, Cabbage
// React + Tailwind (single file)

const ITEMS = ["Goat", "Wolf", "Cabbage"] as const;

type Item = typeof ITEMS[number];

type Side = "Left" | "Right";

type State = {
  farmer: Side;
  Goat: Side;
  Wolf: Side;
  Cabbage: Side;
};

const initialState: State = {
  farmer: "Left",
  Goat: "Left",
  Wolf: "Left",
  Cabbage: "Left",
};

function cloneState(s: State): State {
  return { farmer: s.farmer, Goat: s.Goat, Wolf: s.Wolf, Cabbage: s.Cabbage };
}

function opposite(side: Side): Side {
  return side === "Left" ? "Right" : "Left";
}

function checkLoss(s: State): null | string {
  // Loss is evaluated on the bank where farmer is NOT present
  const otherBank = opposite(s.farmer);
  const goatWithCabbage = s.Goat === otherBank && s.Cabbage === otherBank;
  const wolfWithGoat = s.Wolf === otherBank && s.Goat === otherBank;
  if (wolfWithGoat) return "The wolf ate the goat";
  if (goatWithCabbage) return "The goat ate the cabbage";
  return null;
}

function checkWin(s: State): boolean {
  return s.farmer === "Right" && s.Goat === "Right" && s.Wolf === "Right" && s.Cabbage === "Right";
}

// Simple emoji sprites as reliable visual assets
const SPRITES: Record<string, string> = {
  Farmer: "🧑‍🌾",
  Goat: "🐐",
  Wolf: "🐺",
  Cabbage: "🥬",
};

function useBeep() {
  const ctxRef = useRef<AudioContext | null>(null);
  function ensureCtx() {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return ctxRef.current!;
  }
  const play = async (freq = 440, duration = 0.2, type: OscillatorType = "sine", gain = 0.1) => {
    const ctx = ensureCtx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.value = gain;
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
    return new Promise<void>((res) => (osc.onended = () => res()));
  };
  const playFail = async () => {
    await play(200, 0.25, "square", 0.12);
    await play(140, 0.3, "square", 0.12);
  };
  const playWin = async () => {
    // tiny celebration: do-mi-sol-do'
    await play(523.25, 0.18, "triangle", 0.1);
    await play(659.25, 0.18, "triangle", 0.1);
    await play(783.99, 0.18, "triangle", 0.1);
    await play(1046.5, 0.3, "triangle", 0.12);
  };
  return { play, playFail, playWin };
}

export default function RiverCrossingGame() {
  const [state, setState] = useState<State>(initialState);
  const [status, setStatus] = useState<string>("Game started");
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [won, setWon] = useState<boolean>(false);

  // Boat state
  const [boatSide, setBoatSide] = useState<Side>("Left");
  const [boatCarry, setBoatCarry] = useState<Item | null>(null);
  const [isSailing, setIsSailing] = useState<boolean>(false);

  const { playFail, playWin } = useBeep();

  const leftBank = useMemo(() => {
    const out: string[] = [];
    if (state.farmer === "Left") out.push("Farmer");
    ITEMS.forEach((it) => {
      if (state[it] === "Left") out.push(it);
    });
    return out;
  }, [state]);

  const rightBank = useMemo(() => {
    const out: string[] = [];
    if (state.farmer === "Right") out.push("Farmer");
    ITEMS.forEach((it) => {
      if (state[it] === "Right") out.push(it);
    });
    return out;
  }, [state]);

  function reset() {
    setState(initialState);
    setBoatSide("Left");
    setBoatCarry(null);
    setStatus("Game started");
    setGameOver(false);
    setWon(false);
  }

  // Drag and drop handlers
  function onDragStart(e: React.DragEvent, who: Item) {
    if (gameOver || won) return;
    e.dataTransfer.setData("text/plain", who);
  }

  function onDropToBoat(e: React.DragEvent) {
    e.preventDefault();
    if (gameOver || won || isSailing) return;
    if (boatCarry) return; // only one item allowed on boat with farmer
    const item = e.dataTransfer.getData("text/plain") as Item;
    if (!ITEMS.includes(item)) return;
    if (state[item] !== boatSide) return; // must be on same side as boat
    setBoatCarry(item);
  }

  function onDropToBank(e: React.DragEvent, side: Side) {
    e.preventDefault();
    if (gameOver || won || isSailing) return;
    // can drop from boat back to the same side only
    if (side !== boatSide) return;
    if (boatCarry) setBoatCarry(null);
  }

  function allowDrop(e: React.DragEvent) {
    e.preventDefault();
  }

  async function sail() {
    if (gameOver || won || isSailing) return;
    // If carrying, ensure item is on same side already, which drag-drop guarantees
    setIsSailing(true);
    setStatus(boatCarry ? `Farmer sails with ${boatCarry}` : "Farmer sails alone");

    // Animate boat across using CSS translate
    await new Promise((res) => setTimeout(res, 500)); // small delay before move

    const nextSide = opposite(boatSide);
    setBoatSide(nextSide);

    // Finish animation then commit state
    await new Promise((res) => setTimeout(res, 600));

    const next = cloneState(state);
    next.farmer = nextSide;
    if (boatCarry) {
      next[boatCarry] = nextSide;
    }
    const loss = checkLoss(next);
    const didWin = checkWin(next);

    setState(next);
    setBoatCarry(null);
    setIsSailing(false);

    if (loss) {
      setStatus(`Game over: ${loss}`);
      setGameOver(true);
      setWon(false);
      playFail();
      return;
    }
    if (didWin) {
      setStatus("Congratulations, you win");
      setWon(true);
      playWin();
      return;
    }
  }

  const bankBox = (title: string, side: Side, list: string[]) => (
    <div className="relative flex-1 flex flex-col items-center p-4 bg-green-100 rounded-2xl shadow border">
      <h2 className="font-semibold mb-3">{title} {boatSide === side && "🚣"}</h2>
      <div
        onDragOver={allowDrop}
        onDrop={(e) => onDropToBank(e, side)}
        className="w-full min-h-[160px] flex flex-wrap items-start justify-center gap-4 p-3"
      >
        {list.length === 0 && <p className="text-slate-400">Empty</p>}
        {list.map((x) => (
          x === "Farmer" ? (
            <div key={x} className="text-6xl select-none" title={x} aria-label={x}>{SPRITES[x]}</div>
          ) : (
            <div
              key={x}
              draggable={state[x as Item] === side && !gameOver && !won && !isSailing}
              onDragStart={(e) => onDragStart(e, x as Item)}
              className="w-24 h-24 text-6xl flex items-center justify-center bg-white rounded-2xl border shadow select-none"
              title={x}
              aria-label={x}
            >
              {SPRITES[x]}
            </div>
          )
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-300 p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold">River Crossing Game</h1>
          <div className="flex gap-2">
            <button onClick={reset} className="px-4 py-2 rounded-xl shadow bg-white hover:bg-slate-50 border">Reset</button>
            <button onClick={sail} disabled={isSailing || gameOver || won} className="px-4 py-2 rounded-xl shadow bg-amber-500 text-white disabled:opacity-40">Sail</button>
          </div>
        </header>

        <p className="text-sm text-slate-700 mb-3">Drag one item into the boat, then press Sail. The boat carries the farmer and at most one item.</p>

        <div className="grid md:grid-cols-[1fr_auto_1fr] items-stretch gap-4">
          {bankBox("Left Bank", "Left", leftBank)}

          {/* River with animated boat track */}
          <div className="relative w-40 md:w-56 h-[360px] md:h-[420px] bg-blue-400 rounded-3xl shadow-inner overflow-hidden flex items-center justify-center">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 bg-blue-300/60" />

            {/* Boat drop zone */}
            <div
              onDragOver={allowDrop}
              onDrop={onDropToBoat}
              className="absolute left-4 right-4 mx-auto"
              style={{
                transition: "transform 0.6s ease",
                transform: boatSide === "Left" ? "translateX(-25%)" : "translateX(25%)",
                bottom: "25%",
              }}
            >
              <div className="mx-auto w-36 h-24 relative">
                {/* Boat body */}
                <div className="absolute bottom-0 left-0 right-0 h-10 bg-amber-700 rounded-b-3xl shadow" />
                {/* Mast */}
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-1 h-10 bg-stone-700" />
                {/* Sail */}
                <div className="absolute bottom-10 left-1/2 w-16 h-10 bg-white/80 -translate-x-full rounded-sm" />
                {/* Farmer always in boat visually */}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-6xl" title="Farmer" aria-label="Farmer">{SPRITES["Farmer"]}</div>
                {/* Carried item */}
                {boatCarry && (
                  <div className="absolute -top-10 left-[30%] text-6xl" title={boatCarry} aria-label={boatCarry}>
                    {SPRITES[boatCarry]}
                  </div>
                )}
                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-white text-xs">Drop item here</div>
              </div>
            </div>
          </div>

          {bankBox("Right Bank", "Right", rightBank)}
        </div>

        <div className={`mt-4 px-6 py-3 rounded-xl shadow ${won ? "bg-green-200" : gameOver ? "bg-red-200" : "bg-white"}`}>
          <p className="font-medium">{status}</p>
        </div>

        {/* Overlays */}
        {gameOver && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-3xl p-8 shadow-2xl text-center">
              <div className="text-5xl md:text-6xl font-extrabold text-red-600 mb-2">Game Over</div>
              <p className="text-lg md:text-xl mb-6">{status}</p>
              <button onClick={reset} className="px-6 py-3 rounded-xl bg-red-600 text-white">Try Again</button>
            </div>
          </div>
        )}

        {won && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-3xl p-8 shadow-2xl text-center">
              <div className="text-5xl md:text-6xl font-extrabold text-emerald-600 mb-2">You Win</div>
              <p className="text-lg md:text-xl mb-6">All reached the right bank safely</p>
              <button onClick={reset} className="px-6 py-3 rounded-xl bg-emerald-600 text-white">Play Again</button>
            </div>
          </div>
        )}

        <footer className="mt-8 text-xs text-slate-600">
          Tip: Minimal winning sequence is Goat, alone, Wolf, Goat back, Cabbage, alone, Goat.
        </footer>
      </div>
    </div>
  );
}
