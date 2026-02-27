// ... Firebase Config ve Init kısımları aynı kalacak ...

let localStream;
let peerConnection;
const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// --- BOT SEÇENEK SİSTEMİ (Dinamik) ---
const botConversations = {
    start: {
        text: "Selam! Ben Week Bot. Bugün nasılsın?",
        options: [
            { text: "İyiyim, sen nasılsın?", next: "positive_branch" },
            { text: "Bu aralar biraz kötüyüm :(", next: "negative_branch" }
        ]
    },
    positive_branch: {
        text: "Harika! Enerjin çok iyi. Peki bugün neler yapmayı planlıyorsun?",
        options: [
            { text: "Oyun oynayacağım 🎮", next: "gaming" },
            { text: "Ders çalışmam lazım 📚", next: "study" }
        ]
    },
    negative_branch: {
        text: "Kötü günler gelip geçicidir. Biraz dertleşmek ister misin?",
        options: [
            { text: "Neden böyle hissettiğimi bilmiyorum...", next: "deep_talk" },
            { text: "Sadece biraz yalnız kalmak istiyorum.", next: "end_talk" }
        ]
    },
    // Bu şekilde istediğin 60 seçeneği ağaç yapısı gibi birbirine bağlayabilirsin.
};

function handleChoice(choiceObj) {
    appendLocalMessage(currentUser, choiceObj.text);
    
    const nextStep = botConversations[choiceObj.next];
    if (nextStep) {
        setTimeout(() => {
            sendBotMessage(nextStep.text);
            showOptions(nextStep.options);
        }, 1000);
    } else {
        // Eğer dal bitmişse rastgele bir genel cevap ver
        const randomReply = "Seni anlıyorum. Başka bir şeyden konuşalım mı?";
        setTimeout(() => {
            sendBotMessage(randomReply);
            showOptions(botConversations.start.options);
        }, 1000);
    }
}

function showOptions(options) {
    const container = document.getElementById('bot-options-container');
    container.innerHTML = '';
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'bot-option-btn';
        btn.innerText = opt.text;
        btn.onclick = () => handleChoice(opt);
        container.appendChild(btn);
    });
}

// --- GERÇEK SESLİ KONUŞMA SİSTEMİ (WebRTC) ---
async function startVoiceCall(friendName) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        document.getElementById('call-overlay').style.display = 'flex';
        
        // Ses seviyesi görselleştirmesi (Speaking animasyonu) için
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(localStream);
        const processor = audioContext.createScriptProcessor(2048, 1, 1);
        
        source.connect(processor);
        processor.connect(audioContext.destination);
        
        processor.onaudioprocess = (e) => {
            const input = e.inputBuffer.getChannelData(0);
            let sum = 0;
            for(let i=0; i<input.length; i++) sum += input[i]*input[i];
            const volume = Math.sqrt(sum / input.length);
            if(volume > 0.1) {
                document.getElementById('callMyAvatar').classList.add('speaking');
            } else {
                document.getElementById('callMyAvatar').classList.remove('speaking');
            }
        };

        // Burada peerConnection kurulup uzak tarafa sinyal gönderilir (Firebase üzerinden)
        // Basitleştirmek için şu an yerel testi açıyoruz
        console.log(friendName + " aranıyor...");

    } catch (err) {
        alert("Mikrofon izni verilmedi veya cihaz bulunamadı.");
    }
}

document.getElementById('endCallBtn').onclick = () => {
    if(localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    document.getElementById('call-overlay').style.display = 'none';
};

// Arkadaş listesinde sesli arama butonunu aktif et
function openChat(name, isBot) {
    const chatTitle = document.getElementById('currentChatName');
    const callBtn = document.getElementById('startCallBtn');
    
    chatTitle.innerText = isBot ? "Week Bot ile Sohbet" : name;
    
    if(!isBot) {
        callBtn.style.display = 'block';
        callBtn.onclick = () => startVoiceCall(name);
    } else {
        callBtn.style.display = 'none';
        openBotChat();
    }
}
