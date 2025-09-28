// Firebase 配置
// 注意：这是示例配置，您需要替换为实际的Firebase项目配置
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id"
};

// 初始化Firebase
firebase.initializeApp(firebaseConfig);

// 获取Firestore和Auth实例
const db = firebase.firestore();
const auth = firebase.auth();

// 导出供其他文件使用
window.db = db;
window.auth = auth;
