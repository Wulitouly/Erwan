// 多用户实时同步的餐厅缺货统计系统

class MultiUserShortageTracker {
    constructor() {
        this.shortages = [];
        this.currentEditingId = null;
        this.currentUser = null;
        this.isOnline = false;
        this.lastCheckDate = this.getLastCheckDate();
        this.dateCheckInterval = null;
        this.unsubscribe = null;
        this.init();
    }

    // 初始化
    async init() {
        this.bindEvents();
        await this.initializeFirebase();
        this.checkDateChange();
        this.startDateMonitoring();
        this.setupRealtimeListener();
    }

    // 初始化Firebase连接
    async initializeFirebase() {
        try {
            // 检查Firebase是否可用
            if (typeof firebase === 'undefined' || !db) {
                console.warn('Firebase未配置或未加载，使用本地存储模式');
                this.isOnline = false;
                this.updateConnectionStatus();
                this.loadDataFromLocal();
                return;
            }

            // 测试Firebase连接
            await db.collection('test').doc('connection').get();
            this.isOnline = true;
            this.updateConnectionStatus();
            console.log('Firebase连接成功');
        } catch (error) {
            console.warn('Firebase连接失败，使用本地存储模式:', error);
            this.isOnline = false;
            this.updateConnectionStatus();
            this.loadDataFromLocal();
        }
    }

    // 设置实时监听器
    setupRealtimeListener() {
        if (!this.isOnline) return;

        try {
            this.unsubscribe = db.collection('shortages')
                .orderBy('timestamp', 'desc')
                .onSnapshot((snapshot) => {
                    this.shortages = [];
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        this.shortages.push({
                            id: doc.id,
                            ...data
                        });
                    });
                    this.updateDisplay();
                    console.log('实时数据同步:', this.shortages.length, '条记录');
                }, (error) => {
                    console.error('实时监听错误:', error);
                    this.isOnline = false;
                    this.updateConnectionStatus();
                });
        } catch (error) {
            console.error('设置实时监听失败:', error);
        }
    }

    // 更新连接状态显示
    updateConnectionStatus() {
        const statusEl = document.getElementById('connectionStatus');
        if (!statusEl) return;

        const indicator = statusEl.querySelector('.status-indicator');
        const text = statusEl.querySelector('span:last-child');

        if (this.isOnline) {
            indicator.className = 'status-indicator online';
            text.textContent = '已连接 - 实时同步';
        } else {
            indicator.className = 'status-indicator offline';
            text.textContent = '离线模式 - 本地存储';
        }
    }

    // 绑定事件
    bindEvents() {
        // 用户身份设置
        document.getElementById('setUserName').addEventListener('click', () => {
            this.setUserIdentity();
        });

        document.getElementById('userName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.setUserIdentity();
            }
        });

        // 表单提交
        document.getElementById('shortageForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitShortage();
        });

        // 表单重置时清空编辑状态
        document.getElementById('shortageForm').addEventListener('reset', () => {
            this.cancelEdit();
        });

        // 导出按钮
        document.getElementById('exportExcel').addEventListener('click', () => {
            this.exportToExcel();
        });

        document.getElementById('exportSummary').addEventListener('click', () => {
            this.exportSummary();
        });

        document.getElementById('historyData').addEventListener('click', () => {
            this.showHistoryModal();
        });

        // 弹窗事件
        document.getElementById('editBtn').addEventListener('click', () => {
            this.editShortage();
        });

        document.getElementById('deleteBtn').addEventListener('click', () => {
            this.deleteShortage();
        });

        document.getElementById('markRestockedBtn').addEventListener('click', () => {
            this.markAsRestocked();
        });

        // 关闭弹窗
        document.querySelector('.close').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('actionModal').addEventListener('click', (e) => {
            if (e.target.id === 'actionModal') {
                this.closeModal();
            }
        });

        // 历史数据弹窗事件
        document.getElementById('historyDateSelect').addEventListener('change', (e) => {
            this.loadHistoryData(e.target.value);
        });

        document.getElementById('exportHistoryBtn').addEventListener('click', () => {
            this.exportHistoryData();
        });

        document.getElementById('historyModal').addEventListener('click', (e) => {
            if (e.target.id === 'historyModal') {
                this.closeHistoryModal();
            }
        });

        // 历史数据弹窗关闭按钮
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                if (e.target.closest('#historyModal')) {
                    this.closeHistoryModal();
                } else {
                    this.closeModal();
                }
            });
        });
    }

    // 设置用户身份
    setUserIdentity() {
        const userName = document.getElementById('userName').value.trim();
        if (!userName) {
            this.showMessage('请输入您的姓名！', 'warning');
            return;
        }

        this.currentUser = userName;
        localStorage.setItem('currentUser', userName);
        
        // 更新上报人字段
        document.getElementById('reporter').value = userName;
        document.getElementById('reporter').readOnly = true;
        
        this.showMessage(`身份确认成功：${userName}`, 'success');
        
        // 隐藏用户身份设置
        const userIdentity = document.getElementById('userIdentity');
        userIdentity.innerHTML = `
            <span>👤 当前用户：${userName}</span>
            <button id="changeUser" class="user-btn">切换用户</button>
        `;
        
        document.getElementById('changeUser').addEventListener('click', () => {
            this.resetUserIdentity();
        });
    }

    // 重置用户身份
    resetUserIdentity() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        document.getElementById('reporter').value = '';
        document.getElementById('reporter').readOnly = false;
        
        const userIdentity = document.getElementById('userIdentity');
        userIdentity.innerHTML = `
            <span>👤 用户身份：</span>
            <input type="text" id="userName" placeholder="请输入您的姓名" maxlength="20">
            <button id="setUserName" class="user-btn">确认身份</button>
        `;
        
        document.getElementById('setUserName').addEventListener('click', () => {
            this.setUserIdentity();
        });
    }

    // 提交缺货信息
    async submitShortage() {
        if (!this.currentUser) {
            this.showMessage('请先确认您的身份！', 'warning');
            return;
        }

        const form = document.getElementById('shortageForm');
        const formData = new FormData(form);
        
        const existingRecord = this.currentEditingId ? 
            this.shortages.find(s => s.id === this.currentEditingId) : null;
            
        // 使用洛杉矶时区计算日期
        const now = new Date();
        const laTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
        const laDateStr = laTime.toISOString().split('T')[0];
        const laTimestamp = laTime.toLocaleString('zh-CN');
        
        const shortage = {
            productName: formData.get('productName'),
            category: formData.get('category'),
            shortageLevel: formData.get('shortageLevel'),
            reporter: this.currentUser, // 使用当前用户
            notes: formData.get('notes'),
            timestamp: existingRecord ? existingRecord.timestamp : laTimestamp,
            date: existingRecord ? existingRecord.date : laDateStr,
            isRestocked: existingRecord ? existingRecord.isRestocked : false,
            restockedTime: existingRecord ? existingRecord.restockedTime : null
        };

        // 验证必填字段
        if (!shortage.productName || !shortage.category || !shortage.shortageLevel) {
            this.showMessage('请填写所有必填字段！', 'warning');
            return;
        }

        try {
            if (this.currentEditingId) {
                // 编辑模式：更新现有记录
                if (this.isOnline) {
                    await db.collection('shortages').doc(this.currentEditingId).update(shortage);
                } else {
                    const index = this.shortages.findIndex(s => s.id === this.currentEditingId);
                    if (index !== -1) {
                        this.shortages[index] = { ...shortage, id: this.currentEditingId };
                        this.saveDataToLocal();
                    }
                }
                this.showMessage('缺货信息修改成功！', 'success');
            } else {
                // 新增模式：添加新记录
                if (this.isOnline) {
                    await db.collection('shortages').add(shortage);
                } else {
                    shortage.id = Date.now();
                    this.shortages.push(shortage);
                    this.saveDataToLocal();
                }
                this.showMessage('缺货信息提交成功！', 'success');
            }

            this.updateDisplay();
            form.reset();
            document.getElementById('reporter').value = this.currentUser;
            document.getElementById('reporter').readOnly = true;
            
            // 重置按钮状态
            const submitBtn = document.querySelector('.submit-btn');
            submitBtn.textContent = '📤 提交缺货信息';
            submitBtn.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
            
            this.currentEditingId = null;
        } catch (error) {
            console.error('提交失败:', error);
            this.showMessage('提交失败，请重试！', 'error');
        }
    }

    // 更新显示
    updateDisplay() {
        this.updateStats();
        this.updateRecentList();
    }

    // 更新统计数据
    updateStats() {
        // 使用洛杉矶时区计算今日
        const now = new Date();
        const laTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
        const todayStr = laTime.toISOString().split('T')[0];
        
        const todayShortages = this.shortages.filter(s => s.date === todayStr);
        
        const totalShortages = todayShortages.length;
        const urgentShortages = todayShortages.filter(s => 
            s.shortageLevel === '严重' || s.shortageLevel === '完全缺货'
        ).length;
        
        // 待补货：累积统计所有未完成的缺货记录
        const pendingRestock = this.getPendingRestockCount();

        document.getElementById('totalShortages').textContent = totalShortages;
        document.getElementById('urgentShortages').textContent = urgentShortages;
        document.getElementById('pendingRestock').textContent = pendingRestock;
    }

    // 更新当日上报列表
    updateRecentList() {
        const recentList = document.getElementById('recentList');
        
        // 使用洛杉矶时区计算今日
        const now = new Date();
        const laTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
        const todayStr = laTime.toISOString().split('T')[0];
        
        // 只显示今日的记录，按时间倒序排列，隐藏已补货的记录
        const todayShortages = this.shortages
            .filter(s => {
                const isToday = s.date === todayStr;
                const notRestocked = !s.isRestocked;
                return isToday && notRestocked;
            })
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (todayShortages.length === 0) {
            recentList.innerHTML = '<p class="no-data">今日暂无缺货记录</p>';
            return;
        }

        recentList.innerHTML = todayShortages.map(shortage => `
            <div class="shortage-item ${this.getUrgencyClass(shortage.shortageLevel)}" data-id="${shortage.id}" style="cursor: pointer;">
                <div class="shortage-header">
                    <span class="product-name">${shortage.productName}</span>
                    <span class="shortage-level ${shortage.shortageLevel}">${this.getShortageLevelText(shortage.shortageLevel)}</span>
                </div>
                <div class="shortage-details">
                    <div><strong>类别:</strong> ${shortage.category}</div>
                    <div><strong>上报人:</strong> ${shortage.reporter}</div>
                    <div><strong>时间:</strong> ${shortage.timestamp}</div>
                    ${shortage.notes ? `<div><strong>备注:</strong> ${shortage.notes}</div>` : ''}
                </div>
            </div>
        `).join('');

        // 为每个缺货记录添加点击事件
        recentList.querySelectorAll('.shortage-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const id = item.dataset.id;
                this.showActionModal(id);
            });
        });
    }

    // 获取待补货数量（累积统计）
    getPendingRestockCount() {
        // 获取所有未标记为已补货的记录
        const pendingShortages = this.shortages.filter(s => !s.isRestocked);
        return pendingShortages.length;
    }

    // 获取紧急程度样式类
    getUrgencyClass(level) {
        if (level === '严重' || level === '完全缺货') return 'urgent';
        return '';
    }

    // 获取缺货程度文本
    getShortageLevelText(level) {
        const levelMap = {
            '轻微': '🟡 轻微',
            '严重': '🔵 严重',
            '完全缺货': '🔴 完全缺货'
        };
        return levelMap[level] || level;
    }

    // 显示操作弹窗
    showActionModal(id) {
        this.currentEditingId = id;
        document.getElementById('actionModal').style.display = 'block';
    }

    // 关闭弹窗
    closeModal() {
        document.getElementById('actionModal').style.display = 'none';
    }

    // 编辑缺货记录
    editShortage() {
        if (!this.currentEditingId) return;
        
        const shortage = this.shortages.find(s => s.id === this.currentEditingId);
        if (!shortage) return;

        // 填充表单
        document.getElementById('productName').value = shortage.productName;
        document.getElementById('category').value = shortage.category;
        document.getElementById('shortageLevel').value = shortage.shortageLevel;
        document.getElementById('reporter').value = shortage.reporter;
        document.getElementById('notes').value = shortage.notes || '';

        // 更新提交按钮文本
        const submitBtn = document.querySelector('.submit-btn');
        submitBtn.textContent = '✏️ 修改缺货信息';
        submitBtn.style.background = 'linear-gradient(135deg, #f39c12, #e67e22)';

        // 滚动到表单
        document.querySelector('.input-section').scrollIntoView({ behavior: 'smooth' });
        
        this.closeModal();
        this.showMessage('请修改表单中的信息，然后点击修改按钮', 'info');
    }

    // 删除缺货记录
    async deleteShortage() {
        if (!this.currentEditingId) return;
        
        if (confirm('确定要删除这条缺货记录吗？')) {
            try {
                if (this.isOnline) {
                    await db.collection('shortages').doc(this.currentEditingId).delete();
                } else {
                    this.shortages = this.shortages.filter(s => s.id !== this.currentEditingId);
                    this.saveDataToLocal();
                }
                this.updateDisplay();
                this.closeModal();
                this.showMessage('缺货记录已删除！', 'warning');
            } catch (error) {
                console.error('删除失败:', error);
                this.showMessage('删除失败，请重试！', 'error');
            }
        }
    }

    // 标记为已补货
    async markAsRestocked() {
        if (!this.currentEditingId) return;
        
        const shortage = this.shortages.find(s => s.id === this.currentEditingId);
        if (!shortage) return;

        if (shortage.isRestocked) {
            this.showMessage('该记录已经标记为已补货！', 'info');
            return;
        }

        if (confirm('确定要将此商品标记为已补货吗？')) {
            try {
                const updateData = {
                    isRestocked: true,
                    restockedTime: new Date().toLocaleString('zh-CN')
                };

                if (this.isOnline) {
                    await db.collection('shortages').doc(this.currentEditingId).update(updateData);
                } else {
                    const index = this.shortages.findIndex(s => s.id === this.currentEditingId);
                    if (index !== -1) {
                        this.shortages[index] = { ...this.shortages[index], ...updateData };
                        this.saveDataToLocal();
                    }
                }

                this.updateDisplay();
                this.closeModal();
                this.showMessage('已标记为已补货！', 'success');
            } catch (error) {
                console.error('标记失败:', error);
                this.showMessage('标记失败，请重试！', 'error');
            }
        }
    }

    // 取消编辑
    cancelEdit() {
        this.currentEditingId = null;
        const submitBtn = document.querySelector('.submit-btn');
        submitBtn.textContent = '📤 提交缺货信息';
        submitBtn.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
    }

    // 从本地存储加载数据
    loadDataFromLocal() {
        const data = localStorage.getItem('restaurantShortages');
        this.shortages = data ? JSON.parse(data) : [];
        this.updateDisplay();
    }

    // 保存数据到本地存储
    saveDataToLocal() {
        localStorage.setItem('restaurantShortages', JSON.stringify(this.shortages));
    }

    // 获取上次检查日期
    getLastCheckDate() {
        const lastCheck = localStorage.getItem('lastCheckDate');
        if (lastCheck) {
            return new Date(lastCheck);
        } else {
            const now = new Date();
            const laTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
            return laTime;
        }
    }

    // 检查日期变化
    checkDateChange() {
        const now = new Date();
        const laTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
        const todayStr = laTime.toISOString().split('T')[0];
        const lastCheckStr = this.lastCheckDate.toISOString().split('T')[0];
        
        if (todayStr !== lastCheckStr) {
            this.saveHistoryData();
            this.clearTodayDisplay();
            this.lastCheckDate = now;
            localStorage.setItem('lastCheckDate', now.toISOString());
            this.showMessage('新的一天开始了！昨日数据已保存到历史记录中。', 'info');
        }
    }

    // 保存历史数据
    saveHistoryData() {
        const now = new Date();
        const laTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
        const yesterday = new Date(laTime);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        const yesterdayShortages = this.shortages.filter(s => s.date === yesterdayStr);
        if (yesterdayShortages.length > 0) {
            const historyData = JSON.parse(localStorage.getItem('shortageHistory') || '[]');
            historyData.push({
                date: yesterdayStr,
                shortages: yesterdayShortages,
                totalCount: yesterdayShortages.length,
                urgentCount: yesterdayShortages.filter(s => 
                    s.shortageLevel === '严重' || s.shortageLevel === '完全缺货'
                ).length
            });
            localStorage.setItem('shortageHistory', JSON.stringify(historyData));
        }
    }

    // 开始日期监控
    startDateMonitoring() {
        this.dateCheckInterval = setInterval(() => {
            this.checkDateChange();
        }, 60000);
    }

    // 清空当日显示
    clearTodayDisplay() {
        this.showMessage('新的一天开始了！昨日数据已保存到历史记录中。', 'info');
    }

    // 显示历史数据弹窗
    showHistoryModal() {
        this.loadHistoryDateOptions();
        document.getElementById('historyModal').style.display = 'block';
    }

    // 关闭历史数据弹窗
    closeHistoryModal() {
        document.getElementById('historyModal').style.display = 'none';
    }

    // 加载历史日期选项
    loadHistoryDateOptions() {
        const historyData = JSON.parse(localStorage.getItem('shortageHistory') || '[]');
        const select = document.getElementById('historyDateSelect');
        
        select.innerHTML = '<option value="">选择日期查看</option>';
        
        if (historyData.length === 0) {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            const option = document.createElement('option');
            option.value = yesterdayStr;
            option.textContent = `${yesterdayStr} (示例数据)`;
            select.appendChild(option);
            
            const sampleHistoryData = [{
                date: yesterdayStr,
                shortages: [
                    {
                        productName: '牛肉',
                        category: '肉类&肉汤',
                        shortageLevel: '严重',
                        reporter: '张三',
                        timestamp: '2024-01-15 10:30:00',
                        notes: '只剩2盒'
                    },
                    {
                        productName: '米饭',
                        category: '主食',
                        shortageLevel: '轻微',
                        reporter: '李四',
                        timestamp: '2024-01-15 14:20:00',
                        notes: '3天用量'
                    }
                ],
                totalCount: 2,
                urgentCount: 1
            }];
            
            localStorage.setItem('shortageHistory', JSON.stringify(sampleHistoryData));
            return;
        }
        
        historyData.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        historyData.forEach(day => {
            const option = document.createElement('option');
            option.value = day.date;
            option.textContent = `${day.date} (${day.totalCount}条记录)`;
            select.appendChild(option);
        });
    }

    // 加载历史数据
    loadHistoryData(date) {
        if (!date) {
            document.getElementById('historyContent').innerHTML = '<p class="no-data">请选择日期查看历史记录</p>';
            return;
        }

        const historyData = JSON.parse(localStorage.getItem('shortageHistory') || '[]');
        const dayData = historyData.find(d => d.date === date);
        
        if (!dayData) {
            document.getElementById('historyContent').innerHTML = '<p class="no-data">该日期没有历史记录</p>';
            return;
        }

        const content = document.getElementById('historyContent');
        content.innerHTML = `
            <div class="history-date-header">
                ${date} - 共 ${dayData.totalCount} 条记录，其中 ${dayData.urgentCount} 条紧急缺货
            </div>
            ${dayData.shortages.map(shortage => `
                <div class="history-item ${this.getUrgencyClass(shortage.shortageLevel)}">
                    <div class="history-item-header">
                        <span class="history-product-name">${shortage.productName}</span>
                        <span class="history-shortage-level ${shortage.shortageLevel}">${this.getShortageLevelText(shortage.shortageLevel)}</span>
                    </div>
                    <div class="history-details">
                        <div><strong>类别:</strong> ${shortage.category}</div>
                        <div><strong>上报人:</strong> ${shortage.reporter}</div>
                        <div><strong>时间:</strong> ${shortage.timestamp}</div>
                        ${shortage.notes ? `<div><strong>备注:</strong> ${shortage.notes}</div>` : ''}
                    </div>
                </div>
            `).join('')}
        `;
    }

    // 导出Excel报表
    exportToExcel() {
        const today = new Date().toISOString().split('T')[0];
        const todayShortages = this.shortages.filter(s => s.date === today);
        
        if (todayShortages.length === 0) {
            alert('今日暂无缺货数据可导出！');
            return;
        }

        const headers = ['产品名称', '类别', '缺货程度', '上报人', '备注', '上报时间'];
        const csvContent = [
            headers.join(','),
            ...todayShortages.map(s => [
                s.productName,
                s.category,
                s.shortageLevel,
                s.reporter,
                s.notes || '',
                s.timestamp
            ].map(field => `"${field}"`).join(','))
        ].join('\n');

        this.downloadFile(csvContent, `缺货统计_${today}.csv`, 'text/csv');
        this.showMessage('Excel报表导出成功！', 'success');
    }

    // 导出汇总报告
    exportSummary() {
        const today = new Date().toISOString().split('T')[0];
        const todayShortages = this.shortages.filter(s => s.date === today);
        
        if (todayShortages.length === 0) {
            alert('今日暂无缺货数据可导出！');
            return;
        }

        const categoryStats = {};
        const levelStats = {};
        
        todayShortages.forEach(s => {
            categoryStats[s.category] = (categoryStats[s.category] || 0) + 1;
            levelStats[s.shortageLevel] = (levelStats[s.shortageLevel] || 0) + 1;
        });

        let report = `餐厅缺货统计汇总报告\n`;
        report += `生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
        report += `统计日期: ${today}\n\n`;
        
        report += `=== 总体统计 ===\n`;
        report += `总缺货项数: ${todayShortages.length}\n`;
        report += `涉及类别数: ${Object.keys(categoryStats).length}\n\n`;
        
        report += `=== 按类别统计 ===\n`;
        Object.entries(categoryStats)
            .sort((a, b) => b[1] - a[1])
            .forEach(([category, count]) => {
                report += `${category}: ${count}项\n`;
            });
        
        report += `\n=== 按缺货程度统计 ===\n`;
        Object.entries(levelStats)
            .sort((a, b) => b[1] - a[1])
            .forEach(([level, count]) => {
                report += `${level}: ${count}项\n`;
            });
        
        report += `\n=== 详细缺货清单 ===\n`;
        todayShortages.forEach((s, index) => {
            report += `${index + 1}. ${s.productName} (${s.category}) - ${s.shortageLevel}\n`;
            report += `   上报人: ${s.reporter} | 时间: ${s.timestamp}\n`;
            if (s.notes) report += `   备注: ${s.notes}\n`;
            report += `\n`;
        });

        this.downloadFile(report, `缺货汇总报告_${today}.txt`, 'text/plain');
        this.showMessage('汇总报告导出成功！', 'success');
    }

    // 导出历史数据
    exportHistoryData() {
        const selectedDate = document.getElementById('historyDateSelect').value;
        if (!selectedDate) {
            alert('请先选择要导出的日期！');
            return;
        }

        const historyData = JSON.parse(localStorage.getItem('shortageHistory') || '[]');
        const dayData = historyData.find(d => d.date === selectedDate);
        
        if (!dayData) {
            alert('该日期没有历史记录！');
            return;
        }

        const headers = ['产品名称', '类别', '缺货程度', '上报人', '备注', '上报时间'];
        const csvContent = [
            headers.join(','),
            ...dayData.shortages.map(s => [
                s.productName,
                s.category,
                s.shortageLevel,
                s.reporter,
                s.notes || '',
                s.timestamp
            ].map(field => `"${field}"`).join(','))
        ].join('\n');

        this.downloadFile(csvContent, `历史缺货记录_${selectedDate}.csv`, 'text/csv');
        this.showMessage('历史数据导出成功！', 'success');
    }

    // 下载文件
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // 显示消息
    showMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 10px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            animation: slideIn 0.3s ease;
            max-width: 300px;
        `;

        const colors = {
            success: '#27ae60',
            warning: '#f39c12',
            error: '#e74c3c',
            info: '#3498db'
        };
        messageEl.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(messageEl);

        setTimeout(() => {
            messageEl.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
    }

    // 清理资源
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        if (this.dateCheckInterval) {
            clearInterval(this.dateCheckInterval);
        }
    }
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 检查是否有保存的用户身份
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        document.getElementById('userName').value = savedUser;
    }
    
    new MultiUserShortageTracker();
});
