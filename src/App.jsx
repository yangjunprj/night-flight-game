import React, { useState, useEffect, useRef, useMemo } from "react";

// ---------- helpers ----------
function normalizePinyin(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[0-9]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}
function pinyinNoSpace(s) {
  return (s || "").replace(/\s+/g, "");
}

let idSeq = 0;
function genId() {
  idSeq += 1;
  return `w_${Date.now().toString(36)}_${idSeq}`;
}

const VKB_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const SAMPLE_DECK = [
  { id: "s1", hanzi: "你好", pinyin: "nǐ hǎo", meaning: "xin chào" },
  { id: "s2", hanzi: "谢谢", pinyin: "xiè xie", meaning: "cảm ơn" },
  { id: "s3", hanzi: "再见", pinyin: "zài jiàn", meaning: "tạm biệt" },
  { id: "s4", hanzi: "老师", pinyin: "lǎo shī", meaning: "giáo viên" },
  { id: "s5", hanzi: "学生", pinyin: "xué shēng", meaning: "học sinh" },
  { id: "s6", hanzi: "朋友", pinyin: "péng yǒu", meaning: "bạn bè" },
  { id: "s7", hanzi: "外语", pinyin: "wài yǔ", meaning: "ngoại ngữ" },
  { id: "s8", hanzi: "中午", pinyin: "zhōng wǔ", meaning: "buổi trưa" },
  { id: "s9", hanzi: "睡觉", pinyin: "shuì jiào", meaning: "ngủ" },
  { id: "s10", hanzi: "喜欢", pinyin: "xǐ huān", meaning: "thích" },
  { id: "s11", hanzi: "家", pinyin: "jiā", meaning: "nhà" },
  { id: "s12", hanzi: "水", pinyin: "shuǐ", meaning: "nước" },
];

export default function App() {
  const [loaded, setLoaded] = useState(false);

  // ---------- "Add to Home Screen" install prompt ----------
  const [installPromptEvent, setInstallPromptEvent] = useState(null); // Android/Chromium: captured beforeinstallprompt
  const [isStandalone, setIsStandalone] = useState(false); // already running as an installed app
  const [showIOSInstall, setShowIOSInstall] = useState(false); // iOS has no programmatic prompt - show manual steps
  const [showInstallUnsupported, setShowInstallUnsupported] = useState(false); // desktop/other browsers

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    setIsStandalone(standalone);

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    const onInstalled = () => {
      setIsStandalone(true);
      setInstallPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstallClick() {
    if (installPromptEvent) {
      // Android / Chromium: this shows the real native "Install app?" system dialog
      installPromptEvent.prompt();
      try {
        await installPromptEvent.userChoice;
      } catch (e) {}
      setInstallPromptEvent(null);
      return;
    }
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) {
      // iOS Safari gives web pages no API to trigger the native dialog -
      // the only option is to show the manual steps ourselves.
      setShowIOSInstall(true);
      return;
    }
    setShowInstallUnsupported(true);
  }
  const [screen, setScreen] = useState("loading");
  const [deck, setDeck] = useState([]);
  const [bestScore, setBestScore] = useState(0);
  const [mode, setMode] = useState("hz"); // 'hz' | 'vn' | 'both'

  // manage form
  const [formHanzi, setFormHanzi] = useState("");
  const [formPinyin, setFormPinyin] = useState("");
  const [formMeaning, setFormMeaning] = useState("");
  const [bulkText, setBulkText] = useState("");

  // game state
  const [fallingWords, setFallingWords] = useState([]);
  const [buffer, setBuffer] = useState("");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [arrows, setArrows] = useState([]);
  const [bursts, setBursts] = useState([]);
  const [shake, setShake] = useState(false);
  const [shakeIds, setShakeIds] = useState(new Set());
  const [planeShoot, setPlaneShoot] = useState(false);
  const [planeAngle, setPlaneAngle] = useState(0);
  const [meteors, setMeteors] = useState([]);
  const [impacts, setImpacts] = useState([]);
  const [gameStats, setGameStats] = useState({ charsTyped: 0, startTime: 0 });
  const [lastCpm, setLastCpm] = useState(0);
  const [summary, setSummary] = useState({ hit: [], missed: [], accuracy: 0, maxCombo: 0, shotCount: 0 });
  const [recapTab, setRecapTab] = useState("missed");

  const inputRef = useRef(null);
  const deckRef = useRef([]);
  const streakRef = useRef(0);
  const screenRef = useRef("menu");
  const fallingWordsRef = useRef([]);
  const bufferRef = useRef("");
  const spawnTimerRef = useRef(0);
  const instanceCounter = useRef(0);
  const arrowCounter = useRef(0);
  const burstCounter = useRef(0);
  const meteorCounter = useRef(0);
  const impactCounter = useRef(0);
  const scoreLevelRef = useRef(1);
  const planeAngleTimeoutRef = useRef(null);
  const hitWordsRef = useRef([]);
  const missedWordsRef = useRef([]);
  const maxStreakRef = useRef(0);
  const usedWordIdsRef = useRef(new Set());
  const sessionDeckRef = useRef([]);
  const livesRef = useRef(3);
  const [victory, setVictory] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [wrongWords, setWrongWords] = useState([]);
  const wrongWordsRef = useRef([]);
  const [practiceMode, setPracticeMode] = useState(false);

  useEffect(() => { wrongWordsRef.current = wrongWords; }, [wrongWords]);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsMobile(mq.matches || window.innerWidth <= 820);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    window.addEventListener("resize", update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => { deckRef.current = deck; }, [deck]);
  useEffect(() => { streakRef.current = streak; }, [streak]);
  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { fallingWordsRef.current = fallingWords; }, [fallingWords]);
  useEffect(() => { livesRef.current = lives; }, [lives]);
  useEffect(() => { scoreLevelRef.current = Math.floor(score / 60) + 1; }, [score]);

  const stars = useMemo(
    () =>
      Array.from({ length: 34 }).map(() => ({
        left: Math.random() * 100,
        top: Math.random() * 62,
        size: 1 + Math.random() * 2,
        delay: Math.random() * 4,
      })),
    []
  );

  const nebulae = useMemo(
    () => [
      { left: "-8%", top: "5%", width: "60%", height: "55%", color: "126,74,189", dur: 24, delay: 0 },
      { right: "-10%", top: "30%", width: "55%", height: "50%", color: "46,167,177", dur: 30, delay: 3 },
      { left: "20%", bottom: "-10%", width: "50%", height: "40%", color: "198,80,120", dur: 27, delay: 6 },
    ],
    []
  );

  const planets = useMemo(
    () => [
      { left: "8%", top: "14%", size: 16, bg: "radial-gradient(circle at 35% 30%, #f0a86e 0%, #a85a3a 70%)", glow: "0 0 14px 3px rgba(240,168,110,0.3)", dur: 52 },
      { left: "18%", top: "60%", size: 8, bg: "radial-gradient(circle at 35% 30%, #9fd6e0 0%, #3d7d8a 70%)", glow: "none", dur: 68 },
    ],
    []
  );

  const shootingStars = useMemo(
    () =>
      Array.from({ length: 4 }).map((_, i) => {
        const dist = 240 + Math.random() * 160;
        let angleDeg = 18 + Math.random() * 48; // downward-right sweep
        if (Math.random() < 0.5) angleDeg = 180 - angleDeg; // mirror to downward-left
        const rad = (angleDeg * Math.PI) / 180;
        return {
          left: 10 + Math.random() * 70,
          top: 5 + Math.random() * 30,
          angleDeg,
          dx: Math.cos(rad) * dist,
          dy: Math.sin(rad) * dist,
          dur: 7 + i * 2.5 + Math.random() * 3,
          delay: i * 2.2 + Math.random() * 2,
        };
      }),
    []
  );

  // ---------- load / save ----------
  useEffect(() => {
    let loadedDeck = [];
    let loadedBest = 0;
    let loadedMode = "hz";
    let loadedWrong = [];
    try {
      const raw = localStorage.getItem("fd_deck");
      if (raw) loadedDeck = JSON.parse(raw);
    } catch (e) {}
    try {
      const raw2 = localStorage.getItem("fd_best_score");
      if (raw2) loadedBest = JSON.parse(raw2);
    } catch (e) {}
    try {
      const raw3 = localStorage.getItem("fd_display_mode");
      if (raw3) loadedMode = JSON.parse(raw3);
    } catch (e) {}
    try {
      const raw4 = localStorage.getItem("fd_wrong_words");
      if (raw4) loadedWrong = JSON.parse(raw4);
    } catch (e) {}
    if (!loadedDeck || loadedDeck.length === 0) loadedDeck = SAMPLE_DECK;
    setDeck(loadedDeck);
    setBestScore(loadedBest || 0);
    setMode(loadedMode === "vn" || loadedMode === "both" ? loadedMode : "hz");
    setWrongWords(Array.isArray(loadedWrong) ? loadedWrong : []);
    setLoaded(true);
    setScreen("menu");
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem("fd_deck", JSON.stringify(deck)); } catch (e) {}
  }, [deck, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem("fd_display_mode", JSON.stringify(mode)); } catch (e) {}
  }, [mode, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem("fd_wrong_words", JSON.stringify(wrongWords)); } catch (e) {}
  }, [wrongWords, loaded]);

  function persistBest(value) {
    try { localStorage.setItem("fd_best_score", JSON.stringify(value)); } catch (e) {}
  }

  // ---------- deck management ----------
  function addSingleWord() {
    const hanzi = formHanzi.trim();
    const pinyin = formPinyin.trim();
    const meaning = formMeaning.trim();
    if (!hanzi || !pinyin) return;
    setDeck((prev) => [...prev, { id: genId(), hanzi, pinyin, meaning }]);
    setFormHanzi(""); setFormPinyin(""); setFormMeaning("");
  }

  function addBulkWords() {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    const newWords = [];
    lines.forEach((line) => {
      const parts = line.split(/[,\t]/).map((p) => p.trim());
      if (parts.length >= 2 && parts[0] && parts[1]) {
        newWords.push({ id: genId(), hanzi: parts[0], pinyin: parts[1], meaning: parts[2] || "" });
      }
    });
    if (newWords.length) setDeck((prev) => [...prev, ...newWords]);
    setBulkText("");
  }

  function deleteWord(id) {
    setDeck((prev) => prev.filter((w) => w.id !== id));
  }

  // ---------- game loop ----------
  useEffect(() => {
    if (screen !== "playing") return;
    spawnTimerRef.current = 1800;
    let rafId;
    let last = performance.now();
    const loop = (now) => {
      const dtSec = Math.min((now - last) / 1000, 0.1); // clamp to avoid big jumps (tab switch, lag spike)
      last = now;
      tick(dtSec);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    if (screen === "playing" && lives <= 0) endGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lives]);

  // if the word(s) matching the current buffer disappear (missed), the buffer no longer means anything - clear it
  useEffect(() => {
    if (screen !== "playing") return;
    if (!bufferRef.current) return;
    const stillValid = fallingWords.some((w) => normalizePinyin(w.pinyin).startsWith(bufferRef.current));
    if (!stillValid) {
      bufferRef.current = "";
      setBuffer("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallingWords, screen]);

  function tick(dtSec) {
    if (screenRef.current !== "playing") return;
    const level = scoreLevelRef.current;
    const moved = fallingWordsRef.current.map((w) => ({ ...w, y: w.y + w.speed * dtSec }));
    const remain = [];
    const missed = [];
    moved.forEach((w) => { if (w.y >= 90) missed.push(w); else remain.push(w); });
    fallingWordsRef.current = remain;
    setFallingWords(remain);
    if (missed.length) {
      missed.forEach((w) => spawnMeteor(w));
    }
    if (remain.length === 0 && sessionDeckRef.current.length > 0 && usedWordIdsRef.current.size >= sessionDeckRef.current.length) {
      endGame();
      return;
    }
    spawnTimerRef.current -= dtSec * 1000;
    if (spawnTimerRef.current <= 0) {
      spawnWord(level);
      spawnTimerRef.current = Math.max(1700, 3400 - level * 80);
    }
  }

  function spawnWord(level) {
    const deckArr = sessionDeckRef.current;
    if (!deckArr.length) return;
    if (fallingWordsRef.current.length >= 4) return;
    const available = deckArr.filter((w) => !usedWordIdsRef.current.has(w.id));
    if (!available.length) return;
    const existing = fallingWordsRef.current.filter((w) => w.y < 30);
    let x = 12 + Math.random() * 76;
    for (let i = 0; i < 5; i++) {
      const clash = existing.some((w) => Math.abs(w.x - x) < 22);
      if (!clash) break;
      x = 12 + Math.random() * 76;
    }
    const word = available[Math.floor(Math.random() * available.length)];
    usedWordIdsRef.current.add(word.id);
    const speed = 2.2 + level * 0.25 + Math.random() * 0.5;
    instanceCounter.current += 1;
    const newWord = {
      instId: instanceCounter.current,
      wordId: word.id,
      hanzi: word.hanzi, pinyin: word.pinyin, meaning: word.meaning,
      x, y: -8, speed,
    };
    setFallingWords((prev) => [...prev, newWord]);
  }

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 300);
  }
  function triggerWordShake(instId) {
    setShakeIds((prev) => new Set(prev).add(instId));
    setTimeout(() => {
      setShakeIds((prev) => { const n = new Set(prev); n.delete(instId); return n; });
    }, 260);
  }

  // ---------- core typing mechanic ----------
  // The buffer is not tied to one fixed word. After each correct letter, we look at every
  // falling word whose pinyin still starts with the buffer - whichever word(s) match get
  // shot at. A letter that breaks every match is wrong: the buffer empties and you start over.
  function handleChange(e) {
    const val = e.target.value;
    e.target.value = "";
    processInput(val);
  }

  function handleVirtualKey(letter) {
    processInput(letter);
  }

  function handleBackspace() {
    bufferRef.current = bufferRef.current.slice(0, -1);
    setBuffer(bufferRef.current);
  }

  function processInput(val) {
    if (!val) return;

    const falling = fallingWordsRef.current;
    let buf = bufferRef.current;
    const completedIds = [];
    const arrowsToFire = [];
    const completedWords = [];
    let scoreGain = 0;
    let streakGain = 0;
    let wrongHappened = false;
    let shakeTargets = [];

    const candidatesFor = (prefix) =>
      falling.filter((w) => !completedIds.includes(w.instId) && normalizePinyin(w.pinyin).startsWith(prefix));
    const mostUrgent = (list) => {
      if (!list.length) return null;
      let best = list[0];
      list.forEach((w) => { if (w.y > best.y) best = w; });
      return best;
    };

    shakeTargets = candidatesFor(buf).map((w) => w.instId);

    for (const raw of val) {
      const ch = raw.toLowerCase();
      if (!/[a-z]/.test(ch)) continue;
      const tentative = buf + ch;
      const cands = candidatesFor(tentative);
      if (cands.length > 0) {
        buf = tentative;
        shakeTargets = cands.map((w) => w.instId);
        const primary = mostUrgent(cands);
        arrowsToFire.push({ x: primary.x, y: primary.y });
        const exact = cands.find((w) => normalizePinyin(w.pinyin) === tentative);
        if (exact) {
          completedIds.push(exact.instId);
          const gain = 10 + Math.min(streakRef.current + streakGain, 20);
          scoreGain += gain;
          streakGain += 1;
          completedWords.push({ ...exact, gain });
          hitWordsRef.current.push({ wordId: exact.wordId, hanzi: exact.hanzi, pinyin: exact.pinyin, meaning: exact.meaning });
          buf = "";
          shakeTargets = [];
        }
      } else {
        wrongHappened = true;
        buf = "";
      }
    }

    bufferRef.current = buf;
    setBuffer(buf);

    arrowsToFire.forEach((a) => fireArrow(a));
    if (arrowsToFire.length) {
      setPlaneShoot(true);
      setTimeout(() => setPlaneShoot(false), 130);
      setGameStats((gs) => ({ ...gs, charsTyped: gs.charsTyped + arrowsToFire.length }));
    }
    completedWords.forEach((w) => addBurst(w, false, w.gain));
    if (completedIds.length) {
      setFallingWords((prev) => prev.filter((w) => !completedIds.includes(w.instId)));
      setScore((s) => s + scoreGain);
      setStreak((s) => s + streakGain);
      maxStreakRef.current = Math.max(maxStreakRef.current, streakRef.current + streakGain);
    }
    if (wrongHappened) {
      setStreak(0);
      shakeTargets.forEach((id) => triggerWordShake(id));
    }
  }

  function fireArrow({ x, y }) {
    const id = ++arrowCounter.current;
    const startX = 50, startY = 96;
    const dx = x - startX, dy = y - startY;
    const rotation = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    setPlaneAngle(rotation);
    if (planeAngleTimeoutRef.current) clearTimeout(planeAngleTimeoutRef.current);
    planeAngleTimeoutRef.current = setTimeout(() => setPlaneAngle(0), 550);
    setArrows((prev) => [...prev, { id, x: startX, y: startY, tx: x, ty: y, rotation, phase: "start" }]);
    setTimeout(() => {
      setArrows((prev) => prev.map((a) => (a.id === id ? { ...a, phase: "flying" } : a)));
    }, 10);
    setTimeout(() => {
      setArrows((prev) => prev.filter((a) => a.id !== id));
    }, 170);
  }

  function spawnMeteor(word) {
    const id = ++meteorCounter.current;
    const targetX = 50, targetY = 96;
    const dx = targetX - word.x, dy = targetY - word.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    const dur = 360 + Math.random() * 160;
    setMeteors((prev) => [...prev, {
      id, x: word.x, y: word.y, tx: targetX, ty: targetY,
      hanzi: word.hanzi, angle, spin: Math.random() < 0.5 ? -1 : 1, dur, phase: "start",
    }]);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMeteors((prev) => prev.map((m) => (m.id === id ? { ...m, phase: "flying" } : m)));
      });
    });
    setTimeout(() => {
      setMeteors((prev) => prev.filter((m) => m.id !== id));
      spawnImpact(targetX, targetY);
      missedWordsRef.current.push({ wordId: word.wordId, hanzi: word.hanzi, pinyin: word.pinyin, meaning: word.meaning });
      setLives((l) => Math.max(0, l - 1));
      setStreak(0);
      triggerShake();
    }, dur + 15);
  }

  function spawnImpact(x, y) {
    const id = ++impactCounter.current;
    setImpacts((prev) => [...prev, { id, x, y }]);
    setTimeout(() => setImpacts((prev) => prev.filter((im) => im.id !== id)), 480);
  }

  function addBurst(word, isMiss, gain) {
    const id = ++burstCounter.current;
    const label = mode === "vn" ? word.hanzi : (word.meaning || word.hanzi);
    setBursts((prev) => [...prev, {
      id, x: word.x, y: isMiss ? 88 : word.y,
      label, gain: gain || 0, isMiss,
    }]);
    setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 1000);
  }

  function startGame(usePractice) {
    const source = usePractice ? wrongWordsRef.current : deck;
    if (source.length < (usePractice ? 1 : 4)) return;
    sessionDeckRef.current = source;
    setPracticeMode(!!usePractice);
    instanceCounter.current = 0;
    spawnTimerRef.current = 1800;
    bufferRef.current = "";
    setFallingWords([]); setArrows([]); setBursts([]); setMeteors([]); setImpacts([]);
    setBuffer("");
    setScore(0); setLives(3); setStreak(0);
    hitWordsRef.current = []; missedWordsRef.current = []; maxStreakRef.current = 0;
    usedWordIdsRef.current = new Set();
    setVictory(false);
    setGameStats({ charsTyped: 0, startTime: Date.now() });
    setScreen("playing");
    if (!isMobile) setTimeout(() => inputRef.current && inputRef.current.focus(), 60);
  }

  function endGame() {
    if (screenRef.current !== "playing") return;
    const elapsedMin = Math.max((Date.now() - gameStats.startTime) / 60000, 1 / 60);
    const cpm = Math.round(gameStats.charsTyped / elapsedMin);
    setLastCpm(cpm);
    setVictory(livesRef.current > 0);
    if (score > bestScore) { setBestScore(score); persistBest(score); }

    const hitMap = new Map();
    hitWordsRef.current.forEach((w) => { if (!hitMap.has(w.hanzi)) hitMap.set(w.hanzi, w); });
    const missedMap = new Map();
    missedWordsRef.current.forEach((w) => {
      if (hitMap.has(w.hanzi)) return; // already counted as hit, don't show twice
      if (!missedMap.has(w.hanzi)) missedMap.set(w.hanzi, w);
    });
    const totalHit = hitWordsRef.current.length;
    const totalMissed = missedWordsRef.current.length;
    const accuracy = totalHit + totalMissed > 0 ? Math.round((totalHit / (totalHit + totalMissed)) * 100) : 100;
    setSummary({ hit: [...hitMap.values()], missed: [...missedMap.values()], accuracy, maxCombo: maxStreakRef.current, shotCount: totalHit });
    setRecapTab(missedMap.size > 0 ? "missed" : "hit");

    const hitIds = new Set(hitWordsRef.current.map((w) => w.wordId).filter(Boolean));
    const newWrong = new Map(wrongWordsRef.current.map((w) => [w.id, w]));
    missedWordsRef.current.forEach((w) => {
      if (!w.wordId || hitIds.has(w.wordId)) return; // fixed later in the same session, don't re-add
      if (!newWrong.has(w.wordId)) newWrong.set(w.wordId, { id: w.wordId, hanzi: w.hanzi, pinyin: w.pinyin, meaning: w.meaning });
    });
    hitIds.forEach((id) => newWrong.delete(id));
    const nextWrong = [...newWrong.values()];
    wrongWordsRef.current = nextWrong;
    setWrongWords(nextWrong);

    setScreen("gameover");
  }

  function exitToMenu() {
    setFallingWords([]); setArrows([]); setBursts([]); setMeteors([]); setImpacts([]);
    setBuffer("");
    setScreen("menu");
  }

  const candidateIds = buffer
    ? new Set(fallingWords.filter((w) => normalizePinyin(w.pinyin).startsWith(buffer)).map((w) => w.instId))
    : new Set();

  return (
    <div className="fd-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Noto+Serif+SC:wght@500;700;900&family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');

        .fd-app {
          --night-top: #0a0620;
          --night-mid: #170a35;
          --night-bottom: #020106;
          --panel: #241a2b;
          --panel-2: #1a1220;
          --border: #4a3a55;
          --gold: #e6bb5c;
          --gold-deep: #b98a2e;
          --teal: #7fd9c4;
          --lantern: #d6524a;
          --lantern-dark: #a83a34;
          --text-soft: #eef0f7;
          font-family: 'Be Vietnam Pro', sans-serif;
          color: var(--text-soft);
          background: var(--night-bottom);
          min-height: 100vh;
          min-height: 100dvh;
          width: 100%;
          box-sizing: border-box;
          padding: clamp(10px, 2.5vw, 22px);
          padding-top: calc(clamp(10px, 2.5vw, 22px) + env(safe-area-inset-top));
          padding-bottom: calc(clamp(10px, 2.5vw, 22px) + env(safe-area-inset-bottom));
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .fd-app * { box-sizing: border-box; }

        .fd-bg-scene {
          position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none;
          background:
            radial-gradient(circle at 50% 30%, rgba(60,30,110,0.22) 0%, transparent 60%),
            linear-gradient(180deg, var(--night-top) 0%, var(--night-mid) 55%, var(--night-bottom) 100%);
        }
        .fd-brand, .fd-panel, .fd-loading { position: relative; z-index: 1; }

        .fd-title { font-family: 'Ma Shan Zheng', cursive; font-size: clamp(34px, 7vw, 52px); color: var(--gold); text-shadow: 0 2px 0 #000, 0 0 24px rgba(230,187,92,0.3); margin: 0 0 14px; letter-spacing: 2px; }
        .fd-brand { text-align: center; margin-bottom: 22px; animation: fd-brand-in 0.7s ease both; }
        .fd-brand-ornament { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 8px; }
        .fd-brand-line { width: 46px; height: 1px; background: linear-gradient(90deg, transparent, var(--gold-deep), transparent); }
        .fd-brand-dot { color: var(--gold-deep); font-size: 8px; opacity: 0.9; }
        .fd-brand-title {
          font-family: 'Ma Shan Zheng', cursive;
          font-size: clamp(52px, 10vw, 78px);
          line-height: 1.1;
          margin: 0;
          letter-spacing: 6px;
          background: linear-gradient(180deg, #fbe9bc 0%, var(--gold) 45%, var(--gold-deep) 100%);
          -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;
          filter: drop-shadow(0 3px 0 rgba(0,0,0,0.55)) drop-shadow(0 0 30px rgba(230,187,92,0.45));
        }
        .fd-brand-tagline { margin-top: 8px; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: #b9aecb; }
        @keyframes fd-brand-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .fd-subtitle { font-weight: 700; font-size: clamp(12px, 1.8vw, 15px); color: #b9aecb; margin-top: -2px; margin-bottom: 14px; text-align: center; }

        .fd-panel {
          position: relative;
          background: linear-gradient(180deg, rgba(30,18,45,0.72) 0%, rgba(16,10,28,0.82) 100%);
          border: 1px solid rgba(160,140,200,0.35);
          border-radius: 16px;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.03) inset, 0 20px 60px rgba(0,0,0,0.6), 0 0 80px rgba(126,74,189,0.25);
          backdrop-filter: blur(9px) saturate(1.1);
          -webkit-backdrop-filter: blur(9px) saturate(1.1);
          padding: clamp(16px, 3vw, 28px);
          width: min(92vw, 520px);
        }
        .fd-menu-stats { display: flex; gap: 10px; margin: 16px 0 20px; }
        .fd-menu-stats--go { display: grid; grid-template-columns: repeat(4, 1fr); }

        .fd-gameover-overlay {
          position: fixed; inset: 0; z-index: 50;
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          background: radial-gradient(circle at 50% 30%, rgba(60,30,110,0.35) 0%, rgba(3,2,10,0.72) 65%, rgba(2,1,8,0.85) 100%);
          backdrop-filter: blur(9px) saturate(1.1);
          -webkit-backdrop-filter: blur(9px) saturate(1.1);
          animation: fd-go-fade 0.25s ease;
        }
        .fd-go-panel {
          position: relative;
          background: linear-gradient(180deg, rgba(30,18,45,0.72) 0%, rgba(16,10,28,0.82) 100%);
          border: 1px solid rgba(160,140,200,0.35);
          border-radius: 16px;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.03) inset, 0 20px 60px rgba(0,0,0,0.6), 0 0 80px rgba(126,74,189,0.25);
          padding: clamp(18px, 3.4vw, 30px);
          width: min(92vw, 520px);
          max-height: 86vh;
          overflow-y: auto;
          scrollbar-width: thin; scrollbar-color: #6a5a7a transparent;
        }
        .fd-go-panel::-webkit-scrollbar { width: 6px; }
        .fd-go-panel::-webkit-scrollbar-track { background: transparent; }
        .fd-go-panel::-webkit-scrollbar-thumb { background: #6a5a7a; border-radius: 6px; }
        @keyframes fd-go-fade { 0% { opacity: 0; } 100% { opacity: 1; } }
        .fd-stat { flex: 1; background: rgba(0,0,0,0.25); border: 1px solid var(--border); border-radius: 8px; padding: 10px 8px; text-align: center; }
        .fd-stat b { display: block; font-size: 22px; color: var(--gold); font-family: 'Noto Serif SC', serif; }
        .fd-stat span { font-size: 11px; color: #b9aecb; }

        .fd-mode-toggle { display: flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin-bottom: 14px; }
        .fd-mode-opt { flex: 1; text-align: center; padding: 10px 4px; font-size: 11px; font-weight: 700; cursor: pointer; background: rgba(0,0,0,0.2); color: #b9aecb; transition: background 0.15s, color 0.15s; line-height: 1.3; }
        .fd-mode-opt--on { background: linear-gradient(180deg, var(--gold) 0%, var(--gold-deep) 100%); color: #241a29; }

        .fd-btn { display: block; width: 100%; text-align: center; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 700; font-size: 15px; padding: 13px 16px; border-radius: 8px; border: none; cursor: pointer; margin-top: 12px; transition: transform 0.12s ease, filter 0.12s ease; }
        .fd-btn:active { transform: scale(0.97); }
        .fd-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .fd-btn--primary { background: linear-gradient(180deg, var(--gold) 0%, var(--gold-deep) 100%); color: #241a29; box-shadow: 0 4px 0 #8a641d, 0 6px 14px rgba(230,187,92,0.25); }
        .fd-btn--primary:hover:not(:disabled) { filter: brightness(1.06); }
        .fd-btn--secondary { background: rgba(127,217,196,0.08); color: var(--teal); border: 1px solid #3d5850; }
        .fd-btn--secondary:hover { background: rgba(127,217,196,0.16); }
        .fd-btn--wrong { background: rgba(214,82,74,0.1); color: #ef8b83; border: 1px solid rgba(214,82,74,0.45); }
        .fd-btn--wrong:hover { background: rgba(214,82,74,0.18); }
        .fd-btn--ghost { background: transparent; color: #b9aecb; border: 1px solid var(--border); }
        .fd-hint { font-size: 12px; color: #b9aecb; text-align: center; margin-top: 10px; line-height: 1.55; }

        .fd-form-row { display: flex; gap: 8px; margin-bottom: 8px; }
        .fd-input, .fd-textarea { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 6px; color: var(--text-soft); padding: 9px 10px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 14px; outline: none; }
        .fd-input:focus, .fd-textarea:focus { border-color: var(--gold); }
        .fd-textarea { resize: vertical; min-height: 64px; font-family: monospace; font-size: 12px; }
        .fd-section-label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--gold); margin: 18px 0 8px; font-weight: 700; }
        .fd-deck-list {
          max-height: 220px; overflow-y: auto; margin-top: 6px; border-top: 1px solid #3a2c47;
          scrollbar-width: thin; scrollbar-color: var(--gold-deep) rgba(0,0,0,0.25);
        }
        .fd-deck-list::-webkit-scrollbar { width: 9px; }
        .fd-deck-list::-webkit-scrollbar-track { background: rgba(0,0,0,0.25); border-radius: 8px; margin: 4px 0; }
        .fd-deck-list::-webkit-scrollbar-thumb { background: linear-gradient(180deg, var(--gold) 0%, var(--gold-deep) 100%); border-radius: 8px; }
        .fd-deck-list::-webkit-scrollbar-thumb:hover { filter: brightness(1.12); }
        .fd-deck-row { display: flex; align-items: center; gap: 10px; padding: 8px 4px; border-bottom: 1px solid #2c2036; }
        .fd-deck-row .fd-hz { font-family: 'Noto Serif SC', serif; font-size: 18px; min-width: 46px; }
        .fd-deck-row .fd-py { color: var(--gold); font-size: 12.5px; flex: 1; }
        .fd-deck-row .fd-mn { color: #b9aecb; font-size: 12px; flex: 1; }
        .fd-del { background: none; border: none; color: #c97a72; cursor: pointer; font-size: 16px; padding: 2px 6px; border-radius: 4px; }
        .fd-del:hover { background: rgba(214,82,74,0.2); }
        .fd-empty { color: #b9aecb; font-size: 13px; text-align: center; padding: 18px 0; }

        /* ---- game screen: true fullscreen ---- */
        .fd-game-wrap { position: fixed; inset: 0; width: 100vw; height: 100vh; height: 100dvh; z-index: 5; display: flex; flex-direction: column; }
        .fd-hud { position: absolute; top: 0; left: 0; right: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; padding-top: calc(18px + env(safe-area-inset-top)); padding-left: calc(22px + env(safe-area-inset-left)); padding-right: calc(22px + env(safe-area-inset-right)); pointer-events: none; }
        .fd-hud > * { pointer-events: auto; }
        .fd-hud-pill { display: flex; align-items: center; gap: 7px; background: rgba(8,5,16,0.55); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 7px 14px; font-size: 14px; font-weight: 800; color: var(--gold); backdrop-filter: blur(4px); }
        .fd-hud-streak { color: var(--teal); font-size: 12.5px; font-weight: 700; }
        .fd-hud-right { display: flex; flex-direction: row; align-items: center; gap: 8px; }
        .fd-lives { display: flex; gap: 4px; background: rgba(8,5,16,0.55); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 7px 12px; font-size: 14px; backdrop-filter: blur(4px); }
        .fd-life--lost { opacity: 0.2; filter: grayscale(1); }
        .fd-exit { width: 34px; height: 34px; padding: 0; display: flex; align-items: center; justify-content: center; background: rgba(8,5,16,0.55); border: 1px solid rgba(255,255,255,0.12); color: #cfc6dc; border-radius: 50%; font-size: 14px; cursor: pointer; backdrop-filter: blur(4px); }
        .fd-exit:hover { border-color: var(--lantern); color: var(--lantern); }

        .fd-arena { position: relative; flex: 1 1 auto; min-height: 0; width: 100%; overflow: hidden; background: transparent; }

        .fd-vkb { flex: 0 0 auto; display: flex; flex-direction: column; gap: 6px; padding: 8px 6px calc(8px + env(safe-area-inset-bottom, 0px)); background: linear-gradient(180deg, #150f22 0%, #0a0616 100%); border-top: 1px solid rgba(255,255,255,0.08); z-index: 20; }
        .fd-vkb-row { display: flex; justify-content: center; gap: 5px; }
        .fd-vkb-spacer { flex: 0 0 auto; width: 18px; }
        .fd-vkb-key {
          flex: 1 1 0; max-width: 38px; height: 42px; min-width: 0;
          border-radius: 8px; border: none;
          background: linear-gradient(180deg, #3c3050 0%, #241a2e 100%);
          color: var(--text-soft); font-family: 'Be Vietnam Pro', sans-serif; font-size: 14px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 0 rgba(0,0,0,0.4);
          -webkit-tap-highlight-color: transparent; user-select: none; touch-action: manipulation;
        }
        .fd-vkb-key:active { background: linear-gradient(180deg, var(--gold) 0%, var(--gold-deep) 100%); color: #241a29; transform: translateY(1px); box-shadow: none; }
        .fd-vkb-key--wide { flex: 0 0 auto; width: 44px; max-width: 44px; font-size: 16px; }
        .fd-arena--shake { animation: fd-shake 0.3s ease; }

        .fd-star { position: absolute; background: #fff; border-radius: 50%; animation: fd-twinkle 3.2s ease-in-out infinite; }
        .fd-nebula { position: absolute; border-radius: 50%; filter: blur(26px); mix-blend-mode: screen; pointer-events: none; animation: fd-nebula-drift ease-in-out infinite alternate; }
        .fd-planet { position: absolute; border-radius: 50%; pointer-events: none; animation: fd-planet-spin linear infinite; }
        .fd-planet-spot { position: absolute; top: 14%; left: 58%; width: 30%; height: 30%; border-radius: 50%; background: rgba(0,0,0,0.28); }
        .fd-aurora { position: absolute; inset: -25%; pointer-events: none; mix-blend-mode: screen; opacity: 0.5; filter: blur(70px) saturate(1.3); animation: fd-aurora-shift 30s linear infinite; background: conic-gradient(from 0deg at 50% 30%, rgba(126,74,189,0.3), rgba(46,167,177,0.25), rgba(198,80,120,0.25), rgba(230,187,92,0.15), rgba(126,74,189,0.3)); }
        .fd-bg-scene--lite .fd-aurora, .fd-bg-scene--lite .fd-nebula { animation-play-state: paused; }
        .fd-bg-scene--lite .fd-aurora { filter: blur(35px) saturate(1.2); opacity: 0.35; }
        .fd-bg-scene--lite .fd-nebula { filter: blur(14px); }
        .fd-shooting-star { position: absolute; width: 0; height: 0; opacity: 0; animation: fd-shoot linear infinite; }
        .fd-shooting-star-inner { position: absolute; width: 130px; height: 0; transform-origin: right center; }
        .fd-shooting-star-inner::before {
          content: ""; position: absolute; right: 4px; top: 0; width: 100%; height: 1.5px;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 35%, rgba(255,255,255,0.75) 85%, rgba(255,255,255,0.95) 100%);
          border-radius: 3px; filter: blur(0.4px);
        }
        .fd-shooting-star-inner::after {
          content: ""; position: absolute; right: 0; top: 50%; width: 4px; height: 4px; margin-top: -2px; border-radius: 50%;
          background: #fff; box-shadow: 0 0 10px 3px rgba(255,255,255,0.9), 0 0 22px 7px rgba(190,210,255,0.45);
        }
        .fd-moon { position: absolute; top: 6%; right: 8%; width: clamp(60px,12vw,110px); height: clamp(60px,12vw,110px); border-radius: 50%; background: radial-gradient(circle at 38% 35%, #fbfcff 0%, #dfe3f2 55%, #c7cce0 100%); box-shadow: 0 0 60px 22px rgba(232,236,250,0.18), 0 0 120px 50px rgba(232,236,250,0.08); }
        .fd-moon i { position: absolute; border-radius: 50%; background: rgba(150,155,180,0.35); }

        .fd-mountains { display: none; }
        .fd-house { display: none; }
        .fd-lanterns { display: none; }

        .fd-meteor { position: absolute; transform: translate(-50%, -50%); pointer-events: none; z-index: 6; }
        .fd-meteor-aim { width: 22px; height: 22px; position: relative; }
        .fd-meteor-spin { width: 100%; height: 100%; position: relative; animation: fd-meteor-tumble 0.5s linear infinite; }
        .fd-meteor-flame { position: absolute; left: 50%; top: 46%; width: 10px; height: 22px; background: linear-gradient(0deg, rgba(255,200,90,0.95) 0%, rgba(255,120,50,0.55) 55%, rgba(255,80,40,0) 100%); border-radius: 40% 40% 50% 50%; transform: translateX(-50%); filter: blur(1.5px); }
        .fd-meteor-rock { position: relative; width: 100%; height: 100%; display: block; }

        .fd-strike-line { position: absolute; left: 0; right: 0; top: 90%; border-top: 1px dashed rgba(230,187,92,0.2); }

        .fd-word { position: absolute; transform: translate(-50%, -50%); will-change: top, left; text-align: center; pointer-events: none; max-width: 140px; }
        .fd-word-hz { font-family: 'Noto Serif SC', serif; font-weight: 700; font-size: clamp(19px, 4.2vw, 27px); color: var(--text-soft); text-shadow: 0 0 14px rgba(238,240,247,0.35), 0 2px 4px rgba(0,0,0,0.6); white-space: nowrap; }
        .fd-word-vn { font-family: 'Be Vietnam Pro', sans-serif; font-weight: 700; font-size: clamp(14px, 3vw, 18px); color: var(--text-soft); text-shadow: 0 0 10px rgba(238,240,247,0.3), 0 2px 4px rgba(0,0,0,0.6); line-height: 1.2; white-space: nowrap; }
        .fd-word--target .fd-word-hz, .fd-word--target .fd-word-vn { color: var(--gold); text-shadow: 0 0 18px rgba(230,187,92,0.75), 0 2px 4px rgba(0,0,0,0.6); }
        .fd-word-py { font-family: 'Be Vietnam Pro', sans-serif; font-weight: 700; font-size: clamp(12px, 2.4vw, 15px); color: var(--teal); text-shadow: 0 0 8px rgba(127,217,196,0.5), 0 2px 4px rgba(0,0,0,0.6); margin-top: 2px; white-space: nowrap; }
        .fd-word--target .fd-word-py { color: var(--gold); }
        .fd-word--shake { animation: fd-word-shake 0.26s ease; }
        .fd-word-hint { font-size: 13px; color: var(--teal); font-weight: 700; letter-spacing: 0.5px; margin-bottom: 2px; min-height: 15px; text-shadow: 0 0 8px rgba(127,217,196,0.6); }

        .fd-arrow { position: absolute; width: 20px; height: 20px; transform: translate(-50%, -50%); transition: left 0.16s linear, top 0.16s linear; pointer-events: none; z-index: 5; }

        .fd-burst { position: absolute; transform: translate(-50%, -50%); text-align: center; pointer-events: none; }
        .fd-burst--ok { animation: fd-burst-success 1s ease-out forwards; }
        .fd-burst--miss { animation: fd-burst-miss 0.8s ease-out forwards; color: var(--lantern); }
        .fd-burst-hz { font-family: 'Noto Serif SC', serif; font-size: 26px; font-weight: 900; color: var(--gold); }
        .fd-burst-mn { font-size: 12px; color: var(--teal); margin-top: 2px; white-space: nowrap; }
        .fd-burst--miss .fd-burst-hz { color: var(--lantern); }
        .fd-burst--miss .fd-burst-mn { color: var(--lantern); }
        .fd-impact { position: absolute; width: 40px; height: 40px; transform: translate(-50%,-50%); border-radius: 50%; background: radial-gradient(circle, rgba(255,215,130,0.95) 0%, rgba(255,140,60,0.7) 35%, rgba(255,80,40,0) 70%); animation: fd-impact-pop 0.48s ease-out forwards; pointer-events: none; z-index: 7; }

        .fd-plane-pos { position: absolute; left: 50%; bottom: 1.5%; transform: translateX(-50%); z-index: 4; }
        .fd-plane-bob { animation: fd-plane-idle 2.4s ease-in-out infinite; filter: drop-shadow(0 6px 6px rgba(0,0,0,0.55)); }
        .fd-plane { width: clamp(28px, 6vw, 38px); height: clamp(32px, 6.9vw, 43px); transform-origin: 50% 58%; transition: transform 0.16s ease-out; }
        .fd-plane svg { display: block; width: 100%; height: 100%; }
        .fd-plane--shoot svg { filter: brightness(1.35) saturate(1.2); }

        .fd-type-bar { position: absolute; left: 0; bottom: 0; width: 1px; height: 1px; overflow: hidden; opacity: 0; pointer-events: none; }
        .fd-pinyin-input { width: 1px; height: 1px; border: none; background: transparent; color: transparent; padding: 0; outline: none; }

        .fd-go-title { font-family: 'Ma Shan Zheng', cursive; font-size: 42px; color: var(--gold); text-align: center; margin: 0 0 6px; }
        .fd-go-sub { text-align: center; color: #b9aecb; font-size: 13px; margin-bottom: 18px; }
        .fd-go-score { text-align: center; font-family: 'Noto Serif SC', serif; font-size: 46px; color: var(--gold); margin-bottom: 4px; }
        .fd-go-newbest { text-align: center; color: var(--teal); font-weight: 700; font-size: 13px; margin-bottom: 14px; }

        .fd-recap { margin: 4px 0 14px; }
        .fd-recap-tabs { display: flex; gap: 8px; padding: 10px 0; border-top: 1px solid var(--border); }
        .fd-recap-tab { flex: 1; font-family: 'Be Vietnam Pro', sans-serif; font-size: 12.5px; font-weight: 700; color: #9a8fae; background: rgba(0,0,0,0.22); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s; }
        .fd-recap-tab:hover { color: #d8d0e2; }
        .fd-recap-tab--on { color: var(--text-soft); background: rgba(255,255,255,0.05); border-color: #6a5a7a; }
        .fd-recap-count { font-size: 12px; border-radius: 8px; padding: 1px 7px; }
        .fd-recap-count--miss { background: rgba(214,82,74,0.18); color: var(--lantern); }
        .fd-recap-count--hit { background: rgba(127,217,196,0.18); color: var(--teal); }
        .fd-recap-list {
          max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;
          margin-top: 10px; padding-right: 6px;
          scrollbar-width: thin; scrollbar-color: #6a5a7a transparent;
        }
        .fd-recap-list::-webkit-scrollbar { width: 6px; }
        .fd-recap-list::-webkit-scrollbar-track { background: transparent; }
        .fd-recap-list::-webkit-scrollbar-thumb { background: #6a5a7a; border-radius: 6px; }
        .fd-recap-list::-webkit-scrollbar-thumb:hover { background: var(--teal); }
        .fd-recap-row { background: rgba(0,0,0,0.28); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; border-left: 3px solid var(--lantern); }
        .fd-recap-row--hit { border-left-color: var(--teal); }
        .fd-recap-top { display: flex; align-items: baseline; gap: 8px; }
        .fd-recap-hz { font-family: 'Noto Serif SC', serif; font-size: 17px; font-weight: 900; color: var(--text-soft); }
        .fd-recap-py { font-size: 12px; color: #b9aecb; }
        .fd-recap-mn { font-size: 13px; color: #cfc6dc; margin-top: 3px; }
        .fd-loading { color: #b9aecb; font-size: 14px; margin-top: 40px; }

        @keyframes fd-twinkle { 0%,100% { opacity: 0.1; transform: scale(0.7); } 50% { opacity: 1; transform: scale(1.4); } }
        @keyframes fd-aurora-shift { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fd-nebula-drift { from { transform: translate(0, 0) scale(1); } to { transform: translate(4%, -3%) scale(1.08); } }
        @keyframes fd-planet-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fd-shoot {
          0%, 95.5% { opacity: 0; transform: translate(0, 0); }
          96% { opacity: 1; }
          99% { transform: translate(var(--dx, 260px), var(--dy, 150px)); opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes fd-plane-idle { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes fd-meteor-tumble { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes fd-impact-pop { 0% { transform: translate(-50%,-50%) scale(0.3); opacity: 1; } 100% { transform: translate(-50%,-50%) scale(1.8); opacity: 0; } }
        @keyframes fd-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-7px); } 40% { transform: translateX(7px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(5px); } }
        @keyframes fd-word-shake { 0%,100% { transform: translate(-50%,-50%) translateX(0); } 25% { transform: translate(-50%,-50%) translateX(-6px); } 50% { transform: translate(-50%,-50%) translateX(6px); } 75% { transform: translate(-50%,-50%) translateX(-4px); } }
        @keyframes fd-burst-success { 0% { transform: translate(-50%,-50%) scale(0.6); opacity: 0; } 30% { transform: translate(-50%,-50%) scale(1.2); opacity: 1; } 100% { transform: translate(-50%,-120%) scale(0.9); opacity: 0; } }
        @keyframes fd-burst-miss { 0% { transform: translate(-50%,-50%) scale(1); opacity: 1; } 100% { transform: translate(-50%,-50%) scale(1.4); opacity: 0; } }

        /* ---- persistent "install app" button ---- */
        .fd-install-fab {
          position: fixed; left: 50%; bottom: calc(14px + env(safe-area-inset-bottom));
          transform: translateX(-50%);
          z-index: 50;
          display: flex; align-items: center; gap: 8px;
          background: linear-gradient(180deg, var(--gold) 0%, var(--gold-deep) 100%);
          color: #241a29; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 800; font-size: 12.5px;
          border: none; border-radius: 999px; padding: 10px 16px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.15) inset;
          cursor: pointer; white-space: nowrap;
          animation: fd-install-fab-in 0.4s ease both;
        }
        .fd-install-fab-icon { font-size: 15px; }
        @keyframes fd-install-fab-in { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

        .fd-modal-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(2,1,6,0.72); backdrop-filter: blur(3px);
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .fd-modal {
          position: relative; width: 100%; max-width: 380px;
          background: linear-gradient(180deg, #1c1330 0%, #0e0a1c 100%);
          border: 1px solid var(--border); border-radius: 16px;
          padding: 26px 20px 20px; box-shadow: 0 12px 40px rgba(0,0,0,0.6);
        }
        .fd-modal-close {
          position: absolute; top: 10px; right: 10px; width: 28px; height: 28px;
          border-radius: 50%; border: 1px solid var(--border); background: rgba(255,255,255,0.05);
          color: #cfc6dc; font-size: 16px; line-height: 1; cursor: pointer;
        }
        .fd-modal-title { font-family: 'Ma Shan Zheng', cursive; font-size: 22px; color: var(--gold); margin-bottom: 10px; }
        .fd-modal-note { font-size: 13px; color: #b9aecb; line-height: 1.5; margin-bottom: 14px; }
        .fd-modal-steps { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 12px; }
        .fd-modal-steps li { font-size: 13.5px; line-height: 1.5; color: var(--text-soft); }
        .fd-modal-step-icon { margin-right: 4px; }
      `}</style>

      <div className={`fd-bg-scene ${isMobile && screen === "playing" ? "fd-bg-scene--lite" : ""}`}>
        <div className="fd-aurora" />
        {nebulae.map((n, i) => (
          <div key={i} className="fd-nebula" style={{
            left: n.left, right: n.right, top: n.top, bottom: n.bottom, width: n.width, height: n.height,
            background: `radial-gradient(circle, rgba(${n.color},0.5) 0%, rgba(${n.color},0) 70%)`,
            animationDuration: `${n.dur}s`, animationDelay: `${n.delay}s`,
          }} />
        ))}
        {planets.map((p, i) => (
          <div key={i} className="fd-planet" style={{
            left: p.left, top: p.top, width: p.size, height: p.size,
            background: p.bg, boxShadow: p.glow, animationDuration: `${p.dur}s`,
          }}>
            <span className="fd-planet-spot" />
          </div>
        ))}
        {stars.map((s, i) => (
          <div key={i} className="fd-star" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }} />
        ))}
        {shootingStars.map((sh, i) => (
          <div key={i} className="fd-shooting-star" style={{
            left: `${sh.left}%`, top: `${sh.top}%`,
            "--dx": `${sh.dx}px`, "--dy": `${sh.dy}px`,
            animationDuration: `${sh.dur}s`, animationDelay: `${sh.delay}s`,
          }}>
            <div className="fd-shooting-star-inner" style={{ transform: `rotate(${sh.angleDeg}deg)` }} />
          </div>
        ))}
        <div className="fd-moon"><i style={{ width: 10, height: 10, top: 18, left: 22 }} /><i style={{ width: 6, height: 6, top: 34, left: 40 }} /></div>
      </div>

      {screen === "loading" && <div className="fd-loading">Đang tải từ vựng...</div>}

      {screen === "menu" && (
        <div className="fd-brand">
          <div className="fd-brand-ornament">
            <span className="fd-brand-line" />
            <span className="fd-brand-dot">◆</span>
            <span className="fd-brand-line" />
          </div>
          <h1 className="fd-brand-title">陽俊</h1>
          <div className="fd-brand-tagline">Học chữ Hán qua trò chơi bắn chữ</div>
        </div>
      )}

      {screen === "menu" && (
        <div className="fd-panel">
          <div className="fd-menu-stats">
            <div className="fd-stat"><b>{deck.length}</b><span>từ đã lưu</span></div>
            <div className="fd-stat"><b>{bestScore}</b><span>điểm cao nhất</span></div>
          </div>

          <div className="fd-mode-toggle">
            <div className={`fd-mode-opt ${mode === "hz" ? "fd-mode-opt--on" : ""}`} onClick={() => setMode("hz")}>
              汉字 → gõ pinyin
            </div>
            <div className={`fd-mode-opt ${mode === "both" ? "fd-mode-opt--on" : ""}`} onClick={() => setMode("both")}>
              汉字 + pinyin
            </div>
            <div className={`fd-mode-opt ${mode === "vn" ? "fd-mode-opt--on" : ""}`} onClick={() => setMode("vn")}>
              Nghĩa Việt → pinyin
            </div>
          </div>

          <button className="fd-btn fd-btn--primary" disabled={deck.length < 4} onClick={() => startGame(false)}>
            弓 Bắt đầu chơi
          </button>
          {wrongWords.length > 0 && (
            <button className="fd-btn fd-btn--wrong" onClick={() => startGame(true)}>
              ✕ Luyện lại từ đã sai ({wrongWords.length})
            </button>
          )}
          <button className="fd-btn fd-btn--secondary" onClick={() => setScreen("manage")}>
            Quản lý kho từ vựng
          </button>
          {deck.length < 4 && <div className="fd-hint">Cần ít nhất 4 từ trong kho để chơi được.</div>}
          <div className="fd-hint">
            {mode === "vn" && "Chữ rơi xuống sẽ hiện nghĩa tiếng Việt. Gõ pinyin của từ đó (không dấu) để bắn."}
            {mode === "both" && "Chữ rơi xuống hiện sẵn cả chữ Hán lẫn pinyin — gõ theo pinyin (không dấu) để bắn, phù hợp lúc mới học."}
            {mode === "hz" && "Chữ Hán rơi xuống, gõ pinyin (không dấu) của nó để bắn."}
            {" "}Gõ trúng chữ cái nào khớp với pinyin của một chữ đang rơi thì mũi tên sẽ bay
            vào đúng chữ đó, không quan trọng chữ nào xuất hiện trước — gõ sai là mất hết,
            phải gõ lại từ đầu. Để chữ rơi chạm đáy là mất 1 mạng. Mỗi từ trong kho chỉ xuất
            hiện 1 lần trong một ván — hết từ là hoàn thành ván chơi. Từ nào bị lỡ sẽ tự
            vào danh sách "từ đã sai"; gõ trúng lại (kể cả lúc luyện tập) sẽ xoá nó khỏi
            danh sách đó.
          </div>
        </div>
      )}

      {screen === "manage" && (
        <div className="fd-panel">
          <div className="fd-section-label">Thêm một từ</div>
          <div className="fd-form-row">
            <input className="fd-input" placeholder="汉字" value={formHanzi}
              onChange={(e) => setFormHanzi(e.target.value)} style={{ maxWidth: 90 }} />
            <input className="fd-input" placeholder="pinyin" value={formPinyin}
              onChange={(e) => setFormPinyin(e.target.value)} />
          </div>
          <div className="fd-form-row">
            <input className="fd-input" placeholder="nghĩa (nên điền để dùng được mọi chế độ)" value={formMeaning}
              onChange={(e) => setFormMeaning(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSingleWord()} />
          </div>
          <button className="fd-btn fd-btn--secondary" onClick={addSingleWord} disabled={!formHanzi.trim() || !formPinyin.trim()}>
            + Thêm vào kho
          </button>

          <div className="fd-section-label">Thêm hàng loạt (mỗi dòng: 汉字, pinyin, nghĩa)</div>
          <textarea className="fd-textarea" placeholder={"你好, nǐ hǎo, xin chào\n谢谢, xiè xie, cảm ơn"}
            value={bulkText} onChange={(e) => setBulkText(e.target.value)} />
          <button className="fd-btn fd-btn--secondary" onClick={addBulkWords} disabled={!bulkText.trim()}>
            + Thêm danh sách
          </button>

          <div className="fd-section-label">Kho từ vựng ({deck.length})</div>
          <div className="fd-deck-list">
            {deck.length === 0 && <div className="fd-empty">Chưa có từ nào.</div>}
            {deck.map((w) => (
              <div className="fd-deck-row" key={w.id}>
                <span className="fd-hz">{w.hanzi}</span>
                <span className="fd-py">{w.pinyin}</span>
                <span className="fd-mn">{w.meaning}</span>
                <button className="fd-del" onClick={() => deleteWord(w.id)}>×</button>
              </div>
            ))}
          </div>

          <button className="fd-btn fd-btn--ghost" onClick={() => setScreen("menu")}>← Về menu</button>
        </div>
      )}

      {(screen === "playing" || screen === "gameover") && (
        <div className="fd-game-wrap">
          <div className="fd-hud">
            <div className="fd-hud-pill">
              <span>🏆</span><span>{score}</span>
              {streak > 1 && <span className="fd-hud-streak">×{streak}</span>}
            </div>
            <div className="fd-hud-right">
              <div className="fd-lives">
                {[0, 1, 2].map((i) => <span key={i} className={i < lives ? "" : "fd-life--lost"}>🚀</span>)}
              </div>
              <button className="fd-exit" onClick={exitToMenu} aria-label="Thoát">✕</button>
            </div>
          </div>

          <div className={`fd-arena ${shake ? "fd-arena--shake" : ""}`} onClick={() => !isMobile && screen === "playing" && inputRef.current && inputRef.current.focus()}>
            <div className="fd-strike-line" />

            {fallingWords.map((w) => {
              const isTarget = candidateIds.has(w.instId);
              const hint = isTarget ? pinyinNoSpace(w.pinyin).slice(0, buffer.length) : "";
              const mainLabel = mode === "vn" ? (w.meaning || w.hanzi) : w.hanzi;
              const mainClass = mode === "vn" ? "fd-word-vn" : "fd-word-hz";
              return (
                <div key={w.instId}
                  className={`fd-word ${isTarget ? "fd-word--target" : ""} ${shakeIds.has(w.instId) ? "fd-word--shake" : ""}`}
                  style={{ left: `${w.x}%`, top: `${w.y}%` }}>
                  {isTarget && <div className="fd-word-hint">{hint}</div>}
                  <div className={mainClass}>{mainLabel}</div>
                  {mode === "both" && <div className="fd-word-py">{w.pinyin}</div>}
                </div>
              );
            })}

            {arrows.map((a) => (
              <div key={a.id} className="fd-arrow"
                style={{ left: `${a.phase === "start" ? a.x : a.tx}%`, top: `${a.phase === "start" ? a.y : a.ty}%`, transform: `translate(-50%, -50%) rotate(${a.rotation}deg)` }}>
                <svg viewBox="0 0 20 20" width="20" height="20">
                  <polygon points="10,0 13,7 10,5.5 7,7" fill="#e6bb5c" />
                  <rect x="9.2" y="6" width="1.6" height="10" fill="#f0dcae" />
                  <polygon points="10,16 6,19 10,17.5 14,19" fill="#b98a2e" />
                </svg>
              </div>
            ))}

            {bursts.map((b) => (
              <div key={b.id} className={`fd-burst ${b.isMiss ? "fd-burst--miss" : "fd-burst--ok"}`} style={{ left: `${b.x}%`, top: `${b.y}%` }}>
                <div className="fd-burst-hz">{b.isMiss ? b.hanzi : b.label}</div>
                <div className="fd-burst-mn">{b.isMiss ? "bỏ lỡ" : `+${b.gain}`}</div>
              </div>
            ))}

            {meteors.map((m) => (
              <div key={m.id} className="fd-meteor"
                style={{ left: `${m.phase === "start" ? m.x : m.tx}%`, top: `${m.phase === "start" ? m.y : m.ty}%`, transition: `left ${m.dur}ms linear, top ${m.dur}ms linear` }}>
                <div className="fd-meteor-aim" style={{ transform: `rotate(${m.angle}deg)` }}>
                  <div className="fd-meteor-flame" />
                  <div className="fd-meteor-spin" style={{ animationDirection: m.spin < 0 ? "reverse" : "normal" }}>
                    <svg className="fd-meteor-rock" viewBox="0 0 24 24">
                      <polygon points="12,2 18,7 20,14 15,21 8,20 4,13 6,6" fill="#8a7a6a" stroke="#4a3f38" strokeWidth="1" strokeLinejoin="round" />
                      <circle cx="10" cy="10" r="1.6" fill="#5c5049" />
                      <circle cx="15" cy="14" r="1.1" fill="#5c5049" />
                      <circle cx="11" cy="16" r="0.9" fill="#6b5f56" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}

            {impacts.map((im) => (
              <div key={im.id} className="fd-impact" style={{ left: `${im.x}%`, top: `${im.y}%` }} />
            ))}

            <div className="fd-plane-pos">
              <div className="fd-plane-bob">
                <div className={`fd-plane ${planeShoot ? "fd-plane--shoot" : ""}`} style={{ transform: `rotate(${planeAngle}deg)` }}>
                  <svg viewBox="0 0 40 46" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="fdJetBody" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#dfe6f3" />
                        <stop offset="55%" stopColor="#a9b6d6" />
                        <stop offset="100%" stopColor="#727fa8" />
                      </linearGradient>
                    </defs>
                    <path d="M20 0 L23.5 13 L23.5 29 L20 44 L16.5 29 L16.5 13 Z" fill="url(#fdJetBody)" stroke="#3a3f5c" strokeWidth="0.7" strokeLinejoin="round" />
                    <path d="M16.5 19 L2 29 L7.5 31.5 L16.5 25 Z" fill="#8d99bd" stroke="#3a3f5c" strokeWidth="0.5" strokeLinejoin="round" />
                    <path d="M23.5 19 L38 29 L32.5 31.5 L23.5 25 Z" fill="#8d99bd" stroke="#3a3f5c" strokeWidth="0.5" strokeLinejoin="round" />
                    <path d="M17.5 27 L11 39 L16 36.5 L18.5 30 Z" fill="#6c76a0" />
                    <path d="M22.5 27 L29 39 L24 36.5 L21.5 30 Z" fill="#6c76a0" />
                    <path d="M19 23 L19 40 L20 37 L21 40 L21 23 Z" fill="#565f86" />
                    <ellipse cx="20" cy="9.5" rx="2.3" ry="3.8" fill="#7fd9c4" opacity="0.9" />
                    <path d="M18 41 L20 46 L22 41 Z" fill="#e6bb5c" opacity={planeShoot ? 1 : 0.75} />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {isMobile && screen === "playing" && (
            <div className="fd-vkb">
              {VKB_ROWS.map((row, ri) => (
                <div className="fd-vkb-row" key={ri}>
                  {ri === 2 && <div className="fd-vkb-spacer" />}
                  {row.map((k) => (
                    <button key={k} type="button" className="fd-vkb-key" onClick={() => handleVirtualKey(k)}>
                      {k.toUpperCase()}
                    </button>
                  ))}
                  {ri === 2 && (
                    <button type="button" className="fd-vkb-key fd-vkb-key--wide" onClick={handleBackspace} aria-label="Xoá">⌫</button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="fd-type-bar">
            <input ref={inputRef} className="fd-pinyin-input" defaultValue=""
              onChange={handleChange} placeholder="gõ pinyin để bắn..."
              disabled={screen !== "playing"}
              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" />
          </div>
        </div>
      )}

      {screen === "gameover" && (
        <div className="fd-gameover-overlay">
          <div className="fd-go-panel">
          <div className="fd-go-title">{victory ? "全部掌握" : "遊戲結束"}</div>
          <div className="fd-go-sub">{victory ? "Đã dùng hết từ trong kho!" : "Game Over"}</div>
          <div className="fd-go-score">{score}</div>
          {score >= bestScore && score > 0 && <div className="fd-go-newbest">★ Kỷ lục mới!</div>}
          <div className="fd-menu-stats fd-menu-stats--go">
            <div className="fd-stat"><b>{lastCpm}</b><span>CPM</span></div>
            <div className="fd-stat"><b>{summary.accuracy}%</b><span>chính xác</span></div>
            <div className="fd-stat"><b>×{summary.maxCombo}</b><span>combo</span></div>
            <div className="fd-stat"><b>{summary.shotCount}</b><span>đã bắn hạ</span></div>
          </div>

          {(summary.missed.length > 0 || summary.hit.length > 0) && (
            <div className="fd-recap">
              <div className="fd-recap-tabs">
                <button type="button" className={`fd-recap-tab ${recapTab === "missed" ? "fd-recap-tab--on" : ""}`} onClick={() => setRecapTab("missed")}>
                  Chữ chưa gõ được <b className="fd-recap-count fd-recap-count--miss">{summary.missed.length}</b>
                </button>
                <button type="button" className={`fd-recap-tab ${recapTab === "hit" ? "fd-recap-tab--on" : ""}`} onClick={() => setRecapTab("hit")}>
                  Đã bắn hạ <b className="fd-recap-count fd-recap-count--hit">{summary.hit.length}</b>
                </button>
              </div>
              <div className="fd-recap-list">
                {recapTab === "missed" && summary.missed.map((w, i) => (
                  <div className="fd-recap-row" key={`miss-${i}`}>
                    <div className="fd-recap-top">
                      <span className="fd-recap-hz">{w.hanzi}</span>
                      <span className="fd-recap-py">{w.pinyin}</span>
                    </div>
                    <div className="fd-recap-mn">{w.meaning}</div>
                  </div>
                ))}
                {recapTab === "hit" && summary.hit.map((w, i) => (
                  <div className="fd-recap-row fd-recap-row--hit" key={`hit-${i}`}>
                    <div className="fd-recap-top">
                      <span className="fd-recap-hz">{w.hanzi}</span>
                      <span className="fd-recap-py">{w.pinyin}</span>
                    </div>
                    <div className="fd-recap-mn">{w.meaning}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="fd-btn fd-btn--primary" disabled={practiceMode && wrongWords.length === 0} onClick={() => startGame(practiceMode)}>
            {practiceMode && wrongWords.length === 0 ? "Đã hết từ sai để luyện!" : "Chơi lại"}
          </button>
          <button className="fd-btn fd-btn--ghost" onClick={() => setScreen("menu")}>Về menu</button>
          </div>
        </div>
      )}

      {/* persistent install button - stays on screen (no dismiss/close control) until the app is
          actually installed. Hidden only during active gameplay so it doesn't sit on top of the
          on-screen keyboard/typing area. */}
      {!isStandalone && screen !== "playing" && (
        <button className="fd-install-fab" onClick={handleInstallClick}>
          <span className="fd-install-fab-icon">📲</span>
          <span>Cài đặt App / Thêm ra màn hình chính</span>
        </button>
      )}

      {showIOSInstall && (
        <div className="fd-modal-overlay" onClick={() => setShowIOSInstall(false)}>
          <div className="fd-modal" onClick={(e) => e.stopPropagation()}>
            <button className="fd-modal-close" onClick={() => setShowIOSInstall(false)}>×</button>
            <div className="fd-modal-title">Thêm 陽俊 ra màn hình chính</div>
            <div className="fd-modal-note">
              Safari trên iPhone/iPad không cho phép web tự mở hộp thoại này — bạn cần làm 3 bước thủ công sau:
            </div>
            <ol className="fd-modal-steps">
              <li><span className="fd-modal-step-icon">⬆️</span> Mở game bằng <b>Safari</b>, bấm nút <b>Chia sẻ</b> (hình vuông có mũi tên) ở thanh dưới trình duyệt.</li>
              <li><span className="fd-modal-step-icon">➕</span> Trong danh sách hiện ra, chọn <b>"Thêm vào MH chính" / "Add to Home Screen"</b>.</li>
              <li><span className="fd-modal-step-icon">✅</span> Bấm <b>"Thêm"</b> ở góc trên — icon 陽俊 sẽ xuất hiện ở màn hình chính như một app thật.</li>
            </ol>
          </div>
        </div>
      )}

      {showInstallUnsupported && (
        <div className="fd-modal-overlay" onClick={() => setShowInstallUnsupported(false)}>
          <div className="fd-modal" onClick={(e) => e.stopPropagation()}>
            <button className="fd-modal-close" onClick={() => setShowInstallUnsupported(false)}>×</button>
            <div className="fd-modal-title">Chưa thể cài trực tiếp</div>
            <div className="fd-modal-note">
              Trình duyệt hiện tại chưa hỗ trợ cài đặt tự động. Trên điện thoại, hãy mở link này bằng <b>Chrome (Android)</b> hoặc <b>Safari (iPhone/iPad)</b> để cài ra màn hình chính.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
