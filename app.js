import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, get, update } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

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
let currentChat = null;

// --- GİRİŞ VE PERSISTENCE (F5 Koruması) ---
// Tarayıcı kapatılsa bile girişi hatırlar
setPersistence(auth, browserLocalPersistence);

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const username = user.email.split('@')[0];
        const userRef = ref(db, 'users/' + username);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            const lastLogin = snapshot.val().lastLogin || 0;
            const thirtyDays = 30 * 24 * 60 * 60 * 1000;

            // 30 Gün Kontrolü
            if (Date.now() - lastLogin > thirtyDays) {
                alert("Oturum süresi doldu (30 gün). Lütfen tekrar giriş yapın.");
                signOut(auth);
            } else {
                currentUser = username;
                update(userRef, { lastLogin: Date.now() }); // Giriş vaktini güncelle
                showApp();
                checkBotStatus(); // Bot ekli mi kontrol et
            }
        }
    } else {
        showAuth();
    }
});

// Kayıt Ol Butonu Fix
document.getElementById('registerBtn').addEventListener('click', async () => {
    const user = document.getElementById('usernameInput').value.trim();
    const pass = document.getElementById('passwordInput').value;
    if(!user || pass.length < 6) return alert("Bilgileri kontrol edin!");
    
    try {
        await createUserWithEmailAndPassword(auth, user + "@week.com", pass);
        await set(ref(db, 'users/' + user), { 
            username: user, 
            lastLogin: Date.now(),
            botAdded: false 
        });
        alert("Kayıt başarılı!");
    } catch (e) { alert("Hata: " + e.message); }
});

// Giriş Yap Butonu Fix
document.getElementById('loginBtn').addEventListener('click', async () => {
    const user = document.getElementById('usernameInput').value.trim();
    const pass = document.getElementById('passwordInput').value;
    try {
        await signInWithEmailAndPassword(auth, user + "@week.com", pass);
    } catch (e) { alert("Giriş bilgileri hatalı!"); }
});

// --- BOT VE SOHBET KİLİDİ ---
const inputWrapper = document.getElementById('chatInputWrapper');
const messageInput = document.getElementById('messageInput');

// Başlangıçta sohbeti kilitle
inputWrapper.classList.add('input-locked');

async function checkBotStatus() {
    const snapshot = await get(ref(db, 'users/' + currentUser + '/botAdded'));
    renderFriends(snapshot.val());
}

function renderFriends(isBotAdded) {
    const container = document.getElementById('friendListContainer');
    container.innerHTML = '';

    if (!isBotAdded) {
        // Bot ekleme daveti
        container.innerHTML = `<div id="bot-invite">... (Bot ekleme kutusu) ...</div>`;
        document.getElementById('addBotBtn').onclick = async () => {
            await update(ref(db, 'users/' + currentUser), { botAdded: true });
            renderFriends(true);
        };
    } else {
        // Botu listeye ekle
        const div = document.createElement('div');
        div.className = 'friend-item';
        div.onclick = () => {
            currentChat = "Week Bot";
            document.getElementById('currentChatName').innerText = "Week Bot ile Sohbet";
            inputWrapper.classList.remove('input-locked'); // Kilidi aç
            messageInput.placeholder = "Week Bot'a mesaj gönder...";
            openBotChat();
        };
        div.innerHTML = `<span>Week Bot</span>`;
        container.appendChild(div);
    }
}

function showApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
}

function showAuth() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
}
