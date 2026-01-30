import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// 1. 定義 API 基礎路徑
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocal ? 'http://localhost:3000' : ''; // 雲端用相對路徑

// ==========================================
// 1. 全域變數與資料定義
// ==========================================
let db, auth;
let isLoginMode = true;
let cart = [];
let authModal;

const colorMap = {
    "曜石黑": "black", "極致灰": "gray", "軍綠色": "green",
    "深藍色": "blue", "大地米": "beige", "純淨白": "white"
};

const baseTemplates = [
    {
        id: "sweatshirt", name: "重磅落肩大學T", price: 880, cats: ["上衣", "本季新品", "城市休閒", "熱門推薦"],
        desc: "選用 420g 重磅純棉面料，落肩寬鬆剪裁，不僅親膚舒適更具立體感，是秋冬穿搭的必備基礎單品。"
    },
    {
        id: "windbreaker", name: "機能防風連帽外套", price: 1680, cats: ["外套", "機能運動", "熱門"],
        desc: "採用超輕量防風材質，結合 DWR 撥水技術，內裡透氣網布不悶熱，適合戶外運動與都市通勤。"
    },
    {
        id: "cargo-pants", name: "工裝多口袋長褲", price: 1350, cats: ["褲子", "本季新品", "城市休閒"],
        desc: "立體大口袋設計兼具實用與帥氣，耐磨抗撕裂面料，讓您在城市與戶外間切換自如。"
    },
    {
        id: "sport-tee", name: "抗UV涼感訓練衫", price: 750, cats: ["上衣", "機能運動", "限時特惠"],
        desc: "科技涼感纖維有效降低體感溫度，具備 UPF50+ 防曬功能，是夏季高強度運動的最佳夥伴。"
    },
    {
        id: "suit-pants", name: "俐落九分西裝褲", price: 1100, cats: ["褲子", "城市休閒"],
        desc: "專為亞洲身型打造的九分比例，修飾腿型顯高顯瘦，抗皺材質免燙即可擁有挺括質感。"
    },
    {
        id: "down-jacket", name: "極地保暖羽絨外套", price: 3200, cats: ["外套", "本季新品"],
        desc: "高品質 90/10 羽絨填充，極高蓬鬆度鎖住體溫，防滲水外殼輕鬆應對濕冷氣候。"
    },
    {
        id: "baseball-cap", name: "低調刺繡棒球帽", price: 550, cats: ["配件", "熱門", "限時特惠", "熱門推薦"],
        desc: "經典六分割版型，精緻品牌刺繡細節，可調節扣環適合各種頭圍，為造型畫龍點睛。"
    },
    {
        id: "side-bag", name: "城市旅行側背小包", price: 890, cats: ["配件", "本季新品", "熱門推薦"],
        desc: "防潑水尼龍材質，多層次收納空間可放入手機、錢包與小物，輕鬆出門無負擔。"
    },
    {
        id: "oxford-shirt", name: "修身純棉長袖襯衫", price: 1050, cats: ["上衣", "城市休閒"],
        desc: "精選長絨棉織造，手感紮實親膚，修身剪裁展現俐落線條，單穿或作為層次搭配皆宜。"
    },
    {
        id: "joggers", name: "彈性束口運動褲", price: 950, cats: ["褲子", "機能運動", "熱門"],
        desc: "四面彈力面料讓活動不受限，束口設計修飾踝部線條，兼顧運動機能與街頭美學。"
    }
];

const products = [];
baseTemplates.forEach((template) => {
    Object.keys(colorMap).forEach((color) => {
        const isSale = template.cats.includes("限時特惠");

        products.push({
            name: `${color} ${template.name}`,
            price: template.price,
            originalPrice: isSale ? Math.floor(template.price * 1.4) : null,
            categories: ["全部", ...template.cats],
            image: `images/${template.id}/${template.id}-${colorMap[color]}.png`,

            // --- 這裡就是你要加的改動 ---
            // 結合當前的「顏色」與該模板的「簡介」
            description: `這款【${color}】${template.name}，${template.desc}`
        });
    });
});

// 統一掛載全域函式 (解決 JS Module 無法被 HTML onclick 存取的問題)
window.openAuthModal = () => {
    const modal = document.getElementById('authModal');
    if (modal) modal.style.display = 'block';
};

window.closeAuthModal = () => {
    const modal = document.getElementById('authModal');
    if (modal) modal.style.display = 'none';
};

// ==========================================
// 2. 初始化 App
// ==========================================
async function startApp() {
    // 1. 自動判斷目前環境：是本地開發還是 Vercel 雲端
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    // 本地端指向 3000 埠，雲端則使用相對路徑（Vercel 會自動處理 /api）
    const API_BASE = isLocal ? 'http://localhost:3000' : '';
    authModal = document.getElementById('authModal'); // <--- 加入這一行

    const loginBtn = document.querySelector(".login-register-btn");
    const logoutBtn = document.getElementById("logoutBtn");
    const historyBtn = document.getElementById("historyBtn");

    filterCategory('全部');

    try {
        // 使用自動判斷後的 API_BASE
        const res = await fetch(`${API_BASE}/api/config`);
        if (!res.ok) throw new Error("API 配置讀取失敗");
        
        const config = await res.json();
        const app = initializeApp(config);
        db = getFirestore(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    updateAuthUI(userData.name, userData.gender);
                }
                if (historyBtn) historyBtn.style.display = "inline";
                if (logoutBtn) logoutBtn.style.display = "inline";
            } else {
                if (loginBtn) {
                    loginBtn.innerHTML = "登入/註冊";
                    loginBtn.style.pointerEvents = "auto";
                    loginBtn.onclick = (e) => {
                        e.preventDefault();
                        window.openAuthModal();
                    };
                }
                if (historyBtn) historyBtn.style.display = "none";
                if (logoutBtn) logoutBtn.style.display = "none";
            }
        });

    } catch (err) {
        console.error("Firebase 初始化失敗:", err);
    }
}

// ==========================================
// 3. 商品渲染與詳情功能
// ==========================================
window.filterCategory = (targetName) => {
    const navLinks = document.querySelectorAll('.sidebar ul li a');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.innerText.includes(targetName) || (targetName === '全部' && link.innerText.includes('所有商品'))) {
            link.classList.add('active');
        }
    });

    const title = document.getElementById('category-title');
    if (title) {
        if (targetName === '全部') title.innerText = '所有商品';
        else if (targetName === '本季新品') title.innerText = '新品上市';
        else if (targetName === '熱門推薦') title.innerText = '🔥 本季熱門推薦';
        else title.innerText = targetName;
    }

    const container = document.getElementById('product-list');
    if (!container) return;
    container.innerHTML = '';

    products.forEach((item, originalIndex) => {
        if (item.categories.includes(targetName)) {
            const hotBadge = item.categories.includes('熱門推薦') ? `<span class="hot-badge">HOT</span>` : '';
            const priceDisplay = item.originalPrice
                ? `<p class="product-price sale"><span class="old-price">$ ${item.originalPrice}</span> <span class="new-price">$ ${item.price}</span></p>`
                : `<p class="product-price">$ ${item.price}</p>`;

            const categoriesHtml = item.categories.filter(c => c !== '全部').map(c => `<span class="category-pill">${c}</span>`).join('');

            container.innerHTML += `
                <div class="product-card product-card-flip">
                    <div class="product-card-inner">
                        <div class="product-card-front">
                            ${hotBadge}
                            <div class="product-info-top">
                                <div class="product-img-container" style="height: 200px; display: flex; justify-content: center; align-items: center; background: #f8f8f8;">
                                    <img src="${item.image}" alt="${item.name}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                                </div>
                                <h3>${item.name}</h3>
                            </div>
                            <div class="product-info-bottom">
                                ${priceDisplay}
                                <div class="product-card-actions">
                                    <button class="add-to-cart" onclick="addToCart(${originalIndex})">加入購物車</button>
                                    <button type="button" class="add-to-cart btn-detail" onclick="toggleCardFlip(this)">查看詳情</button>
                                </div>
                            </div>
                        </div>
                        <div class="product-card-back">
                            <div class="product-card-back-content">
                                <h3 class="detail-title">${item.name}</h3>
                                <div class="detail-categories">${categoriesHtml}</div>
                                <div class="detail-description-box"><p>${item.description}</p></div>
                            </div>
                            <div class="product-card-actions">
                                <button type="button" class="btn-back" onclick="toggleCardFlip(this)">返回</button>
                            </div>
                        </div>
                    </div>
                </div>`;
        }
    });
};

// 卡片翻轉：點擊詳情/返回切換；翻回正面時短暫加 no-hover
window.toggleCardFlip = (btn) => {
    const card = btn.closest('.product-card-flip');
    if (!card) return;
    const wasFlipped = card.classList.contains('flipped');
    card.classList.toggle('flipped');
    if (wasFlipped) {
        card.classList.add('no-hover');
        setTimeout(() => card.classList.remove('no-hover'), 500);
    }
};

// ==========================================
// 4. 購物車邏輯
// ==========================================
window.addToCart = (index) => {
    Swal.fire({ icon: 'success', title: '已加入購物車', timer: 1000, showConfirmButton: false, toast: true, position: 'top-end' });
    const product = products[index];
    const existingItem = cart.find(item => item.name === product.name);
    if (existingItem) existingItem.quantity += 1;
    else cart.push({ ...product, quantity: 1 });
    updateCartUI();
};

function calculateDiscount(totalPrice) {
    let finalPrice = totalPrice;
    let discountName = "無折扣";
    if (totalPrice >= 12120) {
        finalPrice = totalPrice * 0.7;
        discountName = "雙12盛典滿額 7 折";
    } else if (totalPrice > 0) {
        finalPrice = totalPrice * 0.88;
        discountName = "全館狂歡 88 折";
    }
    return {
        finalPrice: Math.round(finalPrice),
        discountName: discountName,
        saved: Math.round(totalPrice - finalPrice)
    };
}

function updateCartUI() {
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.querySelector('.cart-count');
    if (badge) badge.innerText = totalCount;

    const cartList = document.getElementById('cart-items-list');
    const cartTotalDisplay = document.getElementById('cart-total');
    if (!cartList || !cartTotalDisplay) return;

    cartList.innerHTML = cart.length ? cart.map((item, index) => `
        <li class="cart-item">
            <div class="item-left">
                <span class="item-name">${item.name}</span>
                <span class="item-price">$${item.price}</span>
            </div>
            <div class="item-right">
                <div class="qty-control">
                    <button onclick="changeQty(${index}, -1)">-</button>
                    <span class="qty-num">${item.quantity}</span>
                    <button onclick="changeQty(${index}, 1)">+</button>
                </div>
                <button class="remove-btn" onclick="removeFromCart(${index})">刪除</button>
            </div>
        </li>`).join('') : `<li style="text-align:center; color:#999; padding: 40px 0;">您的購物車目前是空的 🛒</li>`;

    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const result = calculateDiscount(totalPrice);

    if (totalPrice > 0) {
        const nextGoal = 12120;
        const goalText = totalPrice < nextGoal ? `
            <div class="promo-hint">🔥 再買 <strong>$${nextGoal - totalPrice}</strong> 即可享有 <strong>7 折</strong>！</div>` : "";

        cartTotalDisplay.innerHTML = `
            ${goalText}
            <div style="font-size: 0.9rem; color: #777;">原價總計：$ ${totalPrice}</div>
            <div style="font-size: 0.9rem; color: #e63946;">套用優惠：${result.discountName}</div>
            <div style="font-size: 1.3rem; font-weight: bold; margin-top: 8px;">應付總額：$ ${result.finalPrice}</div>
            <div style="font-size: 0.85rem; color: #28a745;">(已省下 $ ${result.saved})</div>`;
    } else {
        cartTotalDisplay.innerText = `總計金額：$ 0`;
    }
}

window.changeQty = (index, delta) => {
    if (cart[index].quantity + delta > 0) cart[index].quantity += delta;
    else cart.splice(index, 1);
    updateCartUI();
};
window.removeFromCart = (index) => { cart.splice(index, 1); updateCartUI(); };
window.openCart = () => { document.getElementById('cart-modal').style.display = 'block'; };
window.closeCart = () => { document.getElementById('cart-modal').style.display = 'none'; };




// ==========================================
// 5. 會員與購買紀錄
// ==========================================
function updateAuthUI(name, gender) {
    const loginBtn = document.querySelector(".login-register-btn");
    if (loginBtn) {
        loginBtn.innerHTML = `<span class="user-welcome">您好，${name}${gender}</span>`;
        // 如果你想讓使用者點擊名字可以看個人資料，就不要設 none
        loginBtn.style.pointerEvents = "none";
    }
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.style.display = "inline";
}

document.getElementById("switchModeBtn").onclick = () => {
    isLoginMode = !isLoginMode;
    document.getElementById("modalTitle").innerText = isLoginMode ? "會員登入" : "帳號申請";
    document.getElementById("mainAuthBtn").innerText = isLoginMode ? "登入" : "註冊";
    document.getElementById("userInfoFields").style.display = isLoginMode ? "none" : "block";
    document.getElementById("switchModeBtn").innerText = isLoginMode ? "帳號申請" : "立即登入";
};

document.getElementById('authForm').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("authEmail").value;
    const password = document.getElementById("authPassword").value;
    
    try {
        if (isLoginMode) {
            // 執行登入
            await signInWithEmailAndPassword(auth, email, password);
            
            // 成功後跳轉通知
            await Swal.fire({
                icon: 'success',
                title: '登入成功',
                text: '歡迎回來！',
                timer: 1500,
                showConfirmButton: false
            });
        } else {
            // 執行註冊
            const name = document.getElementById("userName").value;
            const gender = document.getElementById("userGender").value;
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, "users", userCredential.user.uid), { name, gender, email });
            
            await Swal.fire({
                icon: 'success',
                title: '註冊成功',
                timer: 1500,
                showConfirmButton: false
            });
        }
        
        // 成功後關閉彈窗 (使用我們定義好的安全函式)
        window.closeAuthModal();
        
    } catch (error) {
        console.error("驗證過程出錯:", error);
        // 這邊才是真正的失敗通知
        Swal.fire({
            icon: 'error',
            title: '驗證失敗',
            text: error.message
        });
    }
};

window.handleLogout = async () => {
    await signOut(auth);
    alert("您已成功登出");
    location.reload();
};

window.showOrderHistory = async () => {
    if (!auth.currentUser) return Swal.fire('請先登入', '', 'info');
    Swal.fire({ title: '讀取紀錄中...', didOpen: () => Swal.showLoading() });

    try {
        const q = query(collection(db, "orders"), where("userId", "==", auth.currentUser.uid));
        const querySnapshot = await getDocs(q);
        let html = '<div style="text-align: left; max-height: 400px; overflow-y: auto;">';

        if (querySnapshot.empty) {
            html += '<p style="text-align:center;">尚無購買紀錄。</p>';
        } else {
            const docs = [];
            querySnapshot.forEach(doc => docs.push(doc.data()));
            docs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            docs.forEach(order => {
                html += `
                    <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
                        <small>${new Date(order.timestamp).toLocaleString()}</small>
                        <div style="font-weight:bold; color:#e44d26;">金額：$ ${order.totalAmount}</div>
                        <ul style="font-size:0.85rem;">${order.items.map(i => `<li>${i.name} x${i.quantity}</li>`).join('')}</ul>
                    </div>`;
            });
        }
        Swal.fire({ title: '購買紀錄', html: html + '</div>' });
    } catch (err) { Swal.fire('錯誤', '無法讀取紀錄', 'error'); }
};

// ==========================================
// 6. 結帳與其他
// ==========================================
window.checkout = async () => {
    // 1. 環境判斷：自動切換本地與雲端路徑
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE = isLocal ? 'http://localhost:3000' : '';

    if (!auth?.currentUser) {
        return Swal.fire({ 
            title: '請先登入', 
            icon: 'warning', 
            confirmButtonText: '前往登入' 
        }).then(r => {
            if (r.isConfirmed) { 
                closeCart(); 
                window.openAuthModal(); 
            }
        });
    }

    const originalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (originalPrice <= 0) return Swal.fire('購物車是空的', '', 'warning');

    const disc = calculateDiscount(originalPrice);
    const result = await Swal.fire({
        title: '確認結帳',
        html: `<p>商品原價：$${originalPrice}</p><p style="color:red;">優惠：${disc.discountName}</p><hr><h4>總額：$${disc.finalPrice}</h4>`,
        showCancelButton: true
    });

    if (result.isConfirmed) {
        try {
            Swal.showLoading();
            
            // 2. 先存檔到 Firebase (雲端資料庫)
            await addDoc(collection(db, "orders"), {
                userId: auth.currentUser.uid,
                items: cart.map(i => ({ name: i.name, price: i.price, quantity: i.quantity })),
                totalAmount: disc.finalPrice,
                timestamp: new Date().toISOString(),
                status: "待付款"
            });

            // 3. 呼叫金流 API (加上 API_BASE)
            const res = await fetch(`${API_BASE}/api/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    amount: disc.finalPrice,
                    itemName: "SHOP LOGO 商品組合" // 傳送商品名稱給金流
                })
            });

            if (!res.ok) throw new Error("金流伺服器連線失敗");

            const data = await res.json();
            
            // 4. 建立隱藏表單並自動提交至金流平台 (ECPay/NewebPay)
            const div = document.createElement('div');
            div.style.display = 'none'; // 隱藏表單
            div.innerHTML = data.html;
            document.body.appendChild(div);
            div.querySelector('form').submit();

        } catch (err) { 
            console.error("結帳出錯:", err);
            Swal.fire('結帳失敗', err.message, 'error'); 
        }
    }
};


// 關於我們
window.openAboutModal = () => {
    Swal.fire({
        title: '關於 SHOP LOGO',
        html: `
            <div style="text-align: left; line-height: 1.8;">
                <img src="Logo/Logo.png" alt="logo" class="logo-img" style="display: block; margin: 0 auto; width: 150px; height: auto;">                <p><strong>穿出城市的新節奏</strong></p>
                <p>我們專注於提供<strong>重磅大學T</strong>與<strong>機能防風外套</strong>，將高品質面料與現代剪裁結合。</p>
                <hr>
                <p>✅ 7天鑑賞期，購物最安心</p>
                <p>✅ 嚴選布料，舒適耐穿</p>
                <p>客服信箱：service@shoplogo.com</p>
            </div>
        `,
        confirmButtonText: '繼續購物',
        confirmButtonColor: '#3085d6'
    });
};

// 修正 5：在所有 window 事件監聽中加入安全檢查
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (typeof closeCart === 'function') closeCart();
        if (typeof closeProductDetail === 'function') closeProductDetail();
        if (authModal) authModal.style.display = 'none';
    }
});

// 統一使用一個函式來處理，HTML 中的 onclick="toggleMenu()" 會呼叫這裡
window.toggleMenu = (e) => {
    // 如果是從事件觸發，防止冒泡（避免點擊事件傳到 document 導致選單關閉）
    if (e) e.stopPropagation();

    // 建議使用 querySelector 比較保險，對應你的 HTML 結構
    const navLinks = document.querySelector('.nav-links');
    const menuToggle = document.querySelector('.menu-toggle');

    if (navLinks && menuToggle) {
        navLinks.classList.toggle('active');
        menuToggle.classList.toggle('active');
        console.log("選單狀態:", navLinks.classList.contains('active'));
    }
};

// 處理點擊選單外部關閉選單
document.addEventListener('click', (e) => {
    const navLinks = document.querySelector('.nav-links');
    const menuToggle = document.querySelector('.menu-toggle');

    // 如果點擊的地方不是選單本身，也不是漢堡按鈕，就關閉
    if (navLinks && navLinks.classList.contains('active')) {
        if (!navLinks.contains(e.target) && !menuToggle.contains(e.target)) {
            navLinks.classList.remove('active');
            menuToggle.classList.remove('active');
        }
    }
});

// 修正：表單切換按鈕的事件綁定
// 由於這個按鈕在 HTML 裡沒寫 onclick，我們要在 JS 裡確保抓得到它
document.addEventListener('DOMContentLoaded', () => {
    const switchBtn = document.getElementById("switchModeBtn");
    if (switchBtn) {
        switchBtn.onclick = () => {
            isLoginMode = !isLoginMode;
            document.getElementById("modalTitle").innerText = isLoginMode ? "會員登入" : "帳號申請";
            document.getElementById("mainAuthBtn").innerText = isLoginMode ? "登入" : "註冊";
            document.getElementById("userInfoFields").style.display = isLoginMode ? "none" : "block";
            switchBtn.innerText = isLoginMode ? "帳號申請" : "立即登入";
        };
    }
});

startApp();