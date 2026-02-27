import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, get, remove, onChildAdded } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";
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
let activeChatUser = null; 

// --- WEBRTC DEĞİŞKENLERİ ---
let localStream;
let peerConnection;
const servers = {
    iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
    ]
};

// --- GİRİŞ / KAYIT ---
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');

registerBtn.onclick = async () => {
    const user = document.getElementById('usernameInput').value.trim();
    const pass = document.getElementById('passwordInput').value;
    if(!user || pass.length < 6) return alert("Kullanıcı adı girin ve şifre en az 6 karakter olsun!");

    try {
        const userCheck = await get(ref(db, 'users/' + user));
        if(userCheck.exists()) return alert("Bu kullanıcı adı zaten alınmış!");

        await createUserWithEmailAndPassword(auth, user + "@weekcord.com", pass);
        await set(ref(db, 'users/' + user), { username: user, lastLogin: Date.now(), friends: {} });
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

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const username = user.email.split('@')[0];
        const snapshot = await get(ref(db, 'users/' + username));
        if (snapshot.exists()) {
            currentUser = username;
            showApp();
            listenForCalls(); // Gelen aramaları dinle
            checkFriends();   // Arkadaş durumunu kontrol et
        }
    } else {
        showAuth();
    }
});

// --- ARKADAŞ VE BOT SİSTEMİ ---
function checkFriends() {
    onValue(ref(db, 'users/' + currentUser + '/friends'), (snapshot) => {
        const friends = snapshot.val();
        const friendListContainer = document.getElementById('friendListContainer');
        friendListContainer.innerHTML = '';
        
        if (!friends) {
            document.getElementById('emptyFriendsScreen').style.display = 'flex';
            document.getElementById('messagesContainer').style.display = 'none';
            document.getElementById('chatInputContainer').style.display = 'none';
        } else {
            document.getElementById('emptyFriendsScreen').style.display = 'none';
            Object.keys(friends).forEach(friendName => {
                const div = document.createElement('div');
                div.className = 'friend-item';
                div.innerHTML = `<div class="friend-avatar" style="background:${friendName==='WeekBot'?'#1abc9c':'#5865f2'};">${friendName[0]}</div> ${friendName}`;
                div.onclick = () => openChat(friendName);
                friendListContainer.appendChild(div);
            });
        }
    });
}

// Bot Ekleme Animasyonu
document.getElementById('addWeekBotBtn').onclick = async () => {
    const btn = document.getElementById('addWeekBotBtn');
    btn.classList.add('added');
    btn.innerText = 'Arkadaş ✓';
    
    setTimeout(async () => {
        await update(ref(db, `users/${currentUser}/friends`), { "WeekBot": true });
        openChat('WeekBot');
    }, 800);
};

// Gerçek Arkadaş Ekleme
document.getElementById('addFriendBtn').onclick = async () => {
    const friendName = document.getElementById('addFriendInput').value.trim();
    if(!friendName || friendName === currentUser) return;
    
    const userCheck = await get(ref(db, 'users/' + friendName));
    if(!userCheck.exists()) return alert("Böyle bir kullanıcı bulunamadı!");
    
    await update(ref(db, `users/${currentUser}/friends`), { [friendName]: true });
    await update(ref(db, `users/${friendName}/friends`), { [currentUser]: true });
    document.getElementById('addFriendInput').value = '';
    alert("Arkadaş eklendi!");
};

// --- SOHBET MANTIĞI ---
function openChat(chatName) {
    activeChatUser = chatName;
    document.getElementById('emptyFriendsScreen').style.display = 'none';
    document.getElementById('messagesContainer').style.display = 'flex';
    document.getElementById('currentChatName').innerText = chatName;
    
    if (chatName === 'WeekBot') {
        document.getElementById('chatInputContainer').style.display = 'none';
        document.getElementById('botOptionsContainer').style.display = 'flex';
        document.getElementById('startCallBtn').style.display = 'none';
        startBotConversation();
    } else {
        document.getElementById('chatInputContainer').style.display = 'block';
        document.getElementById('botOptionsContainer').style.display = 'none';
        document.getElementById('startCallBtn').style.display = 'block';
        loadMessages(chatName);
    }
}

// --- BOT DİYALOG AĞACI (Toplam 60 Seçenek) ---
const botResponses = {
    good: [
        "Oyun oynuyorum", "Müzik dinliyorum", "Ders çalışıyorum", "Kod yazıyorum", "Kitap okuyorum",
        "Film izliyorum", "Dışarıdayım", "Spor yapıyorum", "Yemek yiyorum", "Dinleniyorum",
        "Sohbet ediyorum", "Geziniyorum", "YouTube izliyorum", "Proje geliştiriyorum", "Sınava hazırlanıyorum",
        "Hobilerimle ilgileniyorum", "Tasarım yapıyorum", "Makale okuyorum", "Yürüyüş yapıyorum", "Ev işi yapıyorum",
        "Kahve içiyorum", "Arkadaşlarımdayım", "Bisiklet sürüyorum", "Alışverişteyim", "Dizi izliyorum",
        "Meditasyon yapıyorum", "Resim çiziyorum", "Gitar çalıyorum", "Yemek pişiriyorum", "Yeni bir dil öğreniyorum"
    ],
    bad: [
        "Yalnız hissediyorum", "Çok yorgunum", "Gelecek kaygım var", "Sınavlar çok zor", "İşler ters gitti",
        "Arkadaşımla tartıştım", "Ailevi sorunlar", "Maddi sıkıntılar", "Motivasyonum yok", "Hasta hissediyorum",
        "Uykusuzum", "Zaman yetmiyor", "Kalbim kırık", "Haksızlığa uğradım", "Kendimi yetersiz hissediyorum",
        "Stresliyim", "Her şey üstüme geliyor", "Anlaşılmıyorum", "Birini özlüyorum", "Hayal kırıklığı yaşadım",
        "Canım çok sıkkın", "Havalar bunaltıyor", "Moralim bozuk", "İçimden hiçbir şey gelmiyor", "Kaybolmuş hissediyorum",
        "Kararsızım", "Güvensizlik yaşıyorum", "Boşluktayım", "Hata yaptım", "Çok fazla baskı var"
    ]
};

function appendMessage(sender, text, isBot = false) {
    const container = document.getElementById('messagesContainer');
    const div = document.createElement('div');
    div.className = 'message';
    div.innerHTML = `
        <div class="friend-avatar" style="background:${isBot?'#1abc9c':'#5865f2'};">${sender[0].toUpperCase()}</div>
        <div class="message-content">
            <h4>${sender} ${isBot?'<span class="bot-tag">BOT</span>':''} <span class="time">${new Date().toLocaleTimeString()}</span></h4>
            <p>${text}</p>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    if(!isBot && !isDeafened) sounds.msg.play().catch(()=>{});
}

function startBotConversation() {
    const container = document.getElementById('messagesContainer');
    container.innerHTML = ''; 
    const optionsContainer = document.getElementById('botOptionsContainer');
    
    // Botun ilk mesajı
    setTimeout(() => {
        appendMessage('Week Bot', 'Merhaba! Nasılsın?', true);
        
        optionsContainer.innerHTML = '';
        const btnGood = document.createElement('button');
        btnGood.className = 'bot-option-btn';
        btnGood.innerText = 'İyiyim sen nasılsın?';
        btnGood.onclick = () => handleBotChoice('İyiyim sen nasılsın?', 'good');
        
        const btnBad = document.createElement('button');
        btnBad.className = 'bot-option-btn';
        btnBad.innerText = 'Bu aralar biraz kötüyüm :(';
        btnBad.onclick = () => handleBotChoice('Bu aralar biraz kötüyüm :(', 'bad');
        
        optionsContainer.appendChild(btnGood);
        optionsContainer.appendChild(btnBad);
    }, 500);
}

function handleBotChoice(userText, type) {
    appendMessage(currentUser, userText, false);
    const optionsContainer = document.getElementById('botOptionsContainer');
    optionsContainer.innerHTML = ''; // Seçenekleri temizle
    
    setTimeout(() => {
        if(type === 'good') {
            appendMessage('Week Bot', 'Harika duyduğuma sevindim! Neler yapıyorsun peki?', true);
            botResponses.good.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'bot-option-btn';
                btn.innerText = opt;
                btn.onclick = () => { appendMessage(currentUser, opt, false); optionsContainer.innerHTML=''; setTimeout(()=>appendMessage('Week Bot', 'Kulağa çok hoş geliyor! İyi eğlenceler.', true), 500); };
                optionsContainer.appendChild(btn);
            });
        } else {
            appendMessage('Week Bot', 'Kötü günler hep geçicidir. Seni ne rahatsız ediyor, anlatmak ister misin?', true);
            botResponses.bad.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'bot-option-btn';
                btn.innerText = opt;
                btn.onclick = () => { appendMessage(currentUser, opt, false); optionsContainer.innerHTML=''; setTimeout(()=>appendMessage('Week Bot', 'Anlıyorum... Bazen sadece zamana bırakmak veya birine anlatmak iyi gelir. Ben hep buradayım.', true), 500); };
                optionsContainer.appendChild(btn);
            });
        }
    }, 500);
}

// Gerçek İnsanlarla Mesajlaşma
const chatForm = document.getElementById('chatForm');
chatForm.onsubmit = (e) => {
    e.preventDefault();
    if(!activeChatUser || activeChatUser === 'WeekBot') return;
    
    const input = document.getElementById('messageInput');
    if(!input.value.trim()) return;

    const chatId = [currentUser, activeChatUser].sort().join('_');
    push(ref(db, `direct_messages/${chatId}`), {
        sender: currentUser, text: input.value, timestamp: Date.now()
    });
    input.value = '';
};

function loadMessages(chatName) {
    const chatId = [currentUser, chatName].sort().join('_');
    onValue(ref(db, `direct_messages/${chatId}`), (snapshot) => {
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '';
        snapshot.forEach(child => {
            const msg = child.val();
            appendMessage(msg.sender, msg.text, false);
        });
    });
}

// --- SES KONTROLLERİ VE EMOJİ DEĞİŞİMİ ---
document.getElementById('muteBtn').onclick = () => {
    isMuted = !isMuted;
    const btn = document.getElementById('muteBtn');
    btn.classList.toggle('active-mute', isMuted);
    // Çizgili emoji değişimi
    btn.innerText = isMuted ? '🔇' : '🎤';
    isMuted ? sounds.mute.play() : sounds.unmute.play();
    
    // WebRTC ses akışını kes
    if(localStream) {
        localStream.getAudioTracks()[0].enabled = !isMuted;
    }
};

document.getElementById('deafenBtn').onclick = () => {
    isDeafened = !isDeafened;
    const btn = document.getElementById('deafenBtn');
    btn.classList.toggle('active-mute', isDeafened);
    // Çizgili emoji değişimi
    btn.innerText = isDeafened ? '🔕' : '🎧';
    isDeafened ? sounds.deafen.play() : sounds.undeafen.play();
    
    // Gelen sesi kes
    document.getElementById('remoteAudio').muted = isDeafened;
};

// --- WEBRTC GERÇEK SESLİ ARAMA SİSTEMİ ---
document.getElementById('startCallBtn').onclick = async () => {
    if(!activeChatUser || activeChatUser === 'WeekBot') return;
    
    document.getElementById('call-overlay').style.display = 'flex';
    document.getElementById('callStatusText').innerText = "Aranıyor: " + activeChatUser;
    sounds.call.play();

    // Mikrofon izni al
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    
    peerConnection = new RTCPeerConnection(servers);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (event) => {
        document.getElementById('remoteAudio').srcObject = event.streams[0];
    };

    const callDoc = ref(db, `calls/${activeChatUser}`);
    
    peerConnection.onicecandidate = (event) => {
        if(event.candidate) {
            push(ref(db, `calls/${activeChatUser}/candidates`), event.candidate.toJSON());
        }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    await set(callDoc, {
        caller: currentUser,
        offer: { type: offer.type, sdp: offer.sdp }
    });

    // Karşı tarafın cevabını bekle
    onValue(ref(db, `calls/${activeChatUser}/answer`), async (snapshot) => {
        const answer = snapshot.val();
        if(answer && !peerConnection.currentRemoteDescription) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            document.getElementById('callStatusText').innerText = "Bağlandı!";
            sounds.call.pause();
        }
    });
};

function listenForCalls() {
    onValue(ref(db, `calls/${currentUser}`), async (snapshot) => {
        const data = snapshot.val();
        if(data && data.offer) {
            document.getElementById('call-overlay').style.display = 'flex';
            document.getElementById('callStatusText').innerText = "Gelen Arama: " + data.caller;
            sounds.call.play();

            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            peerConnection = new RTCPeerConnection(servers);
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            peerConnection.ontrack = (event) => {
                document.getElementById('remoteAudio').srcObject = event.streams[0];
            };

            peerConnection.onicecandidate = (event) => {
                if(event.candidate) {
                    push(ref(db, `calls/${data.caller}/answerCandidates`), event.candidate.toJSON());
                }
            };

            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            await set(ref(db, `calls/${currentUser}/answer`), {
                type: answer.type, sdp: answer.sdp
            });
            sounds.call.pause();
        }
    });
}

document.getElementById('endCallBtn').onclick = () => {
    document.getElementById('call-overlay').style.display = 'none';
    sounds.call.pause();
    sounds.call.currentTime = 0;
    
    if(peerConnection) peerConnection.close();
    if(localStream) localStream.getTracks().forEach(track => track.stop());
    
    // Veritabanından aramayı temizle
    remove(ref(db, `calls/${currentUser}`));
    if(activeChatUser) remove(ref(db, `calls/${activeChatUser}`));
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

function logout() { signOut(auth); }
document.getElementById('logoutBtn').onclick = logout;
