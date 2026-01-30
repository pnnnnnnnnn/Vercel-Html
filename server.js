const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto'); // 使用內建加密模組
const cors = require('cors');

const app = express();
app.use(cors());
// 讓後端可以讀取到你放在同一個資料夾的前端 HTML、JS、CSS 檔案
app.use(express.static('./'));
//設定後端抓不到資料庫API問題
app.get('/api/config', (req, res) => {
    res.json({
        apiKey: "AIzaSyAJe0-R8i6Q7W2a-tL8Wmo5dy7ypP2eQLE",
        authDomain: "pnpn-99c5a.firebaseapp.com",
        projectId: "pnpn-99c5a",
        storageBucket: "pnpn-99c5a.firebasestorage.app",
        messagingSenderId: "950085205947",
        appId: "1:950085205947:web:1afee53e9425fe662d8e9e"
    });
});


// 處理首頁路由，讓網址打開不會出現 Cannot GET /
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- 綠界測試帳號設定 ---
const MerchantID = '3002607';
const HashKey = 'pwFHCqoQZGmho4w6';
const HashIV = 'EkRm7iFT261dpevs';

// --- 檢查碼 (CheckMacValue) 計算函式 ---
function generateCheckMacValue(params, key, iv) {
    const sortedKeys = Object.keys(params).sort();
    let rawStr = `HashKey=${key}&` + sortedKeys.map(k => `${k}=${params[k]}`).join('&') + `&HashIV=${iv}`;

    // 轉為 URL 編碼並處理特殊字元
    let urlEncoded = encodeURIComponent(rawStr).toLowerCase()
        .replace(/%20/g, '+')
        .replace(/%2d/g, '-')
        .replace(/%5f/g, '_')
        .replace(/%2e/g, '.')
        .replace(/%21/g, '!')
        .replace(/%2a/g, '*')
        .replace(/%28/g, '(')
        .replace(/%29/g, ')');

    return crypto.createHash('sha256').update(urlEncoded).digest('hex').toUpperCase();
}

// --- 結帳 API ---
app.post('/api/checkout', (req, res) => {
    const { amount } = req.body;
    const date = new Date();
    const formattedDate = date.getFullYear() + '/' +
        ('0' + (date.getMonth() + 1)).slice(-2) + '/' +
        ('0' + date.getDate()).slice(-2) + ' ' +
        ('0' + date.getHours()).slice(-2) + ':' +
        ('0' + date.getMinutes()).slice(-2) + ':' +
        ('0' + date.getSeconds()).slice(-2);

    const base_param = {
        MerchantID: MerchantID,
        MerchantTradeNo: 'SHOP' + Date.now(),
        MerchantTradeDate: formattedDate,
        PaymentType: 'aio',
        TotalAmount: amount.toString(),
        TradeDesc: 'Shoplogo測試訂單',
        ItemName: '商城商品',
        ReturnURL: 'https://www.ecpay.com.tw/receive.php',
        ChoosePayment: 'ALL',
        EncryptType: '1',
        ClientBackURL: 'http://localhost:3000',
    };

    // 計算檢查碼
    base_param.CheckMacValue = generateCheckMacValue(base_param, HashKey, HashIV);

    // 產生自動提交表單
    let formHtml = `<form id="_form_aio_checkout" action="https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5" method="post">`;
    for (let key in base_param) {
        formHtml += `<input type="hidden" name="${key}" value="${base_param[key]}" />`;
    }
    formHtml += `</form><script type="text/javascript">document.getElementById("_form_aio_checkout").submit();</script>`;

    res.send({ html: formHtml });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 伺服器啟動成功：http://localhost:${PORT}`));