document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // --- DOM Elements ---
    const modeSelectionScreen = document.getElementById('mode-selection-screen');
    const gameScreen = document.getElementById('game-screen');
    const resultScreen = document.getElementById('result-screen');

    const practiceModeButton = document.getElementById('practice-mode');
    const scoreAttackModeButton = document.getElementById('score-attack-mode');
    const timeTrialModeButton = document.getElementById('time-trial-mode');

    const gameModeDisplay = document.getElementById('game-mode-display');
    const timerDisplay = document.getElementById('timer-display');
    const scoreDisplay = document.getElementById('score-display');

    const problemElement = document.getElementById('problem');
    const answerElement = document.getElementById('answer');
    const submitButton = document.getElementById('submit');
    const feedbackElement = document.getElementById('feedback');
    const nextProblemButton = document.getElementById('next-problem');
    const giveUpButton = document.getElementById('give-up');

    const resultText = document.getElementById('result-text');
    const newRecordText = document.getElementById('new-record-text');
    const restartGameButton = document.getElementById('restart-game');
    const twitterShareButton = document.getElementById('twitter-share');
    const backToHomeButton = document.getElementById('back-to-home');
    const backToHomeFromGameButton = document.getElementById('back-to-home-from-game');

    const bestScoreSpan = document.getElementById('best-score');
    const bestTimeSpan = document.getElementById('best-time');

    // --- Game State ---
    let gameMode = null; // 'practice', 'scoreAttack', 'timeTrial'
    let correctAnswer;
    let score;
    let timeLeft;
    let questionsAnswered;
    let gameInterval;
    let countdownInterval;
    let startTime;
    let gameHistory = [];

    // --- Game Constants ---
    const SCORE_ATTACK_TIME_LIMIT = 60;
    const TIME_TRIAL_QUESTIONS = 10;

    // --- LocalStorage Keys ---
    const BEST_SCORE_KEY = '4soku_bestScore';
    const BEST_TIME_KEY = '4soku_bestTime';

    // --- Problem Generation Logic ---
    function randInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        if (min > max) {
            [min, max] = [max, min];
        }
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    function isClean(n) { return Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-9; }
    function hasMax3SigFigs(n) {
    if (n === 0) return true;
    // toPrecision(3)で有効数字3桁に丸め、元の値とほぼ同じか比較する
    const n_precis = parseFloat(n.toPrecision(3));
    // 浮動小数点数の比較のため、微小な誤差(epsilon)を許容する
    return Math.abs(n - n_precis) < 1e-9;
}
    const patterns = {
        "p1": { template: "{A}×□ - □×{B} = {C}", generate: () => { const x = randInt(2, 50); const B = randInt(2, 50), A = randInt(B + 2, 99); const C = x * (A - B); if (isClean(C) && hasMax3SigFigs(C) && C > 0) return { v: { A, B, C }, a: x }; return null; } },
        "p2": { template: "□ - {A} = {B}", generate: () => { const A = randInt(100, 1000), B = randInt(100, 1000), x = A + B; if (hasMax3SigFigs(x)) return { v: { A, B }, a: x }; return null; } },
        "p3": { template: "{A} + {B}×{C} + {D} = {E}×□", generate: () => { const E = randInt(2, 10); const val = randInt(2, 20); const BC = randInt(2, 100); const B = randInt(2, 20); const C = BC / B; if(!isClean(C)) return null; const AD = val * E - BC; const A = randInt(1, AD-1); const D = AD - A; if (D > 0 && isClean(D) && hasMax3SigFigs(A) && hasMax3SigFigs(B) && hasMax3SigFigs(C) && hasMax3SigFigs(D)) return { v: { A, B, C, D, E }, a: val }; return null; } },
        "p4": { template: "(□ - {A})×({B} - {C}) = {D}", generate: () => { const x = randInt(2, 50); const A = randInt(1, 10), C = randInt(1, 10), B = randInt(C + 2, 20); const D = (x - A) * (B - C); if (isClean(D) && hasMax3SigFigs(D) && D > 0) return { v: { A, B, C, D }, a: x }; return null; } },
        "p5": { template: "{A}÷□ = {B}÷{C}", generate: () => { const x = randInt(2, 100); const B = randInt(2, 50), C = randInt(2, 50); if (B === C) return null; const A = x * B / C; if (isClean(A) && hasMax3SigFigs(A) && A > 0) return { v: { A, B, C }, a: x }; return null; } },
        "p6": { template: "{A}÷{B} = {C}÷□", generate: () => { const x = randInt(2, 100); const den = randInt(2, 50); const num = randInt(1, den - 1); const k = randInt(2, 10); const A = num * k; const B = den * k; const C = A * x / B; if (A === C) return null; if (isClean(C) && hasMax3SigFigs(C) && C > 0) return { v: { A, B, C }, a: x }; return null; } },
        "p7": { template: "{A}/{B} = □%", generate: () => { const x = randInt(2, 200); const B = randInt(2, 40); const A = x * B / 100; if (isClean(A) && hasMax3SigFigs(A) && A > 0 && A < B) return { v: { A, B }, a: x }; return null; } },
        "p8": { template: "{A} - □ = {B}", generate: () => { const B = randInt(100, 997); const A = randInt(B + 2, 999); const x = A - B; if (hasMax3SigFigs(x) && x > 0) return { v: { A, B }, a: x }; return null; } },
        "p9": { template: "{A}×□ = {B}", generate: () => { const x = randInt(2, 100); const A = randInt(2, 50); const B = x * A; if (hasMax3SigFigs(B)) return { v: { A, B }, a: x }; return null; } },
        "p10": { template: "{A} - {B} = {C}×□ + {D}×□", generate: () => { const x = randInt(2, 50); const C = randInt(1, 10), D = randInt(1, 10); const B = randInt(1, 100); const A = x * (C + D) + B; if (isClean(A) && hasMax3SigFigs(A) && A > B) return { v: { A, B, C, D }, a: x }; return null; } },
        "p11": { template: "{A}×(□÷{B}) = {C}", generate: () => { const x = randInt(2, 100); const A = randInt(2, 50), B = randInt(2, 20); const C = x * A / B; if (isClean(C) && hasMax3SigFigs(C) && C > 0) return { v: { A, B, C }, a: x }; return null; } },
        "p12": { template: "{A} - {B}÷□ = {C}", generate: () => { const x = randInt(2, 50); const C = randInt(1, 50); const A = randInt(C + 2, 100); const B = x * (A - C); if (isClean(B) && hasMax3SigFigs(B) && B > 0) return { v: { A, B, C }, a: x }; return null; } },
        "p13": { template: "{A}×{B} = {C} + □", generate: () => { const A = randInt(10, 40), B = randInt(10, 40); const upperBound = A * B -1; if (upperBound <= 1) return null; const C = randInt(1, upperBound > 1000 ? 1000 : upperBound ); const x = A * B - C; if (hasMax3SigFigs(x) && x > 0 && hasMax3SigFigs(A*B)) return { v: { A, B, C }, a: x }; return null; } },
        "p14": { template: "□÷{A} + {B} = {C}", generate: () => { const A = randInt(2, 20), B = randInt(1, 20), C = randInt(B + 2, 100), x = (C - B) * A; if (hasMax3SigFigs(x) && x > 0) return { v: { A, B, C }, a: x }; return null; } },
        "p15": { template: "□ + {A} = □×{B}", generate: () => { const x = randInt(2, 50); const B = randInt(3, 10); const A = x * (B - 1); if (isClean(A) && hasMax3SigFigs(A) && A > 0) return { v: { A, B }, a: x }; return null; } },
        "p16": { template: "{A}÷{B} = □÷{C}", generate: () => { const x = randInt(2, 100); const B = randInt(2, 50); const A = randInt(B + 1, 100); const C = x * B / A; if (A === C) return null; if (isClean(C) && hasMax3SigFigs(C) && C > 0) return { v: { A, B, C }, a: x }; return null; } },
        "p17": { template: "{D} = □÷({A}/{B})", generate: () => { const x = randInt(2, 100); const A = randInt(2, 20), B = randInt(2, 20); if (A === B) return null; const D = x * B / A; if (isClean(D) && hasMax3SigFigs(D) && D > 0) return { v: { A, B, D }, a: x }; return null; } },
        "p18": { template: "{A}/{B} + {C}/{D} = □÷{E}", generate: () => { const E = randInt(2, 20); const B = randInt(2, 10) * 2; const D = randInt(2, 10) * 2; const A = randInt(1, B - 1); const C = randInt(1, D - 1); const val = (A * D + C * B) * E / (B * D); if (isClean(val) && hasMax3SigFigs(val) && val > 0) return { v: { A, B, C, D, E }, a: val }; return null; } },
        "p19": { template: "{A} - □×{B} = {C}×{D}", generate: () => { const x = randInt(2, 50); const B = randInt(2, 20), C = randInt(2, 10), D = randInt(2, 10); const A = x * B + C * D; if (isClean(A) && hasMax3SigFigs(A)) return { v: { A, B, C, D }, a: x }; return null; } },
        "p20": { template: "{A}÷□ = {B}/{D} + {C}/{E}", generate: () => { const x = randInt(2, 20); const D = randInt(2, 10) * 2; const E = randInt(2, 10) * 2; const B = randInt(1, D - 1); const C = randInt(1, E - 1); const A = x * (B * E + C * D) / (D * E); if (isClean(A) && hasMax3SigFigs(A) && A > 0) return { v: { A, B, C, D, E }, a: x }; return null; } },
        "p21": { template: "{A}×{B} = {C}×□", generate: () => { const x = randInt(2, 100); const A = randInt(2, 50), B = randInt(2, 50); const C = A * B / x; if (isClean(C) && hasMax3SigFigs(C) && C > 0 && C!=A && C!=B && C!=x) return { v: { A, B, C }, a: x }; return null; } },
        "p22": { template: "{A} + {B} = {C}×{D}×□%", generate: () => { const x = randInt(2, 200); const C = randInt(2, 20), D = randInt(2, 20); const val = C * D * x / 100; const A = randInt(1, Math.max(2, val-1)); let B = val - A; B = Number(B.toFixed(3)); if (isClean(B) && hasMax3SigFigs(B) && B > 0) return { v: { A, B, C, D }, a: x }; return null; } },
        "p23": { template: "{A}の□% = {B}", generate: () => { const x = randInt(2,50); const A = randInt(10, 500); if (A === 100) return null; const B = A*x/100; if (isClean(B) && hasMax3SigFigs(B) && B > 0) return { v: { A, B }, a: x }; return null; } },
        "p24": { template: "(□ - {A})÷{B} = {C}", generate: () => { const A = randInt(1, 20), B = randInt(2, 20), C = randInt(1, 50), x = C * B + A; if (hasMax3SigFigs(x) && x > 0) return { v: { A, B, C }, a: x }; return null; } },
        "p25": { template: "{A}×{B}÷{C}÷□ = {D}/{E} + {F}/{G}", generate: () => { const x = randInt(2, 20); const A = randInt(2, 20), B = randInt(2, 20), C = randInt(2, 20); const E = randInt(2, 10) * 2, G = randInt(2, 10) * 2; const D = randInt(1, E - 1), F = randInt(1, G - 1); if ((D * G + F * E) === 0) return null; const val = (A * B * E * G) / (C * (D * G + F * E)); if (isClean(val) && hasMax3SigFigs(val) && val > 0) return { v: { A, B, C, D, E, F, G }, a: val }; return null; } },
        "p26": { template: "□÷{A} = {B} - {C}", generate: () => { const A = randInt(2, 50), C = randInt(1, 100), B = randInt(C + 2, 200), x = (B - C) * A; if (hasMax3SigFigs(x) && x > 0) return { v: { A, B, C }, a: x }; return null; } },
        "p27": { template: "{A}÷□ = {B}", generate: () => { const B = randInt(2, 50); const x = randInt(2, 20); const A = x * B; if (hasMax3SigFigs(A)) return { v: { A, B }, a: x }; return null; } },
        "p28": { template: "□÷{A} = {B}/{C} + {D}/{E}", generate: () => { const A = randInt(2, 20); const C = randInt(2, 10) * 2; const E = randInt(2, 10) * 2; const B = randInt(1, C - 1); const D = randInt(1, E - 1); const x = (B * E + D * C) * A / (C * E); if (isClean(x) && hasMax3SigFigs(x) && x > 0) return { v: { A, B, C, D, E }, a: x }; return null; } },
        "p29": { template: "{A}÷(□×{B}) = {C}", generate: () => { const x = randInt(2, 50); const B = randInt(2, 20), C = randInt(2, 20); const A = x * B * C; if (isClean(A) && hasMax3SigFigs(A) && A > 0) return { v: { A, B, C }, a: x }; return null; } },
        "p30": { template: "□ - {A} + {B} = {C}×{D}", generate: () => { const A = randInt(1, 50), B = randInt(1, 50), C = randInt(2, 20), D = randInt(2, 20); if (A === B) return null; const x = C * D + A - B; if (hasMax3SigFigs(x) && x > 0) return { v: { A, B, C, D }, a: x }; return null; } },
        "p31": { template: "{A}÷({B}/{C}) = □ + {D}", generate: () => { const x = randInt(2, 50); const D = randInt(1, 50); const C = randInt(2, 20); const B = randInt(1, C-1); if (B === 0) return null; const A = (x + D) * B / C; if (isClean(A) && hasMax3SigFigs(A) && A > 0) return { v: { A, B, C, D }, a: x }; return null; } },
        "p32": { template: "□×□ = {A}", generate: () => { const n = randInt(10, 30), A = n * n, x = Math.sqrt(A); if (hasMax3SigFigs(x) && x > 0) return { v: { A }, a: x }; return null; } },
        "p33": { template: "{A}÷({B}/{C}) = (□ + {D})×{E}", generate: () => { const x = randInt(2, 20); const B = randInt(2, 10), C = randInt(B, 20); const D = randInt(1, 20), E = randInt(2, 10); const A = (x + D) * E * B / C; if (isClean(A) && hasMax3SigFigs(A) && A > 0) return { v: { A, B, C, D, E }, a: x }; return null; } },
        "p34": { template: "{A}÷{B} = {C}×□÷{D}", generate: () => { const x = randInt(2, 50); const B = randInt(2, 20), C = randInt(2, 10); const A = randInt(1, 100); const D = x * B * C / A; if (isClean(D) && hasMax3SigFigs(D) && D > 0) return { v: { A, B, C, D }, a: x }; return null; } },
        "p35": { template: "{A}/{B} = ({C}/{D})×□÷{E}", generate: () => { const x = randInt(2, 20); const B = randInt(2, 10), D = randInt(2, 10), E = randInt(2, 10); const A = randInt(1, B - 1), C = randInt(1, D - 1); if (B*C === 0) return null; const val = (A * E * D) / (B * C); if (isClean(val) && hasMax3SigFigs(val) && val > 0) return { v: { A, B, C, D, E }, a: val }; return null; } },
        "p36": { template: "□×{A} = {B}×{C}", generate: () => { const x = randInt(2, 100); const A = randInt(2, 20); const B = randInt(2, 50); if (A === B) return null; const C = x * A / B; if (isClean(C) && hasMax3SigFigs(C) && C > 0) return { v: { A, B, C }, a: x }; return null; } },
        "p37": { template: "□÷{A} + □×{B} - {C} = □", generate: () => { const x = randInt(2, 20); const A = randInt(2, 10), B = randInt(2, 10); const coef = (1 - A + A * B) / A; if (coef === 0 || coef === 1) return null; const C = x * coef; if (isClean(C) && hasMax3SigFigs(C) && C > 0) return { v: { A, B, C }, a: x }; return null; } },
        "p38": { template: "{A} - {B} = {C}×□", generate: () => { const x = randInt(2, 50); const C = randInt(2, 20); const B = randInt(1, 100); const A = x * C + B; if (isClean(A) && hasMax3SigFigs(A)) return { v: { A, B, C }, a: x }; return null; } },
        "p39": { template: "{A} = (□ - {B})÷{C}", generate: () => { const A = randInt(1, 50), B = randInt(1, 50), C = randInt(2, 20), x = A * C + B; if (hasMax3SigFigs(x) && x > 0) return { v: { A, B, C }, a: x }; return null; } },
        "p40": { template: "{D}÷(□/{A}) = {B}", generate: () => { const x = randInt(2, 100); const A = randInt(2, 20), B = randInt(2, 20); const D = x * B / A; if (isClean(D) && hasMax3SigFigs(D) && D > 0) return { v: { D, A, B }, a: x }; return null; } },
        "p41": { template: "{A} - □ = {B} - ({C} - {D})", generate: () => { const D = randInt(1, 50), C = randInt(D + 2, 200); const B = randInt(C - D + 1, 200); if (B === (C - D)) return null; const A = randInt(B - (C - D) + 1, 500); const x = A - (B - (C - D)); if (hasMax3SigFigs(x) && x > 0) return { v: { A, B, C, D }, a: x }; return null; } },
        "p42": { template: "{A}/{B} + {C}/{D} = □%", generate: () => { const B = randInt(2, 10) * 2; const D = randInt(2, 10) * 2; const A = randInt(1, B - 1); const C = randInt(1, D - 1); const x = (A * D + C * B) * 100 / (B * D); if (isClean(x) && hasMax3SigFigs(x) && x > 0) return { v: { A, B, C, D }, a: x }; return null; } },
        "p43": { template: "{E} + {F} = □ - {A}", generate: () => { const E = randInt(20, 100), F = randInt(20, 100), A = randInt(20, 100), x = E + F + A; if (hasMax3SigFigs(x) && x > 0) return { v: { E, F, A }, a: x }; return null; } },
        "p44": { template: "{A}÷(□ - {B}/{C}) = {D}÷{E}", generate: () => { const x = randInt(2, 20); const C = randInt(2, 10), E = randInt(2, 10); const B = randInt(1, C - 1), D = randInt(1, E - 1); if (C*E === 0) return null; const A = (x * C - B) * D / (C * E); if (isClean(A) && hasMax3SigFigs(A) && A > 0) return { v: { A, B, C, D, E }, a: x }; return null; } },
        "p45": { template: "({A} + □)×({A} - □) = {B}", generate: () => { const A = randInt(3, 30); const x_sol = randInt(2, A - 1); const B = A * A - x_sol * x_sol; const x = Math.sqrt(A * A - B); if (hasMax3SigFigs(x) && x > 0) return { v: { A, B }, a: x }; return null; } }
    };
    const availablePatterns = Object.keys(patterns).filter(key => patterns[key] && patterns[key].generate);
    function generateNewProblem() { let result = null, attempts = 0, selectedPattern; while (result === null && attempts < 1000) { attempts++; const randomKey = availablePatterns[Math.floor(Math.random() * availablePatterns.length)]; selectedPattern = patterns[randomKey]; if (selectedPattern) { result = selectedPattern.generate(); } } if (result === null) { problemElement.textContent = "問題生成エラー"; console.error("Failed to generate a valid problem after 1000 attempts."); return; } const problemText = selectedPattern.template.replace(/\{(\w+)\}/g, (_, varName) => result.v[varName]); correctAnswer = result.a; problemElement.textContent = problemText; }

    // --- Screen Management ---
    function showScreen(screen) {
        modeSelectionScreen.classList.add('hidden');
        gameScreen.classList.add('hidden');
        resultScreen.classList.add('hidden');
        screen.classList.remove('hidden');
    }

    function presentNewProblem() {
        generateNewProblem();
        gameHistory.push({
            problem: problemElement.textContent,
            correctAnswer: correctAnswer,
            userAnswer: null,
            isCorrect: false
        });
    }

    // --- Game Flow ---
    function initGame(mode) {
        gameMode = mode;
        score = 0;
        questionsAnswered = 0;
        gameHistory = [];
        clearInterval(gameInterval);
        clearInterval(countdownInterval);

        feedbackElement.textContent = '';
        answerElement.value = '';
        answerElement.disabled = false;
        submitButton.disabled = false;
        nextProblemButton.classList.add('hidden');
        newRecordText.textContent = '';
        giveUpButton.classList.remove('hidden');
        document.getElementById('result-details-container').classList.add('hidden');

        switch (mode) {
            case 'practice':
                gameModeDisplay.textContent = '練習モード';
                timerDisplay.classList.add('hidden');
                scoreDisplay.classList.add('hidden');
                break;
            case 'scoreAttack':
                gameModeDisplay.textContent = 'スコアアタック';
                scoreDisplay.innerHTML = `スコア: <span class="value">${score}</span>`;
                timeLeft = SCORE_ATTACK_TIME_LIMIT;
                timerDisplay.innerHTML = `残り時間: <span class="value">${timeLeft}</span>秒`;
                timerDisplay.classList.remove('hidden');
                scoreDisplay.classList.remove('hidden');
                break;
            case 'timeTrial':
                gameModeDisplay.textContent = 'タイムトライアル';
                scoreDisplay.innerHTML = `問題: <span class="value">0/${TIME_TRIAL_QUESTIONS}</span>`;
                timerDisplay.innerHTML = `タイム: <span class="value">0.0</span>`;
                timerDisplay.classList.remove('hidden');
                scoreDisplay.classList.remove('hidden');
                break;
        }

        showScreen(gameScreen);

        if (mode === 'practice') {
            setupNextProblem();
            answerElement.focus();
        } else {
            showCountdown(() => {
                presentNewProblem();
                startGame();
                answerElement.focus();
            });
        }
    }

    function showCountdown(onComplete) {
        answerElement.disabled = true;
        submitButton.disabled = true;
        problemElement.classList.add('countdown-active');
        let count = 3;
        problemElement.textContent = count;
        countdownInterval = setInterval(() => {
            count--;
            if (count > 0) {
                problemElement.textContent = count;
            } else {
                clearInterval(countdownInterval);
                problemElement.textContent = 'START!';
                setTimeout(() => {
                    problemElement.classList.remove('countdown-active');
                    answerElement.disabled = false;
                    submitButton.disabled = false;
                    onComplete();
                }, 500);
            }
        }, 1000);
    }

    function startGame() {
        if (gameMode === 'scoreAttack') {
            gameInterval = setInterval(() => {
                timeLeft--;
                updateTimerDisplay();
                if (timeLeft <= 0) endGame(false);
            }, 1000);
        } else if (gameMode === 'timeTrial') {
            startTime = performance.now();
            gameInterval = setInterval(updateTimerDisplay, 100);
        }
    }

    function updateTimerDisplay() {
        if (gameMode === 'scoreAttack') {
            timerDisplay.innerHTML = `残り時間: <span class="value">${timeLeft}</span>秒`;
        } else if (gameMode === 'timeTrial') {
            const elapsedTime = (performance.now() - startTime) / 1000;
            timerDisplay.innerHTML = `タイム: <span class="value">${elapsedTime.toFixed(1)}</span>`;
        }
    }

    function endGame(isGiveUp = false) {
        clearInterval(gameInterval);
        clearInterval(countdownInterval);
        answerElement.disabled = true;
        submitButton.disabled = true;
        giveUpButton.classList.add('hidden');
        let resultString = '', shareText = '', appUrl = "https://tanaka0430.github.io/4soku_webtest/";

        twitterShareButton.classList.remove('hidden');
        newRecordText.textContent = '';

        if (isGiveUp) {
            resultString = 'ゲームを中断しました';
            twitterShareButton.classList.add('hidden');
        } else {
            if (gameMode === 'scoreAttack') {
                const bestScore = getBestScore();
                resultString = `スコア: ${score}問`;
                shareText = `四則逆算トレーニングのスコアアタック(${SCORE_ATTACK_TIME_LIMIT}秒)で${score}問正解しました！`;
                if (score > bestScore) { setBestScore(score); newRecordText.textContent = 'ハイスコア更新！'; }
            } else if (gameMode === 'timeTrial') {
                const elapsedTime = (performance.now() - startTime);
                const bestTime = getBestTime();
                resultString = `タイム: ${formatTime(elapsedTime)}`;
                shareText = `四則逆算トレーニングのタイムトライアル(${TIME_TRIAL_QUESTIONS}問)を${formatTime(elapsedTime)}でクリアしました！`;
                if (bestTime === null || elapsedTime < bestTime) { setBestTime(elapsedTime); newRecordText.textContent = 'ベストタイム更新！'; }
            }
            twitterShareButton.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(appUrl)}&hashtags=${encodeURIComponent('四則逆算トレーニング')}`;
        }

        resultText.textContent = resultString;

        if (gameHistory.length > 0 && gameHistory.some(r => r.userAnswer !== null)) {
            const detailsContainer = document.getElementById('result-details');
            const detailsContainerWrapper = document.getElementById('result-details-container');
            let detailsHtml = '<table><thead><tr><th>問題</th><th>正解</th><th>あなたの回答</th><th>正誤</th></tr></thead><tbody>';
            gameHistory.forEach(record => {
                if (record.userAnswer === null && !record.isCorrect) return;
                detailsHtml += `<tr>
                    <td>${record.problem}</td>
                    <td>${record.correctAnswer}</td>
                    <td>${record.userAnswer !== null ? record.userAnswer : '無回答'}</td>
                    <td>${record.isCorrect ? '〇' : '×'}</td>
                </tr>`;
            });
            detailsHtml += '</tbody></table>';
            detailsContainer.innerHTML = detailsHtml;
            detailsContainerWrapper.classList.remove('hidden');
        }

        showScreen(resultScreen);
        updateBestRecordsDisplay();
    }

    function checkAnswer() {
        const userAnswerStr = answerElement.value.trim();
        if (userAnswerStr === '') return;
        const userAnswer = parseFloat(userAnswerStr);
        const isCorrect = !isNaN(userAnswer) && Math.abs(userAnswer - correctAnswer) < 1e-9;

        const currentProblem = gameHistory[gameHistory.length - 1];
        if (currentProblem) {
            currentProblem.userAnswer = userAnswer;
        }

        if (isCorrect) {
            if (currentProblem) currentProblem.isCorrect = true;
            feedbackElement.textContent = '正解！';
            feedbackElement.className = 'success';
            answerElement.disabled = true;
            submitButton.disabled = true;

            if (gameMode === 'practice') {
                nextProblemButton.classList.remove('hidden');
                giveUpButton.classList.add('hidden');
                nextProblemButton.focus();
            } else {
                score++;
                questionsAnswered++;
                if (gameMode === 'scoreAttack') {
                    scoreDisplay.innerHTML = `スコア: <span class="value">${score}</span>`;
                    setTimeout(setupNextProblem, 300);
                } else if (gameMode === 'timeTrial') {
                    scoreDisplay.innerHTML = `問題: <span class="value">${questionsAnswered}/${TIME_TRIAL_QUESTIONS}</span>`;
                    if (questionsAnswered >= TIME_TRIAL_QUESTIONS) {
                        endGame(false);
                    } else {
                        setTimeout(setupNextProblem, 300);
                    }
                }
            }
        } else {
            if (gameMode !== 'practice') {
                feedbackElement.textContent = '不正解！ 3秒後に次の問題へ進みます。';
                feedbackElement.className = 'error';
                answerElement.disabled = true;
                submitButton.disabled = true;
                setTimeout(() => {
                    if (gameMode === 'scoreAttack' && timeLeft <= 0) return;
                    if (gameMode === 'timeTrial' && questionsAnswered >= TIME_TRIAL_QUESTIONS) return;
                    setupNextProblem();
                }, 3000);
            } else {
                feedbackElement.textContent = '不正解。もう一度！';
                feedbackElement.className = 'error';
                answerElement.select();
            }
        }
    }

    function setupNextProblem() {
        feedbackElement.textContent = '';
        answerElement.value = '';
        answerElement.disabled = false;
        submitButton.disabled = false;
        presentNewProblem();
        answerElement.focus();
        if (gameMode === 'practice') {
            nextProblemButton.classList.add('hidden');
            giveUpButton.classList.remove('hidden');
        }
    }

    // --- LocalStorage & UI Update ---
    function getBestScore() { return parseInt(localStorage.getItem(BEST_SCORE_KEY) || '0', 10); }
    function setBestScore(score) { localStorage.setItem(BEST_SCORE_KEY, score); }
    function getBestTime() { const time = localStorage.getItem(BEST_TIME_KEY); return time ? parseFloat(time) : null; }
    function setBestTime(time) { localStorage.setItem(BEST_TIME_KEY, time); }
    function formatTime(ms) { if (ms === null || isNaN(ms)) return '--:--.-'; const totalSeconds = ms / 1000; const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0'); const seconds = (totalSeconds % 60).toFixed(1).padStart(4, '0'); return `${minutes}:${seconds}`; }
    function updateBestRecordsDisplay() { bestScoreSpan.textContent = getBestScore(); bestTimeSpan.textContent = formatTime(getBestTime()); }

    // --- Event Listeners ---
    practiceModeButton.addEventListener('click', () => initGame('practice'));
    scoreAttackModeButton.addEventListener('click', () => initGame('scoreAttack'));
    timeTrialModeButton.addEventListener('click', () => initGame('timeTrial'));
    submitButton.addEventListener('click', checkAnswer);
    answerElement.addEventListener('keypress', (e) => { if (e.key === 'Enter') { if (gameMode === 'practice' && !nextProblemButton.classList.contains('hidden')) { nextProblemButton.click(); } else { submitButton.click(); } } });
    nextProblemButton.addEventListener('click', setupNextProblem);
    giveUpButton.addEventListener('click', () => {
        if (gameMode === 'practice') {
            feedbackElement.textContent = `正解は ${correctAnswer}`;
            feedbackElement.className = 'info';
            answerElement.disabled = true;
            submitButton.disabled = true;
            nextProblemButton.classList.remove('hidden');
            giveUpButton.classList.add('hidden');
            nextProblemButton.focus();
        } else {
            endGame(true);
        }
    });
    restartGameButton.addEventListener('click', () => initGame(gameMode));
    backToHomeButton.addEventListener('click', () => showScreen(modeSelectionScreen));
    backToHomeFromGameButton.addEventListener('click', () => {
        clearInterval(gameInterval);
        clearInterval(countdownInterval);
        showScreen(modeSelectionScreen);
    });

    // --- Initial Load ---
    updateBestRecordsDisplay();
    showScreen(modeSelectionScreen);
});
