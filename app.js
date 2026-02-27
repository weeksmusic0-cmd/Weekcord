import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getDatabase, ref, push, onValue, get, update } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCZdeKjQKRcOiodHWA8sc4TkGH-6XiTv0g",
    authDomain: "weekcord.firebaseapp.com",
    databaseURL: "https://weekcord-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "weekcord",
    storageBucket: "weekcord.firebasestorage.app",
    messagingSenderId: "194115679478",
    appId: "1:194115679478:web:1df6f7a62e1d3e60e368d7"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let currentUser = null;
let isBotAdded = false;
let isMuted = false;
let isDeafened = false;

const sounds = {
    msg: new Audio('sounds/message.mp3'),
    mute: new Audio('sounds/mute.mp3'),
    unmute: new Audio('sounds/unmute.mp3')
};

// --- AUTH İŞLEMLERİ ---
document.getElementById('registerBtn').onclick = async () => {
    const user = document.getElementById('usernameInput').value.trim();
    const pass = document.getElementById('passwordInput').value;
    try {
        await createUserWithEmailAndPassword(auth, user + "@week.com", pass);
        await update(ref(db, 'users/' + user), { username: user, lastLogin: Date.now() });
        alert("Kayıt başarılı!");
    } catch (e) { alert("Hata: " + e.message); }
};

document.getElementById('loginBtn').onclick = async () => {
    const user = document.getElementById('usernameInput').value.trim();
    const pass = document.getElementById('passwordInput').value;
    try {
        await signInWithEmailAndPassword(auth, user + "@week.com", pass);
        currentUser = user;
        showApp();
    } catch (e) { alert("Giriş başarısız!"); }
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user.email.split('@')[0];
        showApp();
        loadFriends();
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app-screen').style.display = 'none';
    }
});

// --- ARKADAŞ LİSTESİ VE BOT ---
function loadFriends() {
    const container = document.getElementById('friendListContainer');
    container.innerHTML = '';

    if (!isBotAdded) {
        container.innerHTML = `
            <div style="padding:15px; text-align:center;" id="bot-invite-box">
                <p style="font-size:12px; color:#8e9297; margin-bottom:8px;">Hiç arkadaşın yok... Ama bir seçeneğin var!</p>
                <div class="friend-item" style="background:#2f3136; justify-content:space-between; margin:0;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="friend-avatar" style="background:#5865f2">W</div>
                        <span style="font-size:13px;">Week Bot</span>
                    </div>
                    <button id="addBotBtn" style="background:#3ba55c; color:white; border:none; padding:4px 8px; border-radius:4px; font-size:10px; cursor:pointer;">Arkadaş Ekle</button>
                </div>
            </div>`;
        
        document.getElementById('addBotBtn').onclick = () => {
            isBotAdded = true;
            document.getElementById('addBotBtn').innerText = "Arkadaş";
            document.getElementById('addBotBtn').style.background = "#5865f2";
            setTimeout(loadFriends, 600);
        };
    } else {
        const div = document.createElement('div');
        div.className = 'friend-item fade-in';
        div.onclick = () => openBotChat();
        div.innerHTML = `<div class="friend-avatar" style="background:#5865f2">W</div> <span>Week Bot <span class="bot-tag">BOT</span></span>`;
        container.appendChild(div);
    }
}

// --- BOT SOHBET MANTIĞI ---
const botRepliesPositive = [
    "Harika! Bunu duyduğuma çok sevindim. ✨", "Mükemmel! Günün nasıl geçiyor?", "Süper! Enerjin bana da geçti.",
    "Böyle devam et! Harikasın.", "Gülümsemen eksik olmasın!", "Çok sevindim, peki ya planların ne?",
    "Harika bir haber bu! 🎉", "Keyfin yerindeyse ben de iyiyim.", "Bomba gibisin!", "Harika! Bugün şanslı günün mü?",
    "Çok iyi! Peki ya seni ne bu kadar mutlu etti?", "Huzur gibisi yok, çok sevindim.", "İnanılmaz! Günün geri kalanı daha iyi olsun.",
    "Şahane! Kahveni aldın mı?", "Çok güzel! Seninle sohbet etmek keyifli.", "Enerjin harika, böyle kal!",
    "Ne mutlu sana! Keyfini çıkar.", "Güzel! Peki ya bir şarkı açalım mı?", "Harika gidiyorsun.", "Keyfin daim olsun dostum.",
    "Çok sevindim! Bugün senin günün.", "Harika! Başarıların devamını dilerim.", "Günün aydın olsun, çok iyi!",
    "Müthiş! Bir kutlama yapmalıyız.", "Sevinçten uçuyorum senin adına!", "İşte bu! Tam istediğim cevap.",
    "Harika! Yarın için de böyle ol.", "Çok pozitifsin, bayıldım!", "Böyle devam, moralin hiç bozulmasın.", "Mükemmel! Sohbetine doyum olmaz."
];

const botRepliesNegative = [
    "Üzüldüm... Gel bir sarılalım. 🤗", "Her şey geçecek, yanındayım.", "Bazen kötü günler olur, unutma.",
    "Seni dinlemeye hazırım, anlatmak ister misin?", "Moralini bozma, yarın yeni bir gün.", "Sana bir şarkı önermemi ister misin?",
    "Yalnız değilsin, ben buradayım.", "Biraz dinlenmek iyi gelebilir.", "Olur öyle, canını sıkma.",
    "Üzülme, her inişin bir çıkışı vardır.", "Sana nasıl yardımcı olabilirim?", "Biraz hava almak ister misin?",
    "Geçecek dostum, söz veriyorum.", "Kötü günler gelip geçicidir.", "Seni anlıyorum, zor bir gün olmalı.",
    "Canın sağ olsun, her şey düzelir.", "Kendine zaman tanı, acele etme.", "Moralini yükseltmek için buradayım.",
    "Biraz uyu istersen, sabah daha iyi olur.", "Üzülme, sen çok değerlisin.", "Hadi gel biraz dertleşelim.",
    "Bazen ağlamak bile iyi gelir.", "Sen güçlü birisin, bunu da atlatırsın.", "Moralin bozuksa sevdiğin bir şeyi yap.",
    "Seni çok iyi anlıyorum, üzülme.", "Her karanlığın sonu aydınlıktır.", "Yüzünü asma, güneş yine doğacak.",
    "Sana destek olmak için buradayım.", "Canını sıkan ne varsa anlatabilirsin.", "Üzülme, hayat sürprizlerle dolu."
];

function openBotChat() {
    document.getElementById('currentChatName').innerText = "Week Bot ile Sohbet";
    document.getElementById('messagesContainer').innerHTML = '';
    document.getElementById('bot-options-container').style.display = 'flex';
    
    sendBotMessage("Selam! Ben Week Bot. Bugün nasılsın?");
    showOptions(["İyiyim, sen nasılsın?", "Bu aralar biraz kötüyüm :("]);
}

function showOptions(options) {
    const container = document.getElementById('bot-options-container');
    container.innerHTML = '';
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'bot-option-btn fade-in';
        btn.innerText = opt;
        btn.onclick = () => handleChoice(opt);
        container.appendChild(btn);
    });
}

function handleChoice(choice) {
    appendLocalMessage(currentUser, choice);
    const isPositive = choice.includes("İyiyim");
    const reply = isPositive 
        ? botRepliesPositive[Math.floor(Math.random() * botRepliesPositive.length)]
        : botRepliesNegative[Math.floor(Math.random() * botRepliesNegative.length)];
    
    setTimeout(() => sendBotMessage(reply), 1000);
}

function sendBotMessage(text) {
    const container = document.getElementById('messagesContainer');
    const div = document.createElement('div');
    div.className = 'message fade-in';
    div.innerHTML = `
        <div class="friend-avatar" style="background:#5865f2">W</div>
        <div class="message-content">
            <h4>Week Bot <span class="bot-tag">BOT</span></h4>
            <p>${text}</p>
        </div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    sounds.msg.play().catch(()=>{});
}

function appendLocalMessage(sender, text) {
    const container = document.getElementById('messagesContainer');
    const div = document.createElement('div');
    div.className = 'message';
    div.innerHTML = `<div class="friend-avatar">${sender[0]}</div><div class="message-content"><h4>${sender}</h4><p>${text}</p></div>`;
    container.appendChild(div);
}

// --- SES KONTROLLERİ ---
document.getElementById('muteBtn').onclick = () => {
    isMuted = !isMuted;
    document.getElementById('muteBtn').classList.toggle('active-mute', isMuted);
    isMuted ? sounds.mute.play() : sounds.unmute.play();
};

document.getElementById('deafenBtn').onclick = () => {
    isDeafened = !isDeafened;
    document.getElementById('deafenBtn').classList.toggle('active-mute', isDeafened);
    isDeafened ? sounds.mute.play() : sounds.unmute.play();
};

// --- YARDIMCI ---
function showApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
    document.getElementById('myUsernameDisplay').innerText = currentUser;
    document.getElementById('myAvatar').innerText = currentUser[0].toUpperCase();
}

document.getElementById('logoutBtn').onclick = () => signOut(auth);
