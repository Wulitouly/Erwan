# Firebase 多用户同步设置指南

## 🚀 快速开始

### 1. 创建Firebase项目

1. 访问 [Firebase Console](https://console.firebase.google.com/)
2. 点击"创建项目"
3. 输入项目名称：`restaurant-inventory-system`
4. 选择是否启用Google Analytics（可选）
5. 点击"创建项目"

### 2. 启用Firestore数据库

1. 在Firebase控制台中，点击左侧菜单的"Firestore Database"
2. 点击"创建数据库"
3. 选择"测试模式"（允许读写，适合开发）
4. 选择数据库位置（建议选择离您最近的区域）
5. 点击"完成"

### 3. 获取配置信息

1. 在Firebase控制台中，点击左侧菜单的"项目设置"（齿轮图标）
2. 滚动到"您的应用"部分
3. 点击"Web"图标（</>）
4. 输入应用昵称：`restaurant-inventory-web`
5. 点击"注册应用"
6. 复制配置对象，类似这样：

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef..."
};
```

### 4. 更新配置文件

将获取的配置信息替换到 `firebase-config.js` 文件中：

```javascript
const firebaseConfig = {
    apiKey: "你的API密钥",
    authDomain: "你的项目.firebaseapp.com",
    projectId: "你的项目ID",
    storageBucket: "你的项目.appspot.com",
    messagingSenderId: "你的发送者ID",
    appId: "你的应用ID"
};
```

### 5. 设置安全规则（可选）

在Firestore控制台中，点击"规则"标签，可以设置更严格的安全规则：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 允许所有读写（仅用于测试）
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## 🔧 功能特性

### ✅ 已实现功能

- **实时同步**：多用户同时看到数据更新
- **用户身份识别**：区分不同员工
- **离线支持**：网络断开时自动切换到本地存储
- **数据安全**：自动备份到云端
- **历史记录**：保存历史数据供查询

### 📱 使用方式

1. **打开多用户版本**：`index-multiuser.html`
2. **设置用户身份**：输入姓名并确认
3. **开始使用**：所有功能与单机版相同
4. **实时同步**：其他用户的操作会实时显示

## 🛠️ 故障排除

### 问题1：连接失败
- 检查网络连接
- 确认Firebase配置正确
- 查看浏览器控制台错误信息

### 问题2：数据不同步
- 刷新页面
- 检查Firebase控制台中的数据
- 确认安全规则设置正确

### 问题3：用户身份丢失
- 重新输入姓名
- 检查浏览器localStorage

## 💡 高级配置

### 生产环境安全规则

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 只允许认证用户访问
    match /shortages/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 数据备份

Firebase会自动备份数据，您也可以：
1. 在Firestore控制台导出数据
2. 设置定期备份
3. 使用Firebase CLI进行数据管理

## 📞 技术支持

如果遇到问题：
1. 查看浏览器控制台错误信息
2. 检查Firebase控制台中的数据
3. 确认网络连接正常
4. 尝试清除浏览器缓存

## 🎯 下一步

设置完成后，您的餐厅库存系统将支持：
- 多员工同时使用
- 实时数据同步
- 云端数据备份
- 离线功能支持

享受多用户协作的便利！🎉
