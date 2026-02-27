import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";
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

// --- GİRİŞ KONTROLLERİ ---
setPersistence(auth, browserLocalPersistence); // F5 atınca çıkış yapmaz

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const username = user.email.split('@')[0];
        const userRef = ref(db, 'users/' + username);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            const lastLogin = snapshot.val().lastLogin || 0;
            // 30 Gün Kuralı
            if (Date.now() - lastLogin > (30 * 24 * 60 * 60 * 1000)) {
                alert("Oturumun süresi doldu, tekrar giriş yap.");
                signOut(auth);
            } else {
                currentUser = username;
                update(userRef, { lastLogin: Date.now() });
                showApp();
                loadSidebar();
            }
        }
    } else {
        showAuth();
    }
});

// Kayıt Ol
document.getElementById('registerBtn').onclick = async () => {
    const user = document.getElementById('usernameInput').value.trim();
    const pass = document.getElementById('passwordInput').value;
    try {
        await createUserWithEmailAndPassword(auth, user + "@week.com", pass);
        await set(ref(db, 'users/' + user), { username: user, lastLogin: Date.now(), botAdded: false });
        alert("Hesap oluşturuldu! Şimdi giriş yapabilirsin.");
    } catch (e) { alert("Hata: " + e.message); }
};

// Giriş Yap
document.getElementById('loginBtn').onclick = async () => {
    const user = document.getElementById('usernameInput').value.trim();
    const pass = document.getElementById('passwordInput').value;
    try {
        await signInWithEmailAndPassword(auth, user + "@week.com", pass);
    } catch (e) { alert("Giriş bilgileri yanlış!"); }
};

// --- SİDEBAR & BOT MANTIĞI ---
async function loadSidebar() {
    const container = document.getElementById('friendListContainer');
    const userSnapshot = await get(ref(db, 'users/' + currentUser));
    const isBotAdded = userSnapshot.val().botAdded;

    container.innerHTML = '';

    if (!isBotAdded) {
        container.innerHTML = `
            <div style="padding:10px; text-align:center;">
                <p style="font-size:11px; color:#8e9297;">Hiç arkadaşın yok...</p>
                <button id="addBotBtn" style="background:#3ba55c; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; margin-top:5px;">Week Bot Ekle</button>
            </div>`;
        document.getElementById('addBotBtn').onclick = async () => {
            await update(ref(db, 'users/' + currentUser), { botAdded: true });
            loadSidebar();
        };
    } else {
        const div = document.createElement('div');
        div.className = 'friend-item';
        div.style.padding = "10px";
        div.style.cursor = "pointer";
        div.innerHTML = `<span>Week Bot 🤖</span>`;
        div.onclick = () => openChat("Week Bot");
        container.appendChild(div);
    }
}

function openChat(name) {
    document.getElementById('currentChatName').innerText = name;
    document.getElementById('chatInputWrapper').classList.remove('input-locked');
    document.getElementById('messageInput').placeholder = name + " kişisine mesaj gönder";
    document.getElementById('welcome-message').style.display = 'none';
    // Bot sohbetini başlat
    if(name === "Week Bot") startBotConvo();
}

function showApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
    document.getElementById('myUsernameDisplay').innerText = currentUser;
}

function showAuth() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
}

// Çıkış Yap
document.getElementById('logoutBtn').onclick = () => signOut(auth);
