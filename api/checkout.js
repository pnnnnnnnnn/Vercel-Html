const crypto = require('crypto');

// 綠界測試帳號設定
const MerchantID = '3002607';
const HashKey = 'pwFHCqoQZGmho4w6';
const HashIV = 'EkRm7iFT261dpevs';

function generateCheckMacValue(params, key, iv) {
    const sortedKeys = Object.keys(params).sort();
    let rawStr = `HashKey=${key}&` + sortedKeys.map(k => `${k}=${params[k]}`).join('&') + `&HashIV=${iv}`;
    let urlEncoded = encodeURIComponent(rawStr).toLowerCase()
        .replace(/%20/g, '+').replace(/%2d/g, '-').replace(/%5f/g, '_').replace(/%2e/g, '.')
        .replace(/%21/g, '!').replace(/%2a/g, '*').replace(/%28/g, '(').replace(/%29/g, ')');
    return crypto.createHash('sha256').update(urlEncoded).digest('hex').toUpperCase();
}

export default function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { amount } = req.body;
    const date = new Date();
    const formattedDate = date.getFullYear() + '/' +
        ('0' + (date.getMonth() + 1)).slice(-2) + '/' +
        ('0' + date.getDate()).slice(-2) + ' ' +
        ('0' + date.getHours()).slice(-2) + ':' +
        ('0' + date.getMinutes()).slice(-2) + ':' +
        ('0' + date.getSeconds()).slice(-2);

    // 自動判斷目前網址 (用於 ClientBackURL)
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['host'];
    const baseUrl = `${protocol}://${host}`;

    const base_param = {
        MerchantID: MerchantID,
        MerchantTradeNo: 'SHOP' + Date.now(),
        MerchantTradeDate: formattedDate,
        PaymentType: 'aio',
        TotalAmount: amount.toString(),
        TradeDesc: 'Shoplogo測試訂單',
        ItemName: '商城商品',
        ReturnURL: 'https://www.ecpay.com.tw/receive.php', // 綠界接收結果用
        ChoosePayment: 'ALL',
        EncryptType: '1',
        ClientBackURL: baseUrl, // 支付完跳回你的網站
    };

    base_param.CheckMacValue = generateCheckMacValue(base_param, HashKey, HashIV);

    let formHtml = `<form id="_form_aio_checkout" action="https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5" method="post">`;
    for (let key in base_param) {
        formHtml += `<input type="hidden" name="${key}" value="${base_param[key]}" />`;
    }
    formHtml += `</form><script type="text/javascript">document.getElementById("_form_aio_checkout").submit();</script>`;

    res.status(200).json({ html: formHtml });
}