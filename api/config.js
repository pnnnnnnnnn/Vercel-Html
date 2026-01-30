export default function handler(req, res) {
    // 設定 CORS，允許前端存取
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 回傳 Firebase 配置
    res.status(200).json({
        apiKey: "AIzaSyAJe0-R8i6Q7W2a-tL8Wmo5dy7ypP2eQLE",
        authDomain: "pnpn-99c5a.firebaseapp.com",
        projectId: "pnpn-99c5a",
        storageBucket: "pnpn-99c5a.firebasestorage.app",
        messagingSenderId: "950085205947",
        appId: "1:950085205947:web:1afee53e9425fe662d8e9e"
    });
}