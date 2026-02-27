import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, get, remove, onChildAdded } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";
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
let activeChatUser = null;
let localStream, peerConnection;
const servers = { iceServers: [{ urls: ['stun:stun1.l.google.com:19302'] }] };

// --- AUTH ---
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');

registerBtn.onclick = async () => {
    const user = document.getElementById('usernameInput').value.trim();
    const pass = document.getElementById('passwordInput').value;
    if(!user || pass.length < 6) return alert("Hata!");
    try {
        await createUserWithEmailAndPassword(auth, user + "@weekcord.com", pass);
        await set(ref(db, 'users/' + user), { username: user, lastLogin: Date.now() });
        alert("Başarılı!");
    } catch (e) { alert(e.message); }
};

loginBtn.onclick = async () => {
    const user = document.getElementById('usernameInput').value.trim();
    const pass = document.getElementById('passwordInput').value;
    try {
        await signInWithEmailAndPassword(auth, user + "@weekcord.com", pass);
        currentUser = user;
        showApp();
    } catch (e) { alert("Giriş Hatalı!"); }
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user.email.split('@')[0];
        showApp();
        listenForFriendRequests();
        checkFriends();
        listenForCalls();
    } else {
        showAuth();
    }
});

// --- ARKADAŞLIK SİSTEMİ ---
function listenForFriendRequests() {
    onChildAdded(ref(db, `friend_requests/${currentUser}`), (snapshot) => {
        showFriendRequestPopup(snapshot.key);
    });
}

function showFriendRequestPopup(requester) {
    const container = document.getElementById('notification-container');
    const popup = document.createElement('div');
    popup.className = 'friend-request-popup';
    popup.innerHTML = `
        <div><strong>Arkadaşlık İsteği:</strong><br>${requester}</div>
        <div class="req-actions">
            <button class="yes">✅</button>
            <button class="no">❌</button>
        </div>
    `;
    container.appendChild(popup);

    popup.querySelector('.yes').onclick = async () => {
        await remove(ref(db, `friend_requests/${currentUser}/${requester}`));
        await update(ref(db, `users/${currentUser}/friends`), { [requester]: true });
        await update(ref(db, `users/${requester}/friends`), { [currentUser]: true });
        popup.classList.add('slide-out');
        setTimeout(() => popup.remove(), 500);
    };

    popup.querySelector('.no').onclick = async () => {
        await remove(ref(db, `friend_requests/${currentUser}/${requester}`));
        popup.classList.add('slide-out');
        setTimeout(() => popup.remove(), 500);
    };
}

document.getElementById('addFriendBtn').onclick = async () => {
    const friendName = document.getElementById('addFriendInput').value.trim();
    if(!friendName || friendName === currentUser) return;
    const check = await get(ref(db, 'users/' + friendName));
    if(!check.exists()) return alert("Kullanıcı yok!");
    await set(ref(db, `friend_requests/${friendName}/${currentUser}`), { time: Date.now() });
    alert("İstek gönderildi!");
    document.getElementById('addFriendInput').value = '';
};

function checkFriends() {
    onValue(ref(db, `users/${currentUser}/friends`), (snapshot) => {
        const friends = snapshot.val();
        const container = document.getElementById('friendListContainer');
        container.innerHTML = '';
        if(!friends) {
            document.getElementById('emptyFriendsScreen').style.display = 'flex';
        } else {
            document.getElementById('emptyFriendsScreen').style.display = 'none';
            Object.keys(friends).forEach(f => {
                const div = document.createElement('div');
                div.className = 'friend-item';
                div.innerHTML = `<div class="friend-avatar">${f[0]}</div> ${f}`;
                div.onclick = () => openChat(f);
                container.appendChild(div);
            });
        }
    });
}

document.getElementById('addWeekBotBtn').onclick = async () => {
    const btn = document.getElementById('addWeekBotBtn');
    btn.classList.add('added');
    btn.innerText = 'Arkadaş ✓';
    setTimeout(() => update(ref(db, `users/${currentUser}/friends`), { "WeekBot": true }), 600);
};

// --- SOHBET VE SONSUZ BOT ---
function openChat(name) {
    activeChatUser = name;
    document.getElementById('messagesContainer').style.display = 'flex';
    document.getElementById('currentChatName').innerText = name;
    if(name === 'WeekBot') {
        document.getElementById('chatInputContainer').style.display = 'none';
        document.getElementById('botOptionsContainer').style.display = 'flex';
        document.getElementById('startCallBtn').style.display = 'none';
        startBotConversation();
    } else {
        document.getElementById('chatInputContainer').style.display = 'block';
        document.getElementById('botOptionsContainer').style.display = 'none';
        document.getElementById('startCallBtn').style.display = 'block';
        loadMessages(name);
    }
}

const botResponses = {
    good: ["Oyun oynuyorum", "Müzik dinliyorum", "Ders çalışıyorum", "Kod yazıyorum", "Kitap okuyorum", "Film izliyorum", "Spor yapıyorum", "Yemek yiyorum", "Dinleniyorum", "Sohbet ediyorum"],
    bad: ["Yalnız hissediyorum", "Çok yorgunum", "Sınavlar zor", "İşler ters gitti", "Moralim bozuk", "Uykusuzum", "Stresliyim", "Halsizim", "Canım sıkkın", "Mutsuzum"]
};

function appendMessage(sender, text, isBot = false) {
    const div = document.createElement('div');
    div.className = 'message';
    div.innerHTML = `<div class="friend-avatar">${sender[0]}</div><div><h4>${sender}${isBot?'<span class="bot-tag">BOT</span>':''}</h4><p>${text}</p></div>`;
    document.getElementById('messagesContainer').appendChild(div);
    document.getElementById('messagesContainer').scrollTop = document.getElementById('messagesContainer').scrollHeight;
}

function startBotConversation() {
    document.getElementById('messagesContainer').innerHTML = '';
    appendMessage('Week Bot', 'Selam! Nasıl gidiyor?', true);
    showBotMainOptions();
}

function showBotMainOptions() {
    const opt = document.getElementById('botOptionsContainer');
    opt.innerHTML = '';
    const b1 = document.createElement('button'); b1.className = 'bot-option-btn'; b1.innerText = 'İyiyim, sen?';
    b1.onclick = () => handleChoice('İyiyim, sen?', 'good');
    const b2 = document.createElement('button'); b2.className = 'bot-option-btn'; b2.innerText = 'Biraz kötüyüm...';
    b2.onclick = () => handleChoice('Biraz kötüyüm...', 'bad');
    opt.appendChild(b1); opt.appendChild(b2);
}

function handleChoice(txt, type) {
    appendMessage(currentUser, txt);
    document.getElementById('botOptionsContainer').innerHTML = '';
    setTimeout(() => {
        appendMessage('Week Bot', type==='good'?'Harika! Neler yapıyorsun?':'Üzüldüm... Seni ne yordu?', true);
        botResponses[type].forEach(r => {
            const b = document.createElement('button'); b.className = 'bot-option-btn'; b.innerText = r;
            b.onclick = () => {
                appendMessage(currentUser, r);
                document.getElementById('botOptionsContainer').innerHTML = '';
                setTimeout(() => {
                    appendMessage('Week Bot', 'Anlıyorum, her zaman yanındayım. Peki başka anlatmak istediğin bir şey var mı?', true);
                    showBotMainOptions(); // Döngüyü başa sarar (Sonsuz konuşma)
                }, 800);
            };
            document.getElementById('botOptionsContainer').appendChild(b);
        });
    }, 800);
}

// --- SES VE ARAMA ---
document.getElementById('muteBtn').onclick = () => {
    isMuted = !isMuted;
    document.getElementById('muteBtn').innerText = isMuted ? '🔇' : '🎤';
    document.getElementById('muteBtn').classList.toggle('active-mute', isMuted);
    isMuted ? sounds.mute.play() : sounds.unmute.play();
    if(localStream) localStream.getAudioTracks()[0].enabled = !isMuted;
};

document.getElementById('deafenBtn').onclick = () => {
    isDeafened = !isDeafened;
    document.getElementById('deafenBtn').innerText = isDeafened ? '🔕' : '🎧';
    document.getElementById('deafenBtn').classList.toggle('active-mute', isDeafened);
    isDeafened ? sounds.deafen.play() : sounds.undeafen.play();
    document.getElementById('remoteAudio').muted = isDeafened;
};

document.getElementById('startCallBtn').onclick = async () => {
    document.getElementById('call-overlay').style.display = 'flex';
    document.getElementById('callStatusText').innerText = activeChatUser + " aranıyor...";
    sounds.call.play();
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    peerConnection = new RTCPeerConnection(servers);
    localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
    peerConnection.ontrack = e => document.getElementById('remoteAudio').srcObject = e.streams[0];
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await set(ref(db, `calls/${activeChatUser}`), { caller: currentUser, offer });
    onValue(ref(db, `calls/${activeChatUser}/answer`), async s => {
        if(s.val() && !peerConnection.currentRemoteDescription) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(s.val()));
            sounds.call.pause();
        }
    });
};

function listenForCalls() {
    onValue(ref(db, `calls/${currentUser}`), async s => {
        const d = s.val();
        if(d && d.offer) {
            document.getElementById('call-overlay').style.display = 'flex';
            sounds.call.play();
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            peerConnection = new RTCPeerConnection(servers);
            localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
            peerConnection.ontrack = e => document.getElementById('remoteAudio').srcObject = e.streams[0];
            await peerConnection.setRemoteDescription(new RTCSessionDescription(d.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            await set(ref(db, `calls/${currentUser}/answer`), answer);
            sounds.call.pause();
        }
    });
}

document.getElementById('endCallBtn').onclick = () => {
    document.getElementById('call-overlay').style.display = 'none';
    sounds.call.pause();
    if(peerConnection) peerConnection.close();
    remove(ref(db, `calls/${currentUser}`));
    if(activeChatUser) remove(ref(db, `calls/${activeChatUser}`));
};

function loadMessages(c) {
    const id = [currentUser, c].sort().join('_');
    onValue(ref(db, `direct_messages/${id}`), s => {
        document.getElementById('messagesContainer').innerHTML = '';
        s.forEach(m => appendMessage(m.val().sender, m.val().text));
    });
}

document.getElementById('chatForm').onsubmit = (e) => {
    e.preventDefault();
    const i = document.getElementById('messageInput');
    if(!i.value || !activeChatUser) return;
    const id = [currentUser, activeChatUser].sort().join('_');
    push(ref(db, `direct_messages/${id}`), { sender: currentUser, text: i.value });
    i.value = '';
};

function showApp() { 
    document.getElementById('auth-screen').style.display = 'none'; 
    document.getElementById('app-screen').style.display = 'flex'; 
    document.getElementById('myUsernameDisplay').innerText = currentUser;
    document.getElementById('myAvatar').innerText = currentUser[0].toUpperCase();
}
function showAuth() { document.getElementById('auth-screen').style.display = 'flex'; document.getElementById('app-screen').style.display = 'none'; }
document.getElementById('logoutBtn').onclick = () => signOut(auth);
