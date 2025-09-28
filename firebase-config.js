// Firebase 配置
// 贰万UCLA店缺货统计系统 Firebase配置
const firebaseConfig = {
    apiKey: "AIzaSyDaEFljR6wxQaPj_4YH7hWFgR6ZGU8_2mY",
    authDomain: "erwan-inventory-system.firebaseapp.com",
    projectId: "erwan-inventory-system",
    storageBucket: "erwan-inventory-system.firebasestorage.app",
    messagingSenderId: "707188745863",
    appId: "1:707188745863:web:f4c9cbf0e84b03a0daba22",
    measurementId: "G-M8KHPCT1L0"
};

// 检查Firebase是否可用
let db = null;
let auth = null;

try {
    // 初始化Firebase
    firebase.initializeApp(firebaseConfig);
    
    // 获取Firestore和Auth实例
    db = firebase.firestore();
    auth = firebase.auth();
    
    console.log('Firebase初始化成功 - 贰万UCLA店缺货统计系统');
} catch (error) {
    console.warn('Firebase初始化失败，将使用本地存储模式:', error.message);
    db = null;
    auth = null;
}

// 导出供其他文件使用
window.db = db;
window.auth = auth;
