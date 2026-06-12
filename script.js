// ==========================================
// NEURONDECK CORE ENGINE (CLOUD AUTH & VERSIONING)
// ==========================================

const supabaseUrl = 'https://fkfksnmplvadvnwkozja.supabase.co/rest/v1/';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrZmtzbm1wbHZhZHZud2tvemphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNDQxNjcsImV4cCI6MjA5NTcyMDE2N30.R_D5PV_DjfP7tmIDxohfFRvNprQj6oKBtp4E48uL9tE';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const NeuronDeck = {
    state: {
        recentChains: [],
        currentTopic: "",
        nextSequenceIndex: 1,
        cardData: {} // NEW: Global memory map for version switching
    },

    init: () => {
        NeuronDeck.loadMemory();
        NeuronDeck.Profile.init();
        NeuronDeck.bindEvents();
    },

    Profile: {
        isLoggedIn: false,
        user: null,
        isSignUpMode: false,

        init: () => {
            NeuronDeck.Profile.checkSession();
            supabaseClient.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    NeuronDeck.Profile.handleLoginState(session.user);
                } else if (event === 'SIGNED_OUT') {
                    NeuronDeck.Profile.handleLogoutState();
                }
            });
        },

        checkSession: async () => {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session) {
                NeuronDeck.Profile.handleLoginState(session.user);
            } else {
                NeuronDeck.Profile.updateUI();
            }
        },

        handleLoginState: (userData) => {
            NeuronDeck.Profile.isLoggedIn = true;
            NeuronDeck.Profile.user = userData;
            NeuronDeck.Profile.updateUI();
            const modal = document.getElementById('auth-modal');
            if (modal && !modal.classList.contains('hidden')) modal.classList.add('hidden');
        },

        handleLogoutState: () => {
            NeuronDeck.Profile.isLoggedIn = false;
            NeuronDeck.Profile.user = null;
            NeuronDeck.Profile.updateUI();
            NeuronDeck.clearMemory();
        },

        toggleAuthMode: () => {
            NeuronDeck.Profile.isSignUpMode = !NeuronDeck.Profile.isSignUpMode;
            const title = document.getElementById('auth-title');
            const subtitle = document.getElementById('auth-subtitle');
            const toggleBtn = document.getElementById('auth-toggle-btn');
            const submitBtn = document.getElementById('auth-submit-btn');
            const usernameInput = document.getElementById('auth-username');
            const msgBox = document.getElementById('email-auth-msg');
            msgBox.classList.add('hidden');

            if (NeuronDeck.Profile.isSignUpMode) {
                title.innerText = 'Register Operative';
                subtitle.innerText = 'Create a new neural profile.';
                toggleBtn.innerText = 'Existing User?';
                submitBtn.innerText = 'Register Account';
                usernameInput.classList.remove('hidden');
            } else {
                title.innerText = 'Access Terminal';
                subtitle.innerText = 'Authenticate to sync your neural chains.';
                toggleBtn.innerText = 'Create Account';
                submitBtn.innerText = 'Initialize Session';
                usernameInput.classList.add('hidden');
            }
        },

        showAuthMessage: (msg, type) => {
            const msgBox = document.getElementById('email-auth-msg');
            msgBox.classList.remove('hidden', 'bg-brand-red/10', 'border-brand-red/30', 'text-brand-red', 'bg-brand-cyan/10', 'border-brand-cyan/30', 'text-brand-cyan');
            if (type === 'error') {
                msgBox.classList.add('bg-brand-red/10', 'border-brand-red/30', 'text-brand-red');
            } else {
                msgBox.classList.add('bg-brand-cyan/10', 'border-brand-cyan/30', 'text-brand-cyan');
            }
            msgBox.innerText = msg;
        },

        submitEmailAuth: async () => {
            const email = document.getElementById('auth-email').value.trim();
            const password = document.getElementById('auth-password').value;
            const username = document.getElementById('auth-username').value.trim();
            if (!email || !password || (NeuronDeck.Profile.isSignUpMode && !username)) {
                NeuronDeck.Profile.showAuthMessage('Missing required parameters.', 'error');
                return;
            }
            const submitBtn = document.getElementById('auth-submit-btn');
            const originalText = submitBtn.innerText;
            submitBtn.innerText = 'Processing...';
            submitBtn.disabled = true;

            try {
                if (NeuronDeck.Profile.isSignUpMode) {
                    const { data, error } = await supabaseClient.auth.signUp({
                        email: email, password: password, options: { data: { full_name: username } }
                    });
                    if (error) throw error;
                    NeuronDeck.Profile.showAuthMessage('Registration successful. Verification email dispatched.', 'success');
                } else {
                    const { data, error } = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
                    if (error) throw error;
                }
            } catch (error) {
                NeuronDeck.Profile.showAuthMessage(error.message, 'error');
            } finally {
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            }
        },

        toggle: () => {
            const modal = document.getElementById('auth-modal');
            if (modal) {
                modal.classList.toggle('hidden');
                if (modal.classList.contains('hidden')) {
                    document.getElementById('email-auth-msg').classList.add('hidden');
                    if (NeuronDeck.Profile.isSignUpMode) NeuronDeck.Profile.toggleAuthMode();
                }
            }
        },

        loginWithGoogle: async () => {
            const { data, error } = await supabaseClient.auth.signInWithOAuth({ provider: 'google' });
            if (error) console.error("Login Failed:", error.message);
        },

        loginWithGithub: async () => {
            const { data, error } = await supabaseClient.auth.signInWithOAuth({ provider: 'github' });
            if (error) console.error("Login Failed:", error.message);
        },

        logout: async () => {
            const { error } = await supabaseClient.auth.signOut();
            if (error) console.error("Logout Failed:", error.message);
            NeuronDeck.Profile.toggle(); 
        },

        updateUI: () => {
            const loginView = document.getElementById('login-view');
            const profileView = document.getElementById('profile-view');
            const navIcon = document.getElementById('nav-profile-icon');
            const navImg = document.getElementById('nav-profile-img');
            const modalImg = document.getElementById('modal-profile-img');
            const modalName = document.getElementById('modal-username');

            if (NeuronDeck.Profile.isLoggedIn) {
                if (loginView) loginView.classList.add('hidden');
                if (profileView) profileView.classList.remove('hidden');
                const avatarUrl = NeuronDeck.Profile.user?.user_metadata?.avatar_url || 'https://placehold.co/150/00f0ff/000000?text=ND';
                const displayName = NeuronDeck.Profile.user?.user_metadata?.full_name || 'Authorized User';
                if (navIcon) navIcon.classList.add('hidden');
                if (navImg) { navImg.classList.remove('hidden'); navImg.src = avatarUrl; }
                if (modalImg) modalImg.src = avatarUrl;
                if (modalName) modalName.innerText = displayName;
            } else {
                if (loginView) loginView.classList.remove('hidden');
                if (profileView) profileView.classList.add('hidden');
                if (navIcon) navIcon.classList.remove('hidden');
                if (navImg) navImg.classList.add('hidden');
            }
        }
    },

    loadMemory: () => {
        const saved = localStorage.getItem('neurondeck_memory');
        if (saved) {
            NeuronDeck.state.recentChains = JSON.parse(saved);
            NeuronDeck.renderRecentChains();
        }
    },

    saveToMemory: (topic, cardCount) => {
        const existingIndex = NeuronDeck.state.recentChains.findIndex(c => c.topic.toLowerCase() === topic.toLowerCase());
        if (existingIndex !== -1) NeuronDeck.state.recentChains.splice(existingIndex, 1);
        NeuronDeck.state.recentChains.unshift({ topic, cards: cardCount, date: new Date().toISOString() });
        if (NeuronDeck.state.recentChains.length > 6) NeuronDeck.state.recentChains.pop();
        localStorage.setItem('neurondeck_memory', JSON.stringify(NeuronDeck.state.recentChains));
        NeuronDeck.renderRecentChains();
    },

    clearMemory: () => {
        localStorage.removeItem('neurondeck_memory');
        NeuronDeck.state.recentChains = [];
        NeuronDeck.renderRecentChains();
    },

    generateChain: async (topic, isAppending = false) => {
        if (!topic || !topic.trim()) return;

        const container = document.getElementById('card-chain-container');

        if (!isAppending) {
            NeuronDeck.state.currentTopic = topic;
            NeuronDeck.state.nextSequenceIndex = 1;
            NeuronDeck.state.cardData = {}; // Clear version memory for new topic
            
            document.getElementById('view-home').classList.add('hidden');
            document.getElementById('view-learning').classList.remove('hidden');
            document.getElementById('page-title').innerHTML = `Learning Chain: <span class="text-brand-cyan">${topic}</span>`;
            
            container.innerHTML = `
                <div class="text-brand-cyan text-center py-20 flex flex-col items-center gap-4 animate-pulse">
                    <i class="ph-bold ph-circle-notch animate-spin text-4xl"></i>
                    <span class="font-mono text-sm uppercase tracking-widest">Initializing vector database sequence...</span>
                </div>
            `;
        } else {
            const loadBtn = document.getElementById('btn-load-next');
            if (loadBtn) {
                loadBtn.innerText = "Splicing Next Sequence...";
                loadBtn.disabled = true;
            }
        }

        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) throw new Error("UNAUTHORIZED");

            const response = await fetch('https://neurondeck.onrender.com/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ topic: topic, start_sequence: NeuronDeck.state.nextSequenceIndex })
            });

            if (!response.ok) throw new Error("API Request Failed");
            const data = await response.json();

            if (!isAppending) container.innerHTML = ''; 

            NeuronDeck.renderCards(data.cards, container);
            NeuronDeck.state.nextSequenceIndex += data.cards.length; 
            
            NeuronDeck.saveToMemory(topic, NeuronDeck.state.nextSequenceIndex - 1);
            NeuronDeck.attachLoadButton(); 

        } catch (error) {
            console.error(error);
            if (error.message === "UNAUTHORIZED") {
                container.innerHTML = `<div class="text-brand-red text-center py-20 border border-brand-red/20 bg-brand-red/5 rounded-2xl flex flex-col items-center"><i class="ph-bold ph-lock-key text-4xl mb-4"></i><p class="font-mono text-sm mb-6">Session required to connect.</p><button onclick="NeuronDeck.Profile.toggle()" class="px-6 py-3 bg-brand-red text-black font-bold rounded-xl">Initialize Session</button></div>`;
            } else {
                container.innerHTML = `<div class="text-brand-red text-center py-20 border border-brand-red/20 bg-brand-red/5 rounded-2xl"><i class="ph-bold ph-warning text-4xl mb-2"></i><p class="font-mono text-sm">Engine handshake error.</p></div>`;
            }
        }
    },

    renderCards: (cards, container) => {
        cards.forEach(card => {
            // 1. Initialize State Tracking for this specific card
            NeuronDeck.state.cardData[card.sequence] = {
                versions: card.versions || [{ title: card.title, shortText: card.shortText, fullText: card.fullText }],
                currentIndex: card.current_version_index !== undefined ? card.current_version_index : 0
            };

            const data = NeuronDeck.state.cardData[card.sequence];
            const activeVersion = data.versions[data.currentIndex];
            const formattedFullText = (activeVersion.fullText || "Data unreadable.").replace(/\n/g, '<br>');

            const div = document.createElement('div');
            div.id = `card-node-${card.sequence}`;
            div.className = "neuron-card bg-zinc-900/50 border border-brand-cyan/30 rounded-2xl p-6 cursor-pointer hover:border-brand-cyan transition-all duration-300 group mb-4";
            div.onclick = function() { NeuronDeck.toggleCard(this); };

            div.innerHTML = `
                <div class="flex items-center justify-between mb-2">
                    <span class="text-brand-cyan font-bold text-[10px] uppercase tracking-widest bg-brand-cyan/10 px-2 py-1 rounded">Card 0${card.sequence}</span>
                    <span class="text-zinc-500 text-xs flex items-center gap-1 font-mono"><i class="ph-bold ph-clock"></i> 2 min read</span>
                </div>
                <h3 class="text-xl font-display font-bold text-white mb-1 group-hover:text-brand-cyan transition-colors card-title-text">${activeVersion.title}</h3>
                <p class="text-zinc-400 text-sm preview-text transition-all card-short-text">${activeVersion.shortText}</p>
                
                <div class="expanded-content hidden mt-6 pt-6 border-t border-white/10 opacity-0 transition-opacity duration-300">
                    <p class="text-zinc-200 leading-relaxed text-sm card-full-text">${formattedFullText}</p>
                    
                    <div class="version-controller mt-6 flex items-center justify-start gap-4 text-zinc-500 font-mono text-sm ${data.versions.length > 1 ? '' : 'hidden'}" id="version-nav-${card.sequence}">
                        <button onclick="event.stopPropagation(); NeuronDeck.navigateVersion(${card.sequence}, -1)" class="hover:text-brand-cyan transition text-lg"><i class="ph-bold ph-caret-left"></i></button>
                        <span id="version-label-${card.sequence}" class="font-bold text-brand-cyan">${data.currentIndex + 1} / ${data.versions.length}</span>
                        <button onclick="event.stopPropagation(); NeuronDeck.navigateVersion(${card.sequence}, 1)" class="hover:text-brand-cyan transition text-lg"><i class="ph-bold ph-caret-right"></i></button>
                    </div>
                    
                    <div class="mt-6 flex justify-between items-center gap-4">
                        <button class="px-5 py-2 bg-brand-red/10 border border-brand-red/30 text-brand-red text-xs font-bold rounded-full hover:bg-brand-red hover:text-black transition flex items-center gap-2" onclick="event.stopPropagation(); NeuronDeck.triggerConfusionEngine(${card.sequence}, this);">
                            <i class="ph-bold ph-brain"></i> Confusion? 
                        </button>
                        <button class="px-5 py-2 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-bold rounded-full hover:bg-brand-cyan hover:text-black transition shadow-lg shadow-brand-cyan/20" onclick="event.stopPropagation(); this.innerText='Completed'; this.classList.add('opacity-50');">
                            Mark Complete
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
    },

    // NEW: Handles left/right arrow clicks instantly without hitting the server
    navigateVersion: (sequenceId, direction) => {
        const data = NeuronDeck.state.cardData[sequenceId];
        if (!data) return;

        let newIndex = data.currentIndex + direction;
        
        // Prevent going out of bounds
        if (newIndex < 0) newIndex = 0;
        if (newIndex >= data.versions.length) newIndex = data.versions.length - 1;
        if (newIndex === data.currentIndex) return; // No change needed

        data.currentIndex = newIndex;
        NeuronDeck.updateCardUI(sequenceId);
    },

    // NEW: Helper function to inject text into the HTML safely
    updateCardUI: (sequenceId) => {
        const cardElement = document.getElementById(`card-node-${sequenceId}`);
        const data = NeuronDeck.state.cardData[sequenceId];
        const activeVersion = data.versions[data.currentIndex];

        cardElement.querySelector('.card-title-text').innerText = activeVersion.title;
        cardElement.querySelector('.card-short-text').innerText = activeVersion.shortText;
        cardElement.querySelector('.card-full-text').innerHTML = activeVersion.fullText.replace(/\n/g, '<br>');

        const navContainer = document.getElementById(`version-nav-${sequenceId}`);
        if (navContainer) {
            navContainer.classList.remove('hidden');
            document.getElementById(`version-label-${sequenceId}`).innerText = `${data.currentIndex + 1} / ${data.versions.length}`;
        }
    },

    triggerConfusionEngine: async (sequenceId, buttonElement) => {
        const originalBtnHTML = buttonElement.innerHTML;
        buttonElement.innerHTML = `<i class="ph-bold ph-circle-notch animate-spin"></i> Recalibrating...`;
        buttonElement.disabled = true;

        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) throw new Error("Unauthorized access setup.");
            
            // Get the current visible text to send to the AI
            const currentData = NeuronDeck.state.cardData[sequenceId];
            const activeText = currentData.versions[currentData.currentIndex].fullText;
            const activeTitle = currentData.versions[currentData.currentIndex].title;

            const response = await fetch('https://neurondeck.onrender.com/api/clarify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({
                    topic: NeuronDeck.state.currentTopic,
                    card_title: activeTitle,
                    current_text: activeText,
                    sequence: sequenceId
                })
            });

            if (!response.ok) throw new Error("Clarification request crashed.");
            
            const refinedResponse = await response.json(); // Returns the whole array and new index

            // Update the global state with the new array
            NeuronDeck.state.cardData[sequenceId].versions = refinedResponse.versions;
            NeuronDeck.state.cardData[sequenceId].currentIndex = refinedResponse.current_version_index;

            // Trigger the visual UI swap
            NeuronDeck.updateCardUI(sequenceId);
            
            buttonElement.innerHTML = `<i class="ph-bold ph-check"></i> Resolved`;
            buttonElement.classList.replace('text-brand-red', 'text-green-400');
            buttonElement.classList.replace('border-brand-red/30', 'border-green-400/30');

            // Reset button after 3 seconds so they can use it again
            setTimeout(() => {
                buttonElement.innerHTML = originalBtnHTML;
                buttonElement.disabled = false;
                buttonElement.classList.replace('text-green-400', 'text-brand-red');
                buttonElement.classList.replace('border-green-400/30', 'border-brand-red/30');
            }, 3000);

        } catch (error) {
            console.error(error);
            buttonElement.innerHTML = `<i class="ph-bold ph-warning"></i> Engine Blocked`;
            buttonElement.disabled = false;
        }
    },

    attachLoadButton: () => {
        let loadBtn = document.getElementById('btn-load-next');
        if (loadBtn) loadBtn.remove(); 

        const container = document.getElementById('card-chain-container') || document.querySelector('#view-learning div');
        if (!container) return;

        const btn = document.createElement('button');
        btn.id = 'btn-load-next';
        btn.className = "w-full mt-8 py-4 bg-zinc-900 border border-brand-cyan/20 hover:border-brand-cyan text-brand-cyan font-mono text-sm uppercase tracking-widest rounded-xl transition-all duration-300 shadow-lg hover:shadow-brand-cyan/10 flex items-center justify-center gap-2";
        btn.innerHTML = `<i class="ph-bold ph-plus-circle"></i> Load Next Sequence Data`;
        btn.onclick = () => { NeuronDeck.generateChain(NeuronDeck.state.currentTopic, true); };
        container.appendChild(btn);
    },

    renderRecentChains: () => {
        const grid = document.getElementById('recent-chains-grid');
        if (!grid) return;
        if (NeuronDeck.state.recentChains.length === 0) {
            grid.innerHTML = `<p class="text-zinc-600 text-sm font-mono col-span-full">Memory bank empty.</p>`;
            return;
        }
        grid.innerHTML = '';
        NeuronDeck.state.recentChains.forEach(chain => {
            const div = document.createElement('div');
            div.className = "p-5 bg-zinc-900/40 border border-white/5 rounded-xl hover:border-brand-cyan/50 cursor-pointer transition-all group flex justify-between items-center";
            div.onclick = () => NeuronDeck.generateChain(chain.topic);
            div.innerHTML = `<div><h4 class="text-white font-bold mb-1 group-hover:text-brand-cyan transition-colors">${chain.topic}</h4><p class="text-zinc-500 text-xs font-mono">${chain.cards} Cards • Sync Completed</p></div><i class="ph-bold ph-arrow-right text-zinc-600 group-hover:text-brand-cyan transition-transform group-hover:translate-x-1"></i>`;
            grid.appendChild(div);
        });
    },

    toggleCard: (cardElement) => {
        const expanded = cardElement.querySelector('.expanded-content');
        const preview = cardElement.querySelector('.preview-text');
        if (expanded.classList.contains('hidden')) {
            expanded.classList.remove('hidden');
            setTimeout(() => expanded.classList.remove('opacity-0'), 10);
            preview.classList.add('hidden');
            cardElement.classList.add('bg-zinc-900', 'border-brand-cyan');
            cardElement.classList.remove('bg-zinc-900/50', 'border-brand-cyan/30');
        } else {
            expanded.classList.add('opacity-0');
            setTimeout(() => expanded.classList.add('hidden'), 300);
            preview.classList.remove('hidden');
            cardElement.classList.remove('bg-zinc-900', 'border-brand-cyan');
            cardElement.classList.add('bg-zinc-900/50', 'border-brand-cyan/30');
        }
    },

    returnToTerminal: () => {
        document.getElementById('view-learning').classList.add('hidden');
        document.getElementById('view-home').classList.remove('hidden');
        const mainInput = document.getElementById('main-deck-search');
        if (mainInput) { mainInput.value = ''; mainInput.focus(); }
    },

    bindEvents: () => {
        const mainInput = document.getElementById('main-deck-search');
        const generateBtn = document.getElementById('btn-generate');
        const clearBtn = document.querySelector('.text-\\[10px\\].text-brand-cyan');
        if (mainInput) {
            mainInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') NeuronDeck.generateChain(mainInput.value);
            });
        }
        if (generateBtn) {
            generateBtn.addEventListener('click', () => { NeuronDeck.generateChain(mainInput.value); });
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', NeuronDeck.clearMemory);
        }
    }
};

document.addEventListener('DOMContentLoaded', NeuronDeck.init);
window.returnToTerminal = NeuronDeck.returnToTerminal;
