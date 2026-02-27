import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, get } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

// --- FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyCZdeKjQKRcOiodHWA8sc4TkGH-6XiTv0g",
    authDomain: "weekcord.firebaseapp.com",
    databaseURL: "https://weekcord-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "weekcord",
    storageBucket: "weekcord.firebasestorage.app",
    messagingSenderId: "194115679478",
    appId: "1:194115679478:web:1df6f7a62e1d3e60e368d7"
};

// Initialize
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// --- SESLER ---
const sounds = {
    msg: new Audio('sounds/message.mp3'),
    call: new Audio('sounds/call.mp3'),
    mute: new Audio('sounds/mute.mp3'),
    unmute: new Audio('sounds/unmute.mp3'),
    deafen: new Audio('sounds/deafen.mp3'),
    undeafen: new Audio('sounds/undeafen.mp3')
};
sounds.call.loop = true;

let currentUser = null;
let isMuted = false;
let isDeafened = false;

// --- GİRİŞ / KAYIT ---
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');

registerBtn.onclick = async () => {
    const user = document.getElementById('usernameInput').value.trim();
    const pass = document.getElementById('passwordInput').value;
    if(!user || pass.length < 6) return alert("Kullanıcı adı girin ve şifre en az 6 karakter olsun!");

    try {
        // Kullanıcı adı kontrolü
        const userCheck = await get(ref(db, 'users/' + user));
        if(userCheck.exists()) return alert("Bu kullanıcı adı zaten alınmış!");

        await createUserWithEmailAndPassword(auth, user + "@weekcord.com", pass);
        await set(ref(db, 'users/' + user), { username: user, lastLogin: Date.now() });
        alert("Kayıt başarılı! Giriş yapabilirsiniz.");
    } catch (e) { alert("Hata: " + e.message); }
};

loginBtn.onclick = async () => {
    const user = document.getElementById('usernameInput').value.trim();
    const pass = document.getElementById('passwordInput').value;
    try {
        await signInWithEmailAndPassword(auth, user + "@weekcord.com", pass);
        currentUser = user;
        update(ref(db, 'users/' + user), { lastLogin: Date.now() });
        showApp();
    } catch (e) { alert("Giriş başarısız!"); }
};

// --- OTURUM TAKİBİ (30 GÜN KURALI) ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const username = user.email.split('@')[0];
        const snapshot = await get(ref(db, 'users/' + username));
        if (snapshot.exists()) {
            const lastLogin = snapshot.val().lastLogin;
            if (Date.now() - lastLogin > 30 * 24 * 60 * 60 * 1000) {
                alert("Oturum süresi doldu (30 gün).");
                logout();
            } else {
                currentUser = username;
                showApp();
            }
        }
    } else {
        showAuth();
    }
});

// --- MESAJLAŞMA ---
const chatForm = document.getElementById('chatForm');
chatForm.onsubmit = (e) => {
    e.preventDefault();
    const input = document.getElementById('messageInput');
    if(!input.value.trim()) return;

    push(ref(db, 'messages'), {
        sender: currentUser,
        text: input.value,
        timestamp: Date.now()
    });
    input.value = '';
};

// Mesajları Dinle
onValue(ref(db, 'messages'), (snapshot) => {
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';
    snapshot.forEach(child => {
        const msg = child.val();
        const div = document.createElement('div');
        div.className = 'message';
        div.innerHTML = `
            <div class="friend-avatar">${msg.sender[0].toUpperCase()}</div>
            <div class="message-content">
                <h4>${msg.sender} <span>${new Date(msg.timestamp).toLocaleTimeString()}</span></h4>
                <p>${msg.text}</p>
            </div>
        `;
        container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
    if(currentUser && !isDeafened) sounds.msg.play().catch(() => {});
});

// --- SES KONTROLLERİ ---
document.getElementById('muteBtn').onclick = () => {
    isMuted = !isMuted;
    document.getElementById('muteBtn').classList.toggle('active-mute', isMuted);
    isMuted ? sounds.mute.play() : sounds.unmute.play();
};

document.getElementById('deafenBtn').onclick = () => {
    isDeafened = !isDeafened;
    document.getElementById('deafenBtn').classList.toggle('active-mute', isDeafened);
    isDeafened ? sounds.deafen.play() : sounds.undeafen.play();
};

document.getElementById('startCallBtn').onclick = () => {
    document.getElementById('call-overlay').style.display = 'flex';
    sounds.call.play();
};

document.getElementById('endCallBtn').onclick = () => {
    document.getElementById('call-overlay').style.display = 'none';
    sounds.call.pause();
    sounds.call.currentTime = 0;
};

// --- YARDIMCI FONKSİYONLAR ---
function showApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
    document.getElementById('myUsernameDisplay').innerText = currentUser;
    document.getElementById('myAvatar').innerText = currentUser[0].toUpperCase();
    document.getElementById('callMyAvatar').innerText = currentUser[0].toUpperCase();
}

function showAuth() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
}

function logout() {
    signOut(auth);
}
document.getElementById('logoutBtn').onclick = logout;