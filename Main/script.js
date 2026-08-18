/* ===================== CLOCK ===================== */
function pad(n){ return n.toString().padStart(2,'0'); }
function updateClock() {
    const now = new Date();
    const h = pad(now.getHours()), m = pad(now.getMinutes());
    const t = h+':'+m;
    ['clockDisplay','sbTime1','sbTime2','sbTime3','sbTime5'].forEach(id=>{
        const el = document.getElementById(id);
        if (el) el.textContent = t;
    });
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const d = now.getDate(), month = months[now.getMonth()], day = days[now.getDay()];
    const dateEl = document.getElementById('dateDisplay');
    if (dateEl) dateEl.textContent = day+', '+d+' '+month;
}
updateClock();
setInterval(updateClock, 10000);

/* ===================== NAVIGATION BETWEEN SCREENS ===================== */
let screenStack = ['screen-home'];

function showScreen(id, opts) {
    opts = opts || {};
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (opts.push !== false) {
        if (screenStack[screenStack.length-1] !== id) screenStack.push(id);
    }
}

function goBack() {
    if (isCallActiveScreen(screenStack[screenStack.length-1])) return; // "back" doesn't work during a call
    if (screenStack[screenStack.length-1] === 'screen-camera') stopCamera();
    if (screenStack[screenStack.length-1] === 'screen-internet') dinoStop();
    if (screenStack[screenStack.length-1] === 'screen-pacdroid') pacStop();
    if (screenStack[screenStack.length-1] === 'screen-snake') snakeStop();
    if (screenStack[screenStack.length-1] === 'screen-flappy') flappyStop();
    if (screenStack[screenStack.length-1] === 'screen-gallery' && galleryViewerOpen()) { closeGalleryViewer(); return; }
    if (screenStack.length > 1) {
        screenStack.pop();
        const prev = screenStack[screenStack.length-1];
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(prev).classList.add('active');
    }
}

function goHome() {
    endCallCompletely();
    stopCamera();
    dinoStop();
    pacStop();
    snakeStop();
    flappyStop();
    closeGalleryViewer();
    screenStack = ['screen-home'];
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-home').classList.add('active');
}

function isCallActiveScreen(id) {
    return id === 'screen-calling' || id === 'screen-outgoing' || id === 'screen-incoming' || id === 'screen-incall';
}

['backBtn','backBtn2','backBtn3','backBtn4','backBtn5','backBtn7','backBtn8','backBtn9','backBtn10','backBtn11','backBtn12','backBtn13','backBtn14','backBtn15','backBtn16','backBtn17'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', goBack);
});
['homeBtn','homeBtn2','homeBtn3','homeBtn4','homeBtn5','homeBtn7','homeBtn8','homeBtn9','homeBtn10','homeBtn11','homeBtn12','homeBtn13','homeBtn14','homeBtn15','homeBtn16','homeBtn17'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', goHome);
});
document.querySelectorAll('.nav-btn.disabled').forEach(btn=>{
    btn.addEventListener('click', e => e.preventDefault());
});

/* Dock — Phone, Contacts, Camera and Internet (offline dino game) are functional */
document.getElementById('phoneBtn').addEventListener('click', ()=> showScreen('screen-dialer'));
document.getElementById('contactsBtn').addEventListener('click', ()=>{
    showScreen('screen-dialer');
    selectDialerTab('tabContactsFromDialer');
});
document.getElementById('internetBtn').addEventListener('click', ()=>{ showScreen('screen-internet'); dinoInit(); });
document.getElementById('dinoRefreshBtn').addEventListener('click', ()=> dinoStart());
document.getElementById('cameraBtn').addEventListener('click', ()=>{
    showScreen('screen-camera');
    startCamera();
});

/* The "Apps" button and an upward swipe open the app drawer (only available from the home screen) */
const appDrawerEl = document.getElementById('screen-appdrawer');
const homeScreenEl = document.getElementById('screen-home');

/* Smoothly/instantly set the panel position. animate=false — teleport without animation (used to place the panel at its starting point before opening). */
function setDrawerTransform(value, animate) {
    if (!animate) {
        appDrawerEl.style.transition = 'none';
        appDrawerEl.style.transform = value;
        void appDrawerEl.offsetHeight; /* force reflow so the browser commits the starting position */
        appDrawerEl.style.transition = '';
    } else {
        appDrawerEl.style.transform = value;
    }
}

/* direction: 'up' — slides in from bottom to top; 'down' — slides in from top to bottom */
function openAppDrawer(direction) {
    const startPos = direction === 'down' ? 'translateY(-100%)' : 'translateY(100%)';
    setDrawerTransform(startPos, false);
    appDrawerEl.classList.add('app-drawer-open');
    requestAnimationFrame(()=>{
        setDrawerTransform('translateY(0)', true);
    });
}

/* direction: 'up' — slides out upward; 'down'/default — slides out downward */
function closeAppDrawer(direction) {
    const endPos = direction === 'up' ? 'translateY(-100%)' : 'translateY(100%)';
    setDrawerTransform(endPos, true);
    appDrawerEl.classList.remove('app-drawer-open');
}

function openAppFromDrawer(screenId, afterOpen) {
    closeAppDrawer();
    showScreen(screenId);
    if (afterOpen) afterOpen();
}

document.getElementById('backBtn6').addEventListener('click', ()=> closeAppDrawer());
document.getElementById('homeBtn6').addEventListener('click', ()=> closeAppDrawer());

/* Reserved height, in px, at the very top of the screen (where the screen "ends") that is
   dedicated exclusively to the Quick Settings pull-down gesture — see the Quick Settings
   block further below. The app drawer swipe below deliberately ignores touches that start
   in this zone, and only opens on an UPWARD swipe now (a downward swipe used to also open
   it, which is exactly what made it clash with pulling down Quick Settings). */
const QS_TOP_EDGE_PX = 28;

/* Swipe up — a global gesture on the whole document (not tied to the size
   of a specific element, so it works the same on any screen resolution).
   On the home screen it opens the app drawer (sliding up from the bottom);
   when the app drawer is open, a swipe in either direction closes it
   (sliding out in the swipe direction). Downward swipes no longer open the
   drawer — that gesture belongs to Quick Settings (see below) — and any
   swipe starting in the very top edge zone is left untouched here so it
   can't be confused with opening Quick Settings. */
(function(){
    let startY = null, startX = null, tracking = false;

    function isRelevantContext() {
        if (easterEggScreen.classList.contains('show')) return false; /* easter egg owns all touches while open */
        return appDrawerEl.classList.contains('app-drawer-open') || homeScreenEl.classList.contains('active');
    }
    function gestureStart(y, x) {
        if (!isRelevantContext()) { tracking = false; return; }
        if (qsState !== 'closed') { tracking = false; return; } /* Quick Settings owns this gesture right now */
        if (y <= QS_TOP_EDGE_PX && !appDrawerEl.classList.contains('app-drawer-open')) { tracking = false; return; } /* reserved for Quick Settings */
        startY = y; startX = x; tracking = true;
    }
    function gestureEnd(y, x) {
        if (!tracking) return;
        tracking = false;
        const rawDeltaY = startY - y; /* positive — finger moved upward */
        const deltaX = Math.abs(startX - x);
        const deltaY = Math.abs(rawDeltaY);
        /* Cancel only if the swipe is more sideways than vertical. A fixed pixel
           threshold on deltaX used to be used here, but that made the gesture
           effectively only reliable near the screen edges: starting near an edge
           physically caps how far a finger can drift sideways (it hits the edge
           of the screen), while starting from the middle leaves room for a normal
           swiping arc to drift 90px+ sideways and get wrongly cancelled. Comparing
           to deltaY instead scales correctly no matter where on the screen the
           swipe starts. */
        if (deltaY <= 45 || deltaX >= deltaY * 0.65) return;
        const direction = rawDeltaY > 0 ? 'up' : 'down';
        if (appDrawerEl.classList.contains('app-drawer-open')) {
            closeAppDrawer(direction);
        } else if (direction === 'up' && homeScreenEl.classList.contains('active')) {
            openAppDrawer(direction);
        }
    }

    document.addEventListener('touchstart', (e)=>{
        if (e.touches.length !== 1) return;
        gestureStart(e.touches[0].clientY, e.touches[0].clientX);
    }, {passive:true});
    document.addEventListener('touchmove', (e)=>{
        if (tracking) e.preventDefault();
    }, {passive:false});
    document.addEventListener('touchend', (e)=>{
        const t = e.changedTouches[0];
        if (t) gestureEnd(t.clientY, t.clientX);
    }, {passive:true});
    document.addEventListener('touchcancel', ()=>{ tracking = false; }, {passive:true});

    /* Mouse — so the gesture can also be tested on desktop */
    document.addEventListener('mousedown', (e)=> gestureStart(e.clientY, e.clientX));
    document.addEventListener('mouseup', (e)=> gestureEnd(e.clientY, e.clientX));
})();

/* ===================== QUICK SETTINGS ===================== =====================
   Only opens if you pull down starting right at the very top edge of the screen
   (the top QS_TOP_EDGE_PX pixels — where the screen "ends"). It never opens from a
   swipe that starts anywhere else, so it can't be mistaken for the app-drawer swipe.

   States: 'closed' -> 'peek' -> 'full'
     - closed -> peek: 1st pull down from the top edge  -> shows quick.jpg
     - peek   -> full: 2nd pull down (from anywhere on the now-open panel) -> shows quicksettings.jpg
     - peek/full -> closed: swipe up anywhere on the panel (an "empty" spot, since it's
       just an image with no controls) closes it again.
   =================================================================================== */
const quickSettingsPanel = document.getElementById('quickSettingsPanel');
let qsState = 'closed'; /* 'closed' | 'peek' | 'full' */

function onboardingOverlayShowing() {
    return welcomeOverlay.classList.contains('show') || navHintOverlay.classList.contains('show');
}

function setQsState(state) {
    qsState = state;
    quickSettingsPanel.classList.toggle('qs-open', state !== 'closed');
    quickSettingsPanel.classList.toggle('qs-peek', state === 'peek');
    quickSettingsPanel.classList.toggle('qs-full', state === 'full');
}

(function(){
    let startY = null, startX = null, tracking = false;

    function canStartGesture(y) {
        if (onboardingOverlayShowing()) return false;
        if (easterEggScreen.classList.contains('show')) return false; /* easter egg owns all touches while open */
        if (qsState !== 'closed') return true; /* already open — any touch on the panel can expand or close it */
        /* closed: only a pull starting right at the very top edge is allowed to open it —
           this is what keeps it from clashing with the app drawer swipe. It works from any
           screen/app, not just the home screen, same as on a real phone. */
        return y <= QS_TOP_EDGE_PX;
    }
    function qsGestureStart(y, x) {
        if (!canStartGesture(y)) { tracking = false; return; }
        startY = y; startX = x; tracking = true;
    }
    function qsGestureEnd(y, x) {
        if (!tracking) return;
        tracking = false;
        const deltaY = y - startY; /* positive — finger moved downward */
        const deltaX = Math.abs(x - startX);
        if (Math.abs(deltaY) <= 40 || deltaX >= 90) return;

        if (qsState === 'closed' && deltaY > 0) {
            setQsState('peek');
        } else if (qsState === 'peek') {
            if (deltaY > 0) setQsState('full');
            else setQsState('closed');
        } else if (qsState === 'full' && deltaY < 0) {
            setQsState('closed');
        }
    }

    /* While closed, the panel itself has zero height, so the initial pull has to be
       caught on the document; once open, listen on the panel itself so taps elsewhere
       on the screen (e.g. inside an app underneath) don't get mistaken for this gesture. */
    document.addEventListener('touchstart', (e)=>{
        if (qsState !== 'closed' || e.touches.length !== 1) return;
        qsGestureStart(e.touches[0].clientY, e.touches[0].clientX);
    }, {passive:true});
    quickSettingsPanel.addEventListener('touchstart', (e)=>{
        if (e.touches.length !== 1) return;
        qsGestureStart(e.touches[0].clientY, e.touches[0].clientX);
    }, {passive:true});
    document.addEventListener('touchmove', (e)=>{
        if (tracking) e.preventDefault();
    }, {passive:false});
    document.addEventListener('touchend', (e)=>{
        const t = e.changedTouches[0];
        if (t) qsGestureEnd(t.clientY, t.clientX);
    }, {passive:true});
    document.addEventListener('touchcancel', ()=>{ tracking = false; }, {passive:true});

    /* Mouse — so the gesture can also be tested on desktop */
    document.addEventListener('mousedown', (e)=>{
        if (qsState !== 'closed') return;
        qsGestureStart(e.clientY, e.clientX);
    });
    quickSettingsPanel.addEventListener('mousedown', (e)=> qsGestureStart(e.clientY, e.clientX));
    document.addEventListener('mouseup', (e)=> qsGestureEnd(e.clientY, e.clientX));
})();

/* Replace an icon with a placeholder if the file is not found (for icons added by the user) */
function iconFallback(img, label) {
    const wrap = img.parentElement;
    wrap.classList.add('placeholder');
    wrap.textContent = label;
}

/* ===================== APP DRAWER: APPS / WIDGETS TABS ===================== */
const tabAppsGrid = document.getElementById('tabAppsGrid');
const tabWidgets = document.getElementById('tabWidgets');
const appDrawerGrid = document.getElementById('appDrawerGrid');
const appDrawerWidgets = document.getElementById('appDrawerWidgets');

tabAppsGrid.addEventListener('click', ()=>{
    tabAppsGrid.classList.add('active');
    tabWidgets.classList.remove('active');
    appDrawerGrid.style.display = 'grid';
    appDrawerWidgets.style.display = 'none';
});
tabWidgets.addEventListener('click', ()=>{
    tabWidgets.classList.add('active');
    tabAppsGrid.classList.remove('active');
    appDrawerGrid.style.display = 'none';
    appDrawerWidgets.style.display = 'flex';
});
document.getElementById('widgetImg').addEventListener('error', function(){
    document.getElementById('widgetCard').innerHTML =
        '<div style="padding:6vh 4vw;text-align:center;color:#9aa7b0;font-size:13px;">widget.jpg not found<br>Add a widget.jpg file next to index.html</div>';
});

/* ===================== APP DRAWER: LAUNCHING APPS ===================== */
document.getElementById('appPhone').addEventListener('click', ()=> openAppFromDrawer('screen-dialer'));
document.getElementById('appContacts').addEventListener('click', ()=> openAppFromDrawer('screen-dialer', ()=> selectDialerTab('tabContactsFromDialer')));
document.getElementById('appCamera').addEventListener('click', ()=> openAppFromDrawer('screen-camera', startCamera));
document.getElementById('appInternet').addEventListener('click', ()=> openAppFromDrawer('screen-internet', dinoInit));
document.getElementById('appGameDroid').addEventListener('click', ()=> openAppFromDrawer('screen-gamedroid'));
document.getElementById('appGallery').addEventListener('click', ()=> openAppFromDrawer('screen-gallery', renderGalleryGrid));
document.getElementById('appSettings').addEventListener('click', ()=> openAppFromDrawer('screen-settings'));

/* Settings tab bar — only "Connections" (shows settings.jpg) and "More" (empty for now) are functional */
const settingsTabConnections = document.getElementById('settingsTabConnections');
const settingsTabMore = document.getElementById('settingsTabMore');
const settingsBody = document.getElementById('settingsBody');
const settingsBodyEmpty = document.getElementById('settingsBodyEmpty');
const settingsFunctionalTabs = [settingsTabConnections, settingsTabMore];

function selectSettingsTab(tab) {
    settingsFunctionalTabs.forEach(t=> t.classList.remove('active'));
    tab.classList.add('active');
    const showConnections = tab === settingsTabConnections;
    settingsBody.style.display = showConnections ? '' : 'none';
    settingsBodyEmpty.style.display = showConnections ? 'none' : '';
}

settingsTabConnections.addEventListener('click', ()=> selectSettingsTab(settingsTabConnections));
settingsTabMore.addEventListener('click', ()=> selectSettingsTab(settingsTabMore));

/* Wi-Fi toggle inside Connections — tap switches between the off/on slider images */
let settingsWifiOn = false;
const settingsWifiToggleImg = document.getElementById('settingsWifiToggleImg');
document.getElementById('settingsWifiToggle').addEventListener('click', ()=>{
    settingsWifiOn = !settingsWifiOn;
    settingsWifiToggleImg.src = settingsWifiOn ? 'Won.jpg' : 'Woff.jpg';
});

/* More > About phone */
const moreList = document.getElementById('moreList');
const aboutPhonePanel = document.getElementById('aboutPhonePanel');
document.getElementById('aboutPhoneItem').addEventListener('click', ()=>{
    moreList.style.display = 'none';
    aboutPhonePanel.style.display = 'flex';
});
document.getElementById('aboutPhoneBack').addEventListener('click', ()=>{
    aboutPhonePanel.style.display = 'none';
    moreList.style.display = 'flex';
});

/* Easter egg: tap "Android version" 5 times in About phone */
const settingsEggToast = document.getElementById('settingsEggToast');
let eggTapCount = 0;
let eggTapTimer = null;
function showSettingsEggToast(text) {
    settingsEggToast.textContent = text;
    settingsEggToast.classList.add('show');
    clearTimeout(showSettingsEggToast._t);
    showSettingsEggToast._t = setTimeout(()=> settingsEggToast.classList.remove('show'), 1600);
}
function triggerAndroidEasterEgg() {
    openEasterEgg();
}
document.getElementById('androidVersionItem').addEventListener('click', ()=>{
    eggTapCount++;
    clearTimeout(eggTapTimer);
    eggTapTimer = setTimeout(()=> { eggTapCount = 0; }, 2000);
    const left = 5 - eggTapCount;
    if (eggTapCount >= 5) {
        eggTapCount = 0;
        clearTimeout(eggTapTimer);
        triggerAndroidEasterEgg();
    } else if (eggTapCount >= 2) {
        showSettingsEggToast(left + (left === 1 ? ' more tap…' : ' more taps…'));
    }
});

/* ============ EASTER EGG mini-game ============ */
const easterEggScreen = document.getElementById('easterEggScreen');
const eggCreatureImg = document.getElementById('eggCreatureImg');
let eggState = 'unborn'; // 'unborn' -> 'born' -> 'pucks'
let eggBornTaps = 0;

function openEasterEgg() {
    eggState = 'unborn';
    eggBornTaps = 0;
    eggCreatureImg.style.display = '';
    eggCreatureImg.src = 'UnBorned.png';
    eggCreatureImg.style.top = '50%';
    eggCreatureImg.style.left = '50%';
    eggCreatureImg.style.transform = 'translate(-50%,-50%)';
    eggPucks.forEach(p=>{
        p.el.style.display = 'none';
        p.vx = 0; p.vy = 0;
        cancelAnimationFrame(p.raf);
    });
    easterEggScreen.classList.add('show');
}
function closeEasterEgg() {
    easterEggScreen.classList.remove('show');
}
document.getElementById('easterEggClose').addEventListener('click', closeEasterEgg);

/* Tap anywhere on the wallpaper -> UnBorned.png becomes Borned.png */
document.getElementById('easterEggBg').addEventListener('click', ()=>{
    if (eggState !== 'unborn') return;
    eggState = 'born';
    eggCreatureImg.src = 'Borned.png';
});

/* Tap the creature 5 times (once born) -> Purple.png and Pink.png both spawn at random spots */
eggCreatureImg.addEventListener('click', (e)=>{
    e.stopPropagation();
    if (eggState !== 'born') return;
    eggBornTaps++;
    if (eggBornTaps >= 5) {
        eggState = 'pucks';
        eggCreatureImg.style.display = 'none';
        const screenRect = easterEggScreen.getBoundingClientRect();
        eggPucks.forEach(p=>{
            p.el.style.display = 'block';
            const w = p.el.offsetWidth || screenRect.width * .3;
            const h = p.el.offsetHeight || w;
            const x = Math.random() * Math.max(0, screenRect.width - w);
            const y = screenRect.height * 0.25 + Math.random() * Math.max(0, screenRect.height * 0.5 - h);
            p.el.style.left = x + 'px';
            p.el.style.top = y + 'px';
        });
    }
});

/* Drag-and-throw physics for the two pucks — glide and slow down like a hockey puck on ice */
const eggPucks = [
    { el: document.getElementById('eggPuckPurple') },
    { el: document.getElementById('eggPuckPink') }
].map(p=> Object.assign(p, { vx:0, vy:0, dragging:false, raf:null, history:[] }));

const EGG_FRICTION = 0.965;
const EGG_STOP_SPEED = 0.03;
const EGG_WALL_BOUNCE = 0.55;

function eggPuckMomentumStep(p) {
    const screenRect = easterEggScreen.getBoundingClientRect();
    const w = p.el.offsetWidth, h = p.el.offsetHeight;
    let x = parseFloat(p.el.style.left) || 0;
    let y = parseFloat(p.el.style.top) || 0;

    x += p.vx;
    y += p.vy;

    if (x < 0) { x = 0; p.vx = -p.vx * EGG_WALL_BOUNCE; }
    if (x > screenRect.width - w) { x = screenRect.width - w; p.vx = -p.vx * EGG_WALL_BOUNCE; }
    if (y < 0) { y = 0; p.vy = -p.vy * EGG_WALL_BOUNCE; }
    if (y > screenRect.height - h) { y = screenRect.height - h; p.vy = -p.vy * EGG_WALL_BOUNCE; }

    p.vx *= EGG_FRICTION;
    p.vy *= EGG_FRICTION;

    p.el.style.left = x + 'px';
    p.el.style.top = y + 'px';

    if (Math.abs(p.vx) > EGG_STOP_SPEED || Math.abs(p.vy) > EGG_STOP_SPEED) {
        p.raf = requestAnimationFrame(()=> eggPuckMomentumStep(p));
    } else {
        p.vx = 0; p.vy = 0;
    }
}

eggPucks.forEach(p=>{
    p.el.addEventListener('pointerdown', (e)=>{
        if (eggState !== 'pucks') return;
        e.stopPropagation();
        cancelAnimationFrame(p.raf);
        p.dragging = true;
        p.vx = 0; p.vy = 0;
        p.history = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
        const rect = p.el.getBoundingClientRect();
        p.offsetX = e.clientX - rect.left;
        p.offsetY = e.clientY - rect.top;
        p.el.classList.add('dragging');
        p.el.setPointerCapture(e.pointerId);
    });
    p.el.addEventListener('pointermove', (e)=>{
        if (!p.dragging) return;
        const screenRect = easterEggScreen.getBoundingClientRect();
        let x = e.clientX - screenRect.left - p.offsetX;
        let y = e.clientY - screenRect.top - p.offsetY;
        const w = p.el.offsetWidth, h = p.el.offsetHeight;
        x = Math.max(0, Math.min(x, screenRect.width - w));
        y = Math.max(0, Math.min(y, screenRect.height - h));
        p.el.style.left = x + 'px';
        p.el.style.top = y + 'px';
        p.history.push({ x: e.clientX, y: e.clientY, t: performance.now() });
        if (p.history.length > 6) p.history.shift();
    });
    function eggPuckEndDrag() {
        if (!p.dragging) return;
        p.dragging = false;
        p.el.classList.remove('dragging');
        const hist = p.history;
        if (hist.length >= 2) {
            const a = hist[0], b = hist[hist.length - 1];
            const dt = Math.max(1, b.t - a.t);
            p.vx = (b.x - a.x) / dt * 16;
            p.vy = (b.y - a.y) / dt * 16;
        }
        cancelAnimationFrame(p.raf);
        p.raf = requestAnimationFrame(()=> eggPuckMomentumStep(p));
    }
    p.el.addEventListener('pointerup', eggPuckEndDrag);
    p.el.addEventListener('pointercancel', eggPuckEndDrag);
});

document.getElementById('gdOpenPacdroid').addEventListener('click', ()=>{
    showScreen('screen-pacdroid');
    pacInit();
});

document.getElementById('gdOpenSnake').addEventListener('click', ()=>{
    showScreen('screen-snake');
    snakeInit();
});

document.getElementById('gdOpenFlappy').addEventListener('click', ()=>{
    showScreen('screen-flappy');
    flappyInit();
});

document.getElementById('kolyaRowInDialer').addEventListener('click', ()=> showScreen('screen-contact-detail'));

/* ===================== DIALER ===================== */
const keys = [
    ['1','∞'],['2','ABC'],['3','DEF'],
    ['4','GHI'],['5','JKL'],['6','MNO'],
    ['7','PQRS'],['8','TUV'],['9','WXYZ'],
    ['*',''],['0','+'],['#','']
];
const keypadEl = document.getElementById('keypad');
const keypadFirstChild = keypadEl.firstElementChild; /* videoCallBtn — digits are inserted before the row of action buttons */
keys.forEach(([num,letters])=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'key';
    btn.innerHTML = '<span class="num">'+num+'</span>'+(letters?'<span class="letters">'+letters+'</span>':'');
    btn.addEventListener('click', ()=> appendDigit(num));
    keypadEl.insertBefore(btn, keypadFirstChild);
});

/* Keypad / Call log / Favorites / Contacts tabs — all inside the dialer, we never leave it */
const dialerTabs = {
    tabKeypad: 'panelKeypad',
    tabLogs: 'panelLogs',
    tabFavorites: 'panelFavorites',
    tabContactsFromDialer: 'panelContacts'
};
function selectDialerTab(tabId) {
    Object.keys(dialerTabs).forEach(t=>{
        document.getElementById(t).classList.toggle('active', t===tabId);
        document.getElementById(t).classList.toggle('dtab', true);
    });
    document.getElementById('panelKeypad').classList.toggle('hidden', dialerTabs[tabId] !== 'panelKeypad');
    document.getElementById('panelLogs').classList.toggle('active', dialerTabs[tabId] === 'panelLogs');
    document.getElementById('panelFavorites').classList.toggle('active', dialerTabs[tabId] === 'panelFavorites');
    document.getElementById('panelContacts').classList.toggle('active', dialerTabs[tabId] === 'panelContacts');
}
Object.keys(dialerTabs).forEach(tabId=>{
    document.getElementById(tabId).addEventListener('click', ()=> selectDialerTab(tabId));
});

let dialedDigits = '';
const dialNumberEl = document.getElementById('dialNumber');
const backspaceBtn = document.getElementById('backspaceBtn');

function refreshDialDisplay() {
    if (dialedDigits.length === 0) {
        dialNumberEl.textContent = '';
        dialNumberEl.classList.add('dial-hint');
        backspaceBtn.classList.remove('show');
    } else {
        dialNumberEl.textContent = dialedDigits;
        dialNumberEl.classList.remove('dial-hint');
        backspaceBtn.classList.add('show');
    }
}
function appendDigit(d) {
    dialedDigits += d;
    refreshDialDisplay();
}
backspaceBtn.addEventListener('click', ()=>{
    dialedDigits = dialedDigits.slice(0,-1);
    refreshDialDisplay();
});
refreshDialDisplay();

document.getElementById('callBtn').addEventListener('click', ()=>{
    if (dialedDigits.length === 0) {
        showToast('Enter a number');
        return;
    }
    startOutgoingCall(dialedDigits);
});

document.getElementById('detailCallBtn').addEventListener('click', ()=>{
    startDirectCallToKolya();
});

/* ===================== CALL: LOGIC ===================== */
let outgoingTimeout = null;
let ringInterval = null;
let callTimerInterval = null;
let callSeconds = 0;
let audioCtxRingStop = null;

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(()=> t.classList.remove('show'), 1600);
}

/* Call any number -> ringing tone (calling.jpg, 3s) -> cuts off -> Kolya calls back */
function startOutgoingCall(number) {
    document.getElementById('outNumber').textContent = number;
    showScreen('screen-calling');
    outgoingTimeout = setTimeout(()=>{
        startIncomingCallFromKolya();
    }, 3000);
}

/* Call Kolya directly from the contact -> ringing tone (calling.jpg, 3s) -> straight into the call */
function startDirectCallToKolya() {
    document.getElementById('outNumber').textContent = 'Kolya the Plumber';
    document.getElementById('outAvatar').textContent = '🔧';
    showScreen('screen-calling');
    outgoingTimeout = setTimeout(()=>{
        startInCall('Kolya the Plumber');
    }, 3000);
}

function startIncomingCallFromKolya() {
    showScreen('screen-incoming');
    playRingtone();
    vibrateLoop();
}

document.getElementById('acceptBtn').addEventListener('click', ()=>{
    stopRingtone();
    stopVibrate();
    startInCall('Kolya the Plumber');
});
document.getElementById('declineBtn').addEventListener('click', ()=>{
    stopRingtone();
    stopVibrate();
    goHome();
});
document.getElementById('messageBtn').addEventListener('click', ()=>{
    stopRingtone();
    stopVibrate();
    showToast('Message sent');
    goHome();
});

function startInCall(name) {
    document.getElementById('incallName').textContent = name || 'Kolya the Plumber';
    const avatar = document.getElementById('incallAvatar');
    avatar.style.display = '';
    avatar.src = 'kolya.jpg?' + Date.now(); // reset in case the image was already tried and not found
    showScreen('screen-incall');
    callSeconds = 0;
    updateCallTimerLabel();
    clearInterval(callTimerInterval);
    callTimerInterval = setInterval(()=>{
        callSeconds++;
        updateCallTimerLabel();
    }, 1000);
}
function updateCallTimerLabel() {
    const m = String(Math.floor(callSeconds/60)).padStart(2,'0');
    const s = String(callSeconds%60).padStart(2,'0');
    document.getElementById('incallTimer').textContent = m + ':' + s;
}
document.getElementById('hangupBtn').addEventListener('click', goHome);

function endCallCompletely() {
    clearTimeout(outgoingTimeout);
    clearInterval(callTimerInterval);
    stopRingtone();
    stopVibrate();
    dialedDigits = '';
    refreshDialDisplay();
}

/* ===================== RINGTONE (mp3 + fallback synth) ===================== */
const ringtoneAudio = document.getElementById('ringtoneAudio');
let usingFallbackRing = false;

function playRingtone() {
    ringtoneAudio.currentTime = 0;
    const p = ringtoneAudio.play();
    if (p && p.catch) {
        p.catch(()=> startFallbackRing());
    }
    ringtoneAudio.onerror = startFallbackRing;
}
function stopRingtone() {
    ringtoneAudio.pause();
    ringtoneAudio.currentTime = 0;
    stopFallbackRing();
}

let fallbackCtx = null, fallbackTimer = null;
function startFallbackRing() {
    if (usingFallbackRing) return;
    usingFallbackRing = true;
    try {
        /* reuse the context already created and unlocked (see unlockAudioOnce)
           instead of creating a new one here — a new one created outside a user
           gesture stays "suspended" and produces no sound */
        if (!fallbackCtx) fallbackCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (fallbackCtx.state === 'suspended') fallbackCtx.resume();
        const ringOnce = () => {
            const now = fallbackCtx.currentTime;
            [0, 0.5].forEach(offset=>{
                const osc = fallbackCtx.createOscillator();
                const gain = fallbackCtx.createGain();
                osc.type = 'sine';
                osc.frequency.value = 950;
                gain.gain.setValueAtTime(0, now+offset);
                gain.gain.linearRampToValueAtTime(0.18, now+offset+0.05);
                gain.gain.linearRampToValueAtTime(0, now+offset+0.42);
                osc.connect(gain).connect(fallbackCtx.destination);
                osc.start(now+offset);
                osc.stop(now+offset+0.45);
            });
        };
        ringOnce();
        fallbackTimer = setInterval(ringOnce, 2000);
    } catch(e) { /* audio unavailable, silent fail */ }
}
function stopFallbackRing() {
    usingFallbackRing = false;
    if (fallbackTimer) clearInterval(fallbackTimer);
    fallbackTimer = null;
    /* the context is no longer closed here — it is persistent and reused
       (see unlockAudioOnce / startFallbackRing); closing it would re-lock
       audio until the next touch */
}

/* ===================== VIBRATION ===================== */
function vibrateLoop() {
    if (navigator.vibrate) navigator.vibrate([500,300,500,300,500,300]);
}
function stopVibrate() {
    if (navigator.vibrate) navigator.vibrate(0);
}

/* ===================== CAMERA ===================== */
const cameraVideo = document.getElementById('cameraVideo');
const cameraPlaceholder = document.getElementById('cameraPlaceholder');
const cameraStatusTitle = document.getElementById('cameraStatusTitle');
const cameraStatusSub = document.getElementById('cameraStatusSub');
const cameraRetryBtn = document.getElementById('cameraRetryBtn');
let cameraStream = null;
let cameraPreviewReady = false;
let mirrored = false;

function setCameraStatus(title, sub, showRetry) {
    cameraStatusTitle.textContent = title;
    cameraStatusSub.textContent = sub;
    cameraRetryBtn.style.display = showRetry ? 'inline-block' : 'none';
}

function startCamera() {
    cameraVideo.style.display = 'none';
    cameraVideo.pause();
    cameraPreviewReady = false;
    cameraPlaceholder.style.display = 'flex';
    setCameraStatus('Turning on the camera…', '', false);
    loadPreviewVideo();
}

function loadPreviewVideo() {
    setCameraStatus('Starting preview…', '', false);
    cameraVideo.onerror = () => {
        cameraVideo.style.display = 'none';
        cameraPlaceholder.style.display = 'flex';
        setCameraStatus('camera.mp4 file not found', 'Place a camera.mp4 file next to index.html to enable the preview.', true);
    };
    cameraVideo.oncanplay = () => {
        cameraPreviewReady = true;
        cameraVideo.style.display = 'block';
        cameraPlaceholder.style.display = 'none';
        cameraVideo.play().catch(()=>{});
    };
    cameraVideo.loop = true;
    cameraVideo.muted = true;
    cameraVideo.style.transform = mirrored ? 'scaleX(-1)' : 'none';
    cameraVideo.src = 'camera.mp4';
    cameraVideo.load();
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    cameraVideo.pause();
    cameraVideo.removeAttribute('src');
    cameraVideo.load();
    cameraPreviewReady = false;
}

cameraRetryBtn.addEventListener('click', startCamera);

document.getElementById('videoShotBtn').addEventListener('click', ()=>{
    // just a mockup button — no real video recording, matches the reference UI
});

document.getElementById('shutterBtn').addEventListener('click', ()=>{
    if (!cameraPreviewReady) { startCamera(); return; }
    const flash = document.getElementById('cameraFlash');
    flash.style.transition = 'none';
    flash.style.opacity = '1';
    // stays solid white for ~1s, like a real shutter flash, then fades out
    requestAnimationFrame(()=>{
        setTimeout(()=>{
            flash.style.transition = 'opacity .25s ease';
            flash.style.opacity = '0';
        }, 750);
    });
    const toast = document.getElementById('cameraShotToast');
    toast.classList.add('show');
    setTimeout(()=> toast.classList.remove('show'), 1200);
});

/* ===================== NOTIFICATION FROM SAM (10s after launch) ===================== */
const appNotification = document.getElementById('appNotification');
const notificationAudio = document.getElementById('notificationAudio');

function showAppNotification() {
    notificationAudio.currentTime = 0;
    const p = notificationAudio.play();
    if (p && p.catch) p.catch(()=>{ /* notification.mp3 not added yet — just no sound */ });
    appNotification.classList.add('show');
    setTimeout(()=> appNotification.classList.remove('show'), 3000);
}
/* the notification timer is only started after audio is unlocked (see below) */

/* ===================== ONBOARDING: WELCOME + NAV-BAR HINT ===================== */
const welcomeOverlay = document.getElementById('welcomeOverlay');
const navHintOverlay = document.getElementById('navHintOverlay');
let isFirstVisit = false;
try { isFirstVisit = !localStorage.getItem('rg_visited'); } catch(e) { isFirstVisit = false; }

welcomeOverlay.classList.add('show');

document.getElementById('welcomeThanksBtn').addEventListener('click', ()=>{
    unlockAudioOnce(); /* the first guaranteed real user tap — unlock audio right here */
    welcomeOverlay.classList.remove('show');
    if (isFirstVisit) {
        navHintOverlay.classList.add('show');
    }
});

document.getElementById('hintGotItBtn').addEventListener('click', ()=>{
    navHintOverlay.classList.remove('show');
    try { localStorage.setItem('rg_visited', '1'); } catch(e) { /* storage unavailable, no big deal */ }
});

/* ===================== UNLOCKING AUDIO ON THE USER'S FIRST ACTION =====================
   IMPORTANT: unlocking used to be tied to 'touchstart'. From the browser's point of view,
   touchstart is NOT a valid "activation-triggering" gesture (unlike click/touchend/keydown),
   so calling play() inside touchstart didn't really unlock anything. But since touchstart
   fires before click on a tap, it would set the audioUnlocked flag first and thereby
   "swallow" the later, genuine click — where unlocking would have actually worked —
   so real unlocking never happened at all, and sound wouldn't reliably play on the 1st
   or even the 2nd touch (only the fallback generator could occasionally play, if its
   AudioContext happened to resolve in time).

   Fix: only listen for valid gestures (click and touchend), and during that gesture
   synchronously and genuinely "touch" both <audio> elements, and also create and
   immediately resume a persistent AudioContext for the fallback ringtone — so it
   isn't left suspended when the real call fires later via setTimeout. */
let audioUnlocked = false;
function unlockAudioOnce() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    [ringtoneAudio, notificationAudio].forEach(a=>{
        if (!a) return;
        const wasMuted = a.muted;
        a.muted = true;
        const p = a.play();
        const restore = ()=>{ a.pause(); a.currentTime = 0; a.muted = wasMuted; };
        if (p && p.then) { p.then(restore).catch(restore); } else { restore(); }
    });
    /* prepare and wake the AudioContext right inside the gesture — critical for the fallback ringtone */
    try {
        if (!fallbackCtx) fallbackCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (fallbackCtx.state === 'suspended') fallbackCtx.resume();
    } catch(e) { /* Web Audio unavailable — only the mp3 path remains */ }
    /* only now is audio unlocked — safe to schedule the notification timer */
    setTimeout(showAppNotification, 10000);
}
document.addEventListener('click', unlockAudioOnce);
document.addEventListener('touchend', unlockAudioOnce, {passive:true});
document.addEventListener('keydown', unlockAudioOnce);

/* ===================== SHARED SPRITES (used by GameDroid apps) ===================== */
// Drop these image files next to index.html — everything falls back to simple drawn
// placeholders automatically until each file is added, so nothing breaks in the meantime.
function loadSprite(src) {
    const img = new Image();
    const state = { img, ready:false };
    img.onload = () => { state.ready = true; };
    img.onerror = () => { state.ready = false; };
    img.src = src;
    return state;
}
const spriteAndroid   = loadSprite('android.png');   // player (dino runner + Pac-Droid)
const spriteNoCommand = loadSprite('NoCommand.png'); // ghost 1
const spriteUpdate    = loadSprite('Update.png');    // ghost 2
const spriteAndroError= loadSprite('AndroError.png');// ghost 3
const spriteDonut     = loadSprite('Donut.png');     // small pellet
const spriteKitKat    = loadSprite('KitKat.png');    // power pellet
const spriteSnakeHead = loadSprite('Snake.png');      // snake head
const spriteSnakeBody = loadSprite('Keep_snake.png'); // snake body segment
const spritePipe       = loadSprite('Pipe.png');       // Flappy Droid obstacle (optional)

/* ===================== INTERNET APP: OFFLINE DINO RUNNER ===================== */
(function(){
    const canvas = document.getElementById('dinoCanvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('dinoScore');
    const titleEl = document.getElementById('dinoErrorTitle');
    const subEl = document.getElementById('dinoErrorSub');

    const W = canvas.width, H = canvas.height;
    const GROUND_Y = H - 24;
    const GRAVITY = 0.85;
    const JUMP_V = -13.5;

    let raf = null;
    let running = false;
    let started = false;   // has the player pressed jump at least once
    let gameOver = false;
    let dino, obstacles, speed, distance, score, hiScore, groundOffset, frame;

    function loadHi() {
        try { return parseInt(window.localStorage ? (localStorage.getItem('dinoHiScore')||'0') : '0', 10) || 0; }
        catch(e) { return 0; }
    }
    function saveHi(v) {
        try { if (window.localStorage) localStorage.setItem('dinoHiScore', String(v)); } catch(e) {}
    }

    function reset() {
        dino = { x:30, y:GROUND_Y-40, w:34, h:40, vy:0, onGround:true, duck:false };
        obstacles = [];
        speed = 6.2;
        distance = 0;
        score = 0;
        groundOffset = 0;
        frame = 0;
        gameOver = false;
        started = false;
    }

    function spawnObstacle() {
        const isBird = Math.random() < 0.18 && score > 300;
        if (isBird) {
            const h = 26;
            obstacles.push({ x:W+20, y: GROUND_Y-40 - (Math.random()<0.5?0:38), w:34, h:h, type:'bird' });
        } else {
            const clusters = 1 + (Math.random()<0.3 ? 1 : 0);
            const w = 16, h = 32 + Math.random()*10;
            obstacles.push({ x:W+20, y:GROUND_Y-h, w:w*clusters+ (clusters-1)*4, h:h, type:'cactus' });
        }
    }

    function jump() {
        if (!running) { dinoInit(true); return; }
        if (gameOver) { reset(); render(); return; }
        started = true;
        if (dino.onGround) {
            dino.vy = JUMP_V;
            dino.onGround = false;
        }
    }

    function update() {
        frame++;
        if (!started || gameOver) return;

        distance += speed;
        score = Math.floor(distance / 6);
        if (score > 99999) score = 99999;

        speed = Math.min(13, 6.2 + score/500);

        dino.vy += GRAVITY;
        dino.y += dino.vy;
        if (dino.y >= GROUND_Y-40) {
            dino.y = GROUND_Y-40;
            dino.vy = 0;
            dino.onGround = true;
        }

        if (frame % Math.max(38, Math.floor(70 - speed*3)) === 0) spawnObstacle();

        for (let i = obstacles.length-1; i >= 0; i--) {
            obstacles[i].x -= speed;
            if (obstacles[i].x + obstacles[i].w < -10) obstacles.splice(i,1);
        }

        groundOffset = (groundOffset - speed) % 24;

        // collision (slightly forgiving hitboxes)
        const dbox = { x:dino.x+6, y:dino.y+6, w:dino.w-12, h:dino.h-10 };
        for (const o of obstacles) {
            const obox = { x:o.x+3, y:o.y+3, w:o.w-6, h:o.h-6 };
            if (dbox.x < obox.x+obox.w && dbox.x+dbox.w > obox.x && dbox.y < obox.y+obox.h && dbox.y+dbox.h > obox.y) {
                endGame();
                break;
            }
        }
    }

    function endGame() {
        gameOver = true;
        if (score > hiScore) { hiScore = score; saveHi(hiScore); }
        titleEl.textContent = 'No internet connection';
        subEl.innerHTML = 'Game over — score ' + pad(score) + '. Tap / Space to try again.';
    }

    function pad(n) { return String(n).padStart(5,'0'); }

    function drawGround() {
        ctx.strokeStyle = '#535353';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, GROUND_Y);
        ctx.lineTo(W, GROUND_Y);
        ctx.stroke();
        ctx.fillStyle = '#535353';
        for (let x = groundOffset; x < W; x += 24) {
            ctx.fillRect(x, GROUND_Y+3, 10, 2);
        }
    }

    function drawDino() {
        const x = dino.x, y = dino.y, w = dino.w, h = dino.h;

        if (spriteAndroid.ready) {
            // small bob while running, subtle lean while jumping — purely visual, doesn't affect the hitbox
            const bob = (dino.onGround && started && Math.floor(frame/6)%2===0) ? 1 : 0;
            ctx.drawImage(spriteAndroid.img, x-4, y-8+bob, w+8, h+8);
            return;
        }

        // placeholder shown until android.png is added next to index.html
        const green = '#78c257';
        ctx.fillStyle = green;
        const legFrame = Math.floor(frame/6) % 2;
        if (dino.onGround && started) {
            if (legFrame === 0) {
                ctx.fillRect(x+5, y+h-10, 7, 10);
                ctx.fillRect(x+w-12, y+h-14, 7, 14);
            } else {
                ctx.fillRect(x+5, y+h-14, 7, 14);
                ctx.fillRect(x+w-12, y+h-10, 7, 10);
            }
        } else {
            ctx.fillRect(x+5, y+h-14, 7, 14);
            ctx.fillRect(x+w-12, y+h-14, 7, 14);
        }
        const armSwing = dino.onGround && started ? (legFrame===0 ? -2 : 2) : 0;
        ctx.fillRect(x-2, y+8+armSwing, 5, 14);
        ctx.fillRect(x+w-3, y+8-armSwing, 5, 14);
        ctx.beginPath();
        ctx.moveTo(x+4, y+h-12);
        ctx.lineTo(x+4, y+10);
        ctx.arc(x+w/2, y+10, w/2-4, Math.PI, 0, false);
        ctx.lineTo(x+w-4, y+h-12);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = green;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x+w*0.32, y+2); ctx.lineTo(x+w*0.26, y-7);
        ctx.moveTo(x+w*0.68, y+2); ctx.lineTo(x+w*0.74, y-7);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x+w*0.36, y+13, 2.6, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x+w*0.64, y+13, 2.6, 0, Math.PI*2); ctx.fill();
    }

    function drawObstacles() {
        for (const o of obstacles) {
            if (o.type === 'bird') {
                // small red error-triangle "flying" obstacle
                const flap = Math.floor(frame/8)%2===0;
                const yy = o.y + (flap?4:0);
                ctx.fillStyle = '#d93025';
                ctx.beginPath();
                ctx.moveTo(o.x+o.w/2, yy);
                ctx.lineTo(o.x, yy+o.h);
                ctx.lineTo(o.x+o.w, yy+o.h);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('!', o.x+o.w/2, yy+o.h-3);
            } else {
                // red rounded "error" tag with a cross icon, stacked when clustered
                ctx.fillStyle = '#d93025';
                const r = 4;
                roundRect(o.x, o.y, o.w, o.h, r);
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                const cx = o.x+o.w/2, cy = o.y+o.h/2, s = Math.min(o.w,o.h)*0.22;
                ctx.beginPath();
                ctx.moveTo(cx-s, cy-s); ctx.lineTo(cx+s, cy+s);
                ctx.moveTo(cx+s, cy-s); ctx.lineTo(cx-s, cy+s);
                ctx.stroke();
            }
        }
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x+r, y);
        ctx.arcTo(x+w, y, x+w, y+h, r);
        ctx.arcTo(x+w, y+h, x, y+h, r);
        ctx.arcTo(x, y+h, x, y, r);
        ctx.arcTo(x, y, x+w, y, r);
        ctx.closePath();
    }

    function render() {
        ctx.clearRect(0,0,W,H);
        drawGround();
        drawObstacles();
        drawDino();
        if (!started && !gameOver) {
            ctx.fillStyle = '#535353';
            ctx.font = '13px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('TAP OR PRESS SPACE TO START', W/2, H/2 - 30);
        }
        scoreEl.textContent = 'HI ' + pad(hiScore) + '   ' + pad(score);
    }

    function loop() {
        if (!running) return;
        update();
        render();
        raf = requestAnimationFrame(loop);
    }

    function dinoInit() {
        if (running) return;
        hiScore = loadHi();
        reset();
        running = true;
        titleEl.textContent = 'No internet connection';
        subEl.innerHTML = 'Try checking the network cables, modem, and router.<br>Or press Space / tap the screen to play.';
        render();
        raf = requestAnimationFrame(loop);
    }
    function dinoStart() { dinoStop(); dinoInit(); }
    function dinoStop() {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = null;
    }
    window.dinoInit = dinoInit;
    window.dinoStart = dinoStart;
    window.dinoStop = dinoStop;

    canvas.addEventListener('touchstart', (e)=>{ e.preventDefault(); jump(); }, {passive:false});
    canvas.addEventListener('mousedown', jump);
    document.getElementById('screen-internet').addEventListener('touchstart', (e)=>{
        if (e.target.closest('.nav-bar') || e.target.closest('.browser-topbar')) return;
        jump();
    }, {passive:true});
    document.addEventListener('keydown', (e)=>{
        if (document.getElementById('screen-internet').classList.contains('active') &&
            (e.code === 'Space' || e.code === 'ArrowUp')) {
            e.preventDefault();
            jump();
        }
    });

    hiScore = loadHi();
})();

/* ===================== GAMEDROID: PAC-DROID (retro maze chase) =====================
   Original maze layout (not a pixel copy of the real Pac-Man level — that layout is
   copyrighted) built in the same classic symmetric style: outer walls, corner power
   pellets, corridors and a open central chamber. Player/ghost art comes from
   android.png / NoCommand.png / Update.png / AndroError.png — drop those files next to
   index.html and they're picked up automatically; until then simple placeholder shapes
   are drawn so the game is already fully playable. */
(function(){
    const CS = 26; // cell size in px
    const MAZE = [
        "#############",
        "#.....#.....#",
        "#.###.#.###.#",
        "#o###.#.###o#",
        "#...........#",
        "#.##.#.#.##.#",
        "#....#.#....#",
        "##.##...##.##",
        "#....###....#",
        "#.##.#.#.##.#",
        "#...........#",
        "#o###.#.###o#",
        "#.###.#.###.#",
        "#...........#",
        "#############",
    ];
    /* Row 6-8 / cols 5-7 form a fully enclosed ghost house: the only way
       in or out is the single door cell at row6,col6. Row 13 is now fully
       open so Pac-Droid starts at the very bottom of the maze. */
    const ROWS = MAZE.length, COLS = MAZE[0].length;
    const canvas = document.getElementById('pacCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = COLS*CS;
    canvas.height = ROWS*CS;
    const scoreEl = document.getElementById('pdScore');
    const livesEl = document.getElementById('pdLives');
    const overlayEl = document.getElementById('pdOverlay');
    const overlayTitleEl = document.getElementById('pdOverlayTitle');
    const overlaySubEl = document.getElementById('pdOverlaySub');

    const DIRS = {
        up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0}, none:{x:0,y:0}
    };

    const GHOST_DEFS = [
        { sprite:()=>spriteNoCommand,  color:'#ff5b5b', name:'NoCommand'  },
        { sprite:()=>spriteUpdate,     color:'#59c1ff', name:'Update'     },
        { sprite:()=>spriteAndroError, color:'#ffb648', name:'AndroError' },
    ];

    let grid, player, ghosts, score, lives, frightTimer, running, over, won, raf, tick;

    function cellAt(col,row){ return grid[row] && grid[row][col]; }
    function isWall(col,row){
        if (row<0||row>=ROWS||col<0||col>=COLS) return true;
        return grid[row][col] === '#';
    }
    function centerPx(col){ return col*CS + CS/2; }
    function centerPy(row){ return row*CS + CS/2; }

    function freshEntity(col,row){
        return { col, row, px:centerPx(col), py:centerPy(row), dir:'none', nextDir:'none' };
    }

    const GHOST_HOUSE = [ {col:5,row:7}, {col:6,row:7}, {col:7,row:7} ];
    const GHOST_RELEASE_FRAMES = 120; // ~2s at 60fps

    function houseGhost(i, def) {
        const spot = GHOST_HOUSE[i];
        return Object.assign(freshEntity(spot.col, spot.row), {
            def, fright:false, released:false, releaseTimer: GHOST_RELEASE_FRAMES
        });
    }

    function resetLevel() {
        grid = MAZE.map(r=>r.split(''));
        player = freshEntity(6,13);
        ghosts = [
            houseGhost(0, GHOST_DEFS[0]),
            houseGhost(1, GHOST_DEFS[1]),
            houseGhost(2, GHOST_DEFS[2]),
        ];
        frightTimer = 0;
        over = false;
        won = false;
    }

    function pacInit() {
        score = 0; lives = 3;
        resetLevel();
        running = false;
        tick = 0;
        overlayTitleEl.textContent = 'Pac-Droid';
        overlaySubEl.textContent = 'Swipe to start';
        overlayEl.classList.remove('hidden');
        updateHud();
        render();
        if (!raf) raf = requestAnimationFrame(loop);
    }
    function pacStart() {
        overlayEl.classList.add('hidden');
        running = true;
    }
    function pacStop() {
        running = false;
        if (raf) { cancelAnimationFrame(raf); raf = null; }
    }

    function updateHud() {
        scoreEl.textContent = 'SCORE ' + score;
        livesEl.innerHTML = '';
        for (let i=0;i<lives;i++) {
            const s = document.createElement('span');
            livesEl.appendChild(s);
        }
    }

    function trySetDir(entity, dirName) {
        entity.nextDir = dirName;
    }

    function stepEntity(entity, speed) {
        const cx = centerPx(entity.col), cy = centerPy(entity.row);
        const alignedX = Math.abs(entity.px-cx) < speed*0.6;
        const alignedY = Math.abs(entity.py-cy) < speed*0.6;
        if (alignedX && alignedY) {
            entity.px = cx; entity.py = cy;
            const nd = DIRS[entity.nextDir];
            if (entity.nextDir!=='none' && !isWall(entity.col+nd.x, entity.row+nd.y)) {
                entity.dir = entity.nextDir;
            }
            const d = DIRS[entity.dir];
            if (entity.dir==='none' || isWall(entity.col+d.x, entity.row+d.y)) {
                entity.dir = 'none';
            }
        }
        const d = DIRS[entity.dir];
        entity.px += d.x*speed;
        entity.py += d.y*speed;
        // tunnel wrap
        if (entity.px < -CS/2) entity.px = COLS*CS + CS/2;
        if (entity.px > COLS*CS + CS/2) entity.px = -CS/2;
        entity.col = Math.round((entity.px-CS/2)/CS);
        entity.row = Math.round((entity.py-CS/2)/CS);
    }

    function ghostChooseDir(g) {
        if (!g.released) return; // stays put in the ghost house until released
        const cx = centerPx(g.col), cy = centerPy(g.row);
        if (Math.abs(g.px-cx) > 2 || Math.abs(g.py-cy) > 2) return; // only decide at cell centers
        const options = [];
        for (const name of ['up','down','left','right']) {
            const d = DIRS[name];
            if (name === opposite(g.dir)) continue; // no reversing (classic ghost behaviour)
            if (!isWall(g.col+d.x, g.row+d.y)) options.push(name);
        }
        if (options.length === 0) { g.nextDir = opposite(g.dir); return; }
        if (g.fright) {
            g.nextDir = options[Math.floor(Math.random()*options.length)];
            return;
        }
        // light chase bias: prefer the direction that reduces distance to player, else random
        let best = options[0], bestDist = Infinity;
        for (const name of options) {
            const d = DIRS[name];
            const nc = g.col+d.x, nr = g.row+d.y;
            const dist = Math.hypot(nc-player.col, nr-player.row);
            const score = dist + (Math.random()*1.5); // small randomness so ghosts aren't perfect
            if (score < bestDist) { bestDist = score; best = name; }
        }
        g.nextDir = best;
    }
    function opposite(dir) {
        return { up:'down', down:'up', left:'right', right:'left', none:'none' }[dir];
    }

    function eatPellets() {
        const c = cellAt(player.col, player.row);
        if (c === '.') {
            grid[player.row][player.col] = ' ';
            score += 10;
        } else if (c === 'o') {
            grid[player.row][player.col] = ' ';
            score += 50;
            frightTimer = 360; // ~6s at 60fps
            ghosts.forEach(g=> g.fright = true);
        }
        updateHud();
        if (!grid.some(r=>r.includes('.')||r.includes('o'))) {
            won = true; endRound(true);
        }
    }

    function checkGhostCollisions() {
        for (const g of ghosts) {
            if (Math.abs(g.px-player.px) < CS*0.6 && Math.abs(g.py-player.py) < CS*0.6) {
                if (g.fright) {
                    g.col = 6; g.row = 7; g.px = centerPx(6); g.py = centerPy(7);
                    g.dir='none'; g.nextDir='none'; g.fright = false;
                    g.released = false; g.releaseTimer = GHOST_RELEASE_FRAMES;
                    score += 200; updateHud();
                } else {
                    lives -= 1;
                    updateHud();
                    if (lives <= 0) { endRound(false); }
                    else {
                        player = freshEntity(6,13);
                        ghosts.forEach((g,i)=> Object.assign(g, houseGhost(i, g.def)));
                        running = false;
                        overlayTitleEl.textContent = 'Caught!';
                        overlaySubEl.textContent = 'Tap to continue — ' + lives + ' lives left';
                        overlayEl.classList.remove('hidden');
                    }
                    return;
                }
            }
        }
    }

    function endRound(win) {
        running = false;
        overlayTitleEl.textContent = win ? 'You win!' : 'Game over';
        overlaySubEl.textContent = 'Score ' + score + ' — tap to play again';
        overlayEl.classList.remove('hidden');
    }

    function update() {
        tick++;
        if (!running) return;
        stepEntity(player, 2.1);
        eatPellets();
        if (frightTimer > 0) {
            frightTimer--;
            if (frightTimer === 0) ghosts.forEach(g=> g.fright=false);
        }
        for (const g of ghosts) {
            if (!g.released) {
                g.releaseTimer--;
                if (g.releaseTimer <= 0) g.released = true;
            }
            ghostChooseDir(g);
            stepEntity(g, g.fright ? 1.0 : 1.4);
        }
        checkGhostCollisions();
    }

    function drawMaze() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0,0,canvas.width,canvas.height);
        for (let r=0;r<ROWS;r++) {
            for (let c=0;c<COLS;c++) {
                const ch = grid[r][c];
                const x = c*CS, y = r*CS;
                if (ch === '#') {
                    ctx.fillStyle = '#1b3a8f';
                    ctx.fillRect(x+2, y+2, CS-4, CS-4);
                } else if (ch === '.') {
                    if (spriteDonut.ready) {
                        const s = CS*0.42;
                        ctx.drawImage(spriteDonut.img, x+CS/2-s/2, y+CS/2-s/2, s, s);
                    } else {
                        ctx.fillStyle = '#ffd54a';
                        ctx.beginPath(); ctx.arc(x+CS/2, y+CS/2, 2.6, 0, Math.PI*2); ctx.fill();
                    }
                } else if (ch === 'o') {
                    if (spriteKitKat.ready) {
                        const s = CS*0.8;
                        ctx.drawImage(spriteKitKat.img, x+CS/2-s/2, y+CS/2-s/2, s, s);
                    } else {
                        ctx.fillStyle = (Math.floor(tick/15)%2===0) ? '#ff5b5b' : '#ffd54a';
                        ctx.beginPath(); ctx.arc(x+CS/2, y+CS/2, 6, 0, Math.PI*2); ctx.fill();
                    }
                }
            }
        }
    }

    function drawPlayer() {
        const s = CS*1.15;
        if (spriteAndroid.ready) {
            ctx.drawImage(spriteAndroid.img, player.px-s/2, player.py-s/2, s, s);
        } else {
            ctx.fillStyle = '#78c257';
            ctx.beginPath();
            const mouth = (Math.floor(tick/6)%2===0) ? 0.22 : 0.02;
            const angles = { up:-Math.PI/2, down:Math.PI/2, left:Math.PI, right:0, none:0 }[player.dir];
            ctx.arc(player.px, player.py, CS*0.42, angles+mouth*Math.PI, angles+(2-mouth)*Math.PI);
            ctx.lineTo(player.px, player.py);
            ctx.closePath();
            ctx.fill();
        }
    }

    function drawGhosts() {
        for (const g of ghosts) {
            const spr = g.def.sprite();
            const s = CS*1.1;
            if (spr.ready) {
                ctx.save();
                if (g.fright) ctx.filter = 'grayscale(0.3) brightness(1.3) hue-rotate(190deg)';
                ctx.drawImage(spr.img, g.px-s/2, g.py-s/2, s, s);
                ctx.restore();
            } else {
                ctx.fillStyle = g.fright ? '#3a5bff' : g.def.color;
                ctx.beginPath();
                ctx.arc(g.px, g.py, CS*0.4, Math.PI, 0);
                ctx.lineTo(g.px+CS*0.4, g.py+CS*0.4);
                ctx.lineTo(g.px+CS*0.2, g.py+CS*0.28);
                ctx.lineTo(g.px, g.py+CS*0.4);
                ctx.lineTo(g.px-CS*0.2, g.py+CS*0.28);
                ctx.lineTo(g.px-CS*0.4, g.py+CS*0.4);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(g.px-6, g.py-4, 3, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(g.px+6, g.py-4, 3, 0, Math.PI*2); ctx.fill();
            }
        }
    }

    function render() {
        drawMaze();
        drawGhosts();
        drawPlayer();
    }

    function loop() {
        update();
        render();
        raf = requestAnimationFrame(loop);
    }

    // controls: swipe on canvas
    let touchStartX=0, touchStartY=0;
    canvas.addEventListener('touchstart', (e)=>{
        const t = e.changedTouches[0];
        touchStartX = t.clientX; touchStartY = t.clientY;
    }, {passive:true});
    canvas.addEventListener('touchend', (e)=>{
        if (!running) { pacStart(); return; }
        const t = e.changedTouches[0];
        const dx = t.clientX-touchStartX, dy = t.clientY-touchStartY;
        if (Math.max(Math.abs(dx),Math.abs(dy)) < 12) return;
        if (Math.abs(dx) > Math.abs(dy)) trySetDir(player, dx>0?'right':'left');
        else trySetDir(player, dy>0?'down':'up');
    }, {passive:true});
    overlayEl.addEventListener('click', ()=> pacStart());
    // controls: keyboard
    document.addEventListener('keydown', (e)=>{
        if (!document.getElementById('screen-pacdroid').classList.contains('active')) return;
        const map = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right' };
        if (map[e.code] || map[e.key]) {
            e.preventDefault();
            if (!running) pacStart();
            trySetDir(player, map[e.code] || map[e.key]);
        }
    });

    window.pacInit = pacInit;
    window.pacStop = pacStop;
})();

/* ===================== GAMEDROID: SNAKE-DROID (classic 2D snake) =====================
   Head sprite: Snake.png. Body segments: Keep_snake.png (repeated for every segment
   added as the snake grows). Food: Donut.png (common, +10) and KitKat.png (rare bonus,
   +50, disappears if not eaten in time). Drop the sprite files next to index.html —
   until then simple placeholder shapes are drawn so the game is already fully playable. */
(function(){
    const CS = 26; // cell size in px, matches Pac-Droid's grid
    const canvas = document.getElementById('snakeCanvas');
    const ctx = canvas.getContext('2d');
    const COLS = 13, ROWS = 15;
    canvas.width = COLS*CS;
    canvas.height = ROWS*CS;
    const scoreEl = document.getElementById('snScore');
    const overlayEl = document.getElementById('snOverlay');
    const overlayTitleEl = document.getElementById('snOverlayTitle');
    const overlaySubEl = document.getElementById('snOverlaySub');

    const DIRS = { up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} };
    const START_INTERVAL = 150; // ms per move at game start
    const MIN_INTERVAL = 80;
    const KITKAT_LIFETIME = 5000; // ms before an uneaten bonus food expires

    let snake, dir, nextDir, food, score, running, over, raf, moveTimer, moveInterval, lastTime, tick;

    function centerPx(col){ return col*CS + CS/2; }
    function centerPy(row){ return row*CS + CS/2; }

    function cellFree(col,row, body){
        return !body.some(s=> s.col===col && s.row===row);
    }

    function spawnFood() {
        let col, row, tries = 0;
        do {
            col = Math.floor(Math.random()*COLS);
            row = Math.floor(Math.random()*ROWS);
            tries++;
        } while (!cellFree(col,row,snake) && tries < 200);
        const kind = Math.random() < 0.18 ? 'kitkat' : 'donut';
        food = { col, row, kind, life: kind==='kitkat' ? KITKAT_LIFETIME : Infinity };
    }

    function resetGame() {
        const startCol = Math.floor(COLS/2), startRow = Math.floor(ROWS/2);
        snake = [
            {col:startCol,   row:startRow},
            {col:startCol-1, row:startRow},
            {col:startCol-2, row:startRow},
        ];
        dir = 'right'; nextDir = 'right';
        score = 0;
        moveInterval = START_INTERVAL;
        moveTimer = 0;
        over = false;
        spawnFood();
    }

    function snakeInit() {
        resetGame();
        running = false;
        tick = 0;
        overlayTitleEl.textContent = 'Snake-Droid';
        overlaySubEl.textContent = 'Swipe to start';
        overlayEl.classList.remove('hidden');
        updateHud();
        render();
        lastTime = performance.now();
        if (!raf) raf = requestAnimationFrame(loop);
    }
    function snakeStart() {
        if (over) { resetGame(); updateHud(); } // after a death, always respawn at the original starting spot
        overlayEl.classList.add('hidden');
        running = true;
        lastTime = performance.now();
    }
    function snakeStop() {
        running = false;
        if (raf) { cancelAnimationFrame(raf); raf = null; }
    }

    function updateHud() {
        scoreEl.textContent = 'SCORE ' + score;
    }

    function trySetDir(name) {
        // ignore direct reversals so the snake can't turn back into itself
        const opp = { up:'down', down:'up', left:'right', right:'left' };
        if (opp[name] === dir) return;
        nextDir = name;
    }

    function step() {
        dir = nextDir;
        const d = DIRS[dir];
        const head = snake[0];
        const newHead = { col: head.col + d.x, row: head.row + d.y };

        if (newHead.col < 0 || newHead.col >= COLS || newHead.row < 0 || newHead.row >= ROWS) {
            return endGame();
        }
        const willEat = food && newHead.col===food.col && newHead.row===food.row;
        const bodyToCheck = willEat ? snake : snake.slice(0, -1); // tail moves away unless growing
        if (!cellFree(newHead.col, newHead.row, bodyToCheck)) {
            return endGame();
        }

        snake.unshift(newHead);
        if (willEat) {
            score += food.kind === 'kitkat' ? 50 : 10;
            moveInterval = Math.max(MIN_INTERVAL, moveInterval - 2);
            updateHud();
            spawnFood();
        } else {
            snake.pop();
        }
    }

    function endGame() {
        over = true;
        running = false;
        overlayTitleEl.textContent = 'Game over';
        overlaySubEl.textContent = 'Score ' + score + ' — tap to play again';
        overlayEl.classList.remove('hidden');
    }

    function update(dt) {
        tick++;
        if (!running) return;
        if (food && food.life !== Infinity) {
            food.life -= dt;
            if (food.life <= 0) spawnFood();
        }
        moveTimer += dt;
        while (moveTimer >= moveInterval && running) {
            moveTimer -= moveInterval;
            step();
        }
    }

    function drawBoard() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0,0,canvas.width,canvas.height);
        // visible boundary — hitting this edge is what ends the game
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ff5252';
        ctx.strokeRect(2, 2, canvas.width-4, canvas.height-4);
    }

    function drawFood() {
        if (!food) return;
        const x = food.col*CS, y = food.row*CS;
        const flash = food.kind === 'kitkat' && food.life < 1500 && Math.floor(tick/8)%2===0;
        if (flash) return; // blink the bonus food as it's about to expire
        if (food.kind === 'donut') {
            if (spriteDonut.ready) {
                const s = CS*0.8;
                ctx.drawImage(spriteDonut.img, x+CS/2-s/2, y+CS/2-s/2, s, s);
            } else {
                ctx.fillStyle = '#ffd54a';
                ctx.beginPath(); ctx.arc(x+CS/2, y+CS/2, CS*0.32, 0, Math.PI*2); ctx.fill();
            }
        } else {
            if (spriteKitKat.ready) {
                const s = CS*0.85;
                ctx.drawImage(spriteKitKat.img, x+CS/2-s/2, y+CS/2-s/2, s, s);
            } else {
                ctx.fillStyle = '#59c1ff';
                ctx.beginPath(); ctx.arc(x+CS/2, y+CS/2, CS*0.36, 0, Math.PI*2); ctx.fill();
            }
        }
    }

    function angleForDir(name) {
        return { up:-Math.PI/2, down:Math.PI/2, left:Math.PI, right:0 }[name] || 0;
    }

    function drawSnake() {
        for (let i = snake.length-1; i >= 0; i--) {
            const seg = snake[i];
            const x = centerPx(seg.col), y = centerPy(seg.row);
            if (i === 0) {
                const s = CS*1.15;
                if (spriteSnakeHead.ready) {
                    ctx.save();
                    ctx.translate(x,y);
                    ctx.rotate(angleForDir(dir));
                    ctx.drawImage(spriteSnakeHead.img, -s/2, -s/2, s, s);
                    ctx.restore();
                } else {
                    ctx.fillStyle = '#78c257';
                    ctx.beginPath(); ctx.arc(x, y, CS*0.46, 0, Math.PI*2); ctx.fill();
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = 'rgba(12,17,22,0.55)';
                    ctx.stroke();
                    ctx.fillStyle = '#0c1116';
                    const ed = DIRS[dir];
                    ctx.beginPath(); ctx.arc(x+ed.x*CS*0.2, y+ed.y*CS*0.2, 2.6, 0, Math.PI*2); ctx.fill();
                }
            } else {
                const s = CS*0.92;
                const r = CS*0.38;
                if (spriteSnakeBody.ready) {
                    ctx.drawImage(spriteSnakeBody.img, x-s/2, y-s/2, s, s);
                } else {
                    ctx.fillStyle = i % 2 === 0 ? '#5aa93f' : '#4c9134';
                    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x-r, y-r, r*2, r*2, 6) : ctx.rect(x-r, y-r, r*2, r*2);
                    ctx.fill();
                }
                // outline every segment so adjacent body parts stay visually distinct
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'rgba(12,17,22,0.55)';
                ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x-r, y-r, r*2, r*2, 6) : ctx.rect(x-r, y-r, r*2, r*2);
                ctx.stroke();
            }
        }
    }

    function render() {
        drawBoard();
        drawFood();
        drawSnake();
    }

    function loop(now) {
        const dt = Math.min(100, now - lastTime); // clamp to avoid huge jumps (tab switches etc)
        lastTime = now;
        update(dt);
        render();
        raf = requestAnimationFrame(loop);
    }

    // controls: swipe on canvas
    let touchStartX=0, touchStartY=0;
    canvas.addEventListener('touchstart', (e)=>{
        const t = e.changedTouches[0];
        touchStartX = t.clientX; touchStartY = t.clientY;
    }, {passive:true});
    canvas.addEventListener('touchend', (e)=>{
        if (!running) { snakeStart(); return; }
        const t = e.changedTouches[0];
        const dx = t.clientX-touchStartX, dy = t.clientY-touchStartY;
        if (Math.max(Math.abs(dx),Math.abs(dy)) < 12) return;
        if (Math.abs(dx) > Math.abs(dy)) trySetDir(dx>0?'right':'left');
        else trySetDir(dy>0?'down':'up');
    }, {passive:true});
    overlayEl.addEventListener('click', ()=> snakeStart());
    // controls: keyboard
    document.addEventListener('keydown', (e)=>{
        if (!document.getElementById('screen-snake').classList.contains('active')) return;
        const map = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right' };
        const name = map[e.code] || map[e.key];
        if (name) {
            e.preventDefault();
            if (!running) snakeStart();
            trySetDir(name);
        }
    });

    window.snakeInit = snakeInit;
    window.snakeStop = snakeStop;
})();

/* ===================== GAMEDROID: FLAPPY DROID (flappy-bird style) =====================
   Player sprite: reuses android.png (same droid as Pac-Droid/dino runner) — drop a
   dedicated FlappyDroid.png/.jpg next to index.html later if you want a different look,
   it isn't wired to a separate file so android.png is used automatically. Pipes use
   Pipe.png if present, otherwise a flat green placeholder pipe is drawn. */
(function(){
    const canvas = document.getElementById('flappyCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const scoreEl = document.getElementById('flScore');
    const overlayEl = document.getElementById('flOverlay');
    const overlayTitleEl = document.getElementById('flOverlayTitle');
    const overlaySubEl = document.getElementById('flOverlaySub');

    const GRAVITY = 0.38;
    const FLAP_VY = -6.6;
    const BIRD_SIZE = 30;
    const BIRD_X = W*0.28;
    const PIPE_W = 52;
    const GAP_START = 150;
    const GAP_MIN = 108;
    const PIPE_SPEED_START = 2.2;
    const PIPE_SPEED_MAX = 4.2;
    const PIPE_INTERVAL = 105; // frames between pipes at start

    let birdY, birdVy, pipes, score, running, over, raf, frame, pipeSpeed, pipeGap, nextPipeIn, started;

    function resetGame() {
        birdY = H/2;
        birdVy = 0;
        pipes = [];
        score = 0;
        pipeSpeed = PIPE_SPEED_START;
        pipeGap = GAP_START;
        nextPipeIn = 60;
        frame = 0;
        over = false;
        started = false;
    }

    function flappyInit() {
        resetGame();
        running = false;
        overlayTitleEl.textContent = 'Flappy Droid';
        overlaySubEl.textContent = 'Tap to fly';
        overlayEl.classList.remove('hidden');
        updateHud();
        render();
        if (!raf) raf = requestAnimationFrame(loop);
    }
    function flappyStart() {
        if (over) resetGame();
        overlayEl.classList.add('hidden');
        running = true;
        started = true;
        flap();
    }
    function flappyStop() {
        running = false;
        if (raf) { cancelAnimationFrame(raf); raf = null; }
    }
    function flap() {
        birdVy = FLAP_VY;
    }

    function updateHud() {
        scoreEl.textContent = 'SCORE ' + score;
    }

    function spawnPipe() {
        const margin = 40;
        const gapY = margin + Math.random()*(H - margin*2 - pipeGap);
        pipes.push({ x: W, gapY, passed:false });
    }

    function endGame() {
        over = true;
        running = false;
        overlayTitleEl.textContent = 'Game over';
        overlaySubEl.textContent = 'Score ' + score + ' — tap to try again';
        overlayEl.classList.remove('hidden');
    }

    function update() {
        if (!running) return;
        frame++;
        birdVy += GRAVITY;
        birdY += birdVy;

        if (birdY - BIRD_SIZE/2 < 0) { birdY = BIRD_SIZE/2; birdVy = 0; }
        if (birdY + BIRD_SIZE/2 > H) return endGame();

        nextPipeIn--;
        if (nextPipeIn <= 0) {
            spawnPipe();
            nextPipeIn = PIPE_INTERVAL;
        }

        for (const p of pipes) {
            p.x -= pipeSpeed;
            if (!p.passed && p.x + PIPE_W < BIRD_X) {
                p.passed = true;
                score++;
                pipeSpeed = Math.min(PIPE_SPEED_MAX, pipeSpeed + 0.06);
                pipeGap = Math.max(GAP_MIN, pipeGap - 1.5);
                updateHud();
            }
            const birdLeft = BIRD_X - BIRD_SIZE/2, birdRight = BIRD_X + BIRD_SIZE/2;
            const birdTop = birdY - BIRD_SIZE/2, birdBottom = birdY + BIRD_SIZE/2;
            const overlapsX = birdRight > p.x && birdLeft < p.x + PIPE_W;
            if (overlapsX) {
                const gapTop = p.gapY, gapBottom = p.gapY + pipeGap;
                if (birdTop < gapTop || birdBottom > gapBottom) return endGame();
            }
        }
        pipes = pipes.filter(p => p.x + PIPE_W > -5);
    }

    function drawPipe(p) {
        const topH = p.gapY, botY = p.gapY + pipeGap, botH = H - botY;
        if (spritePipe.ready) {
            ctx.save(); ctx.translate(p.x, topH); ctx.scale(1,-1);
            ctx.drawImage(spritePipe.img, 0, 0, PIPE_W, topH);
            ctx.restore();
            ctx.drawImage(spritePipe.img, p.x, botY, PIPE_W, botH);
        } else {
            ctx.fillStyle = '#4cae4c';
            ctx.fillRect(p.x, 0, PIPE_W, topH);
            ctx.fillRect(p.x, botY, PIPE_W, botH);
            ctx.fillStyle = '#3d8b3d';
            ctx.fillRect(p.x-3, topH-14, PIPE_W+6, 14);
            ctx.fillRect(p.x-3, botY, PIPE_W+6, 14);
        }
    }

    function render() {
        ctx.fillStyle = '#4ec0e9';
        ctx.fillRect(0,0,W,H);
        for (const p of pipes) drawPipe(p);
        // ground line
        ctx.fillStyle = '#c9a24b';
        ctx.fillRect(0, H-10, W, 10);

        const angle = Math.max(-0.5, Math.min(0.9, birdVy*0.08));
        if (spriteAndroid.ready) {
            ctx.save();
            ctx.translate(BIRD_X, birdY);
            ctx.rotate(angle);
            ctx.drawImage(spriteAndroid.img, -BIRD_SIZE/2, -BIRD_SIZE/2, BIRD_SIZE, BIRD_SIZE);
            ctx.restore();
        } else {
            ctx.save();
            ctx.translate(BIRD_X, birdY);
            ctx.rotate(angle);
            ctx.fillStyle = '#78c257';
            ctx.beginPath(); ctx.arc(0,0,BIRD_SIZE/2,0,Math.PI*2); ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(12,17,22,0.55)'; ctx.stroke();
            ctx.fillStyle = '#0c1116';
            ctx.beginPath(); ctx.arc(BIRD_SIZE*0.18,-BIRD_SIZE*0.08,2.6,0,Math.PI*2); ctx.fill();
            ctx.restore();
        }
    }

    function loop() {
        update();
        render();
        raf = requestAnimationFrame(loop);
    }

    // controls: tap/click and swipe-up on canvas
    canvas.addEventListener('touchstart', (e)=>{
        e.preventDefault();
        if (!running) { flappyStart(); return; }
        flap();
    }, {passive:false});
    canvas.addEventListener('mousedown', ()=>{
        if (!running) { flappyStart(); return; }
        flap();
    });
    overlayEl.addEventListener('click', ()=> flappyStart());
    document.addEventListener('keydown', (e)=>{
        if (!document.getElementById('screen-flappy').classList.contains('active')) return;
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault();
            if (!running) flappyStart();
            else flap();
        }
    });

    window.flappyInit = flappyInit;
    window.flappyStop = flappyStop;
})();

/* ===================== GALLERY =====================
   Thumbnails/full photos: Photo.jpg, Photo2.jpg, Photo3.jpg ... Photo10.jpg — drop them
   next to index.html. Until they're added each tile just shows a placeholder icon with
   its expected filename so it's obvious what's still missing. */
(function(){
    const PHOTOS = ['Photo.jpg','Photo2.jpg','Photo3.jpg','Photo4.jpg','Photo5.jpg',
                     'Photo6.jpg','Photo7.jpg','Photo8.jpg','Photo9.jpg','Photo10.jpg'];

    const gridEl = document.getElementById('galleryGrid');
    const viewerEl = document.getElementById('galleryViewer');
    const viewerImgEl = document.getElementById('galleryViewerImg');
    const viewerCountEl = document.getElementById('galleryViewerCount');
    const viewerStageEl = document.getElementById('galleryViewerStage');
    const closeBtn = document.getElementById('galleryCloseBtn');

    let gridBuilt = false;
    let currentIndex = 0;

    function renderGalleryGrid() {
        if (gridBuilt) return;
        gridBuilt = true;
        PHOTOS.forEach((file, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'gallery-thumb';
            btn.innerHTML = `
                <img src="${file}" alt="" onerror="this.parentElement.classList.add('img-missing'); this.style.display='none';">
                <span class="gt-fallback">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#7a838a" stroke-width="1.4"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 16l-5.5-5.5L9 17"/></svg>
                    <span>${file}</span>
                </span>`;
            btn.addEventListener('click', () => openGalleryViewer(i));
            gridEl.appendChild(btn);
        });
    }

    function openGalleryViewer(index) {
        currentIndex = index;
        updateViewerImage();
        viewerEl.classList.add('open');
    }
    function closeGalleryViewer() {
        viewerEl.classList.remove('open');
    }
    function galleryViewerOpen() {
        return viewerEl.classList.contains('open');
    }
    function updateViewerImage() {
        viewerImgEl.src = PHOTOS[currentIndex];
        viewerCountEl.textContent = (currentIndex+1) + ' / ' + PHOTOS.length;
    }
    function showNext() {
        currentIndex = (currentIndex + 1) % PHOTOS.length;
        updateViewerImage();
    }
    function showPrev() {
        currentIndex = (currentIndex - 1 + PHOTOS.length) % PHOTOS.length;
        updateViewerImage();
    }

    closeBtn.addEventListener('click', closeGalleryViewer);

    // controls: swipe left/right on the fullscreen viewer
    let touchStartX = 0, touchStartY = 0;
    viewerStageEl.addEventListener('touchstart', (e)=>{
        const t = e.changedTouches[0];
        touchStartX = t.clientX; touchStartY = t.clientY;
    }, {passive:true});
    viewerStageEl.addEventListener('touchend', (e)=>{
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStartX, dy = t.clientY - touchStartY;
        if (Math.abs(dx) < 30 || Math.abs(dx) < Math.abs(dy)) return;
        if (dx < 0) showNext(); else showPrev();
    }, {passive:true});
    // keyboard left/right when viewer is open
    document.addEventListener('keydown', (e)=>{
        if (!galleryViewerOpen()) return;
        if (e.key === 'ArrowRight') showNext();
        else if (e.key === 'ArrowLeft') showPrev();
        else if (e.key === 'Escape') closeGalleryViewer();
    });

    window.renderGalleryGrid = renderGalleryGrid;
    window.closeGalleryViewer = closeGalleryViewer;
    window.galleryViewerOpen = galleryViewerOpen;
})();
