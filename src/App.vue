<script setup>
import { ref, computed } from 'vue'
import NewTaskForm from './components/NewTaskForm.vue'
import DataImport from './components/DataImport.vue'
import bookingData from './data/bookings.json'
import ordersData from './data/orders.json'
import productsData from './data/products.json'
import suppliersData from './data/suppliers.json'
import { generatePaymentBookings } from './utils/paymentGenerator.js'

const bookings = ref(bookingData)
const filterStatus = ref('All') // 'All', 'Pending', 'Paid'
const showNewTaskModal = ref(false)
const showSmartGenerateModal = ref(false)
const showDataImportModal = ref(false)
const selectedOrderId = ref('')

// 加载订单、产品和供应商数据
const orders = ref(ordersData)
const products = ref(productsData)
const suppliers = ref(suppliersData)

const paymentTasks = computed(() => {
  let filteredTasks = []
  bookings.value.forEach(booking => {
    booking.paymentTasks.forEach(task => {
      if (filterStatus.value === 'All' || task.paymentStatus === filterStatus.value) {
        filteredTasks.push({
          ...task,
          supplierName: booking.supplierName,
          relatedCustomerOrder: booking.relatedCustomerOrder,
          supplierType: booking.supplierType // 确保从 booking 传递 supplierType
        })
      }
    })
  })

  // 让任务默认按日期升序排列
  return filteredTasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
})

// --- 新增的核心逻辑在这里 ---
/**
 * 根据任务返回对应的 CSS class，用于高亮
 * @param {object} task - 支付任务对象
 */
function getTaskRowClass(task) {
  // 如果任务已支付，则不添加任何特殊颜色
  if (task.paymentStatus === 'Paid') {
    return 'bg-white hover:bg-gray-50'
  }

  // 获取今天的日期，并将时间设置为 00:00:00，以便于精确比较
  const today = new Date('2025-10-19T12:00:00') // 我们固定“今天”的日期，以便于演示
  today.setHours(0, 0, 0, 0)

  const dueDate = new Date(task.dueDate)
  dueDate.setHours(0, 0, 0, 0)

  // 计算截止日期和今天相差的天数
  const diffTime = dueDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    // 截止日期在今天之前，说明已逾期
    return 'bg-red-100 hover:bg-red-200'
  }
  if (diffDays >= 0 && diffDays <= 1) {
    // 截止日期是今天或明天，说明很紧急
    return 'bg-yellow-100 hover:bg-yellow-200'
  }
  
  // 其他情况（未来才到期的任务）
  return 'bg-white hover:bg-gray-50'
}
// --- 核心逻辑结束 ---

/**
 * 将任务标记为已支付
 * @param {string} taskId - 任务的唯一ID
 */
function addTask(taskData) {
  // 这是一个简化逻辑：我们尝试找到一个已有的 booking，或者创建一个新的
  let booking = bookings.value.find(b => b.supplierName === taskData.supplierName);

  if (!booking) {
    // 如果供应商不存在，则创建一个新的 booking 结构
    booking = {
      bookingId: `BOOK-${Date.now()}`,
      supplierName: taskData.supplierName,
      relatedCustomerOrder: taskData.relatedCustomerOrder,
      supplierType: taskData.supplierType,
      bookingStatus: 'InProgress',
      paymentTasks: []
    };
    bookings.value.push(booking);
  }

  // 为新任务创建一个唯一的 taskId
  const newTask = {
    taskId: `TASK-${Date.now()}`,
    taskType: taskData.taskType,
    description: taskData.description,
    amountDue: taskData.amountDue,
    dueDate: taskData.dueDate,
    paymentStatus: 'Pending',
    actualPaymentDate: null,
    invoiceLink: null
  };

  booking.paymentTasks.push(newTask);
  showNewTaskModal.value = false; // 关闭模态框
}

function addInvoiceLink(taskId) {
  const link = prompt('请输入票据链接：');
  if (link) {
    for (const booking of bookings.value) {
      const task = booking.paymentTasks.find(t => t.taskId === taskId);
      if (task) {
        task.invoiceLink = link;
        break;
      }
    }
  }
}

function markAsPaid(taskId) {
  // 遍历所有预订以找到并更新特定的任务
  for (const booking of bookings.value) {
    const task = booking.paymentTasks.find(t => t.taskId === taskId);
    if (task) {
      task.paymentStatus = 'Paid';
      // 使用当前日期作为实际支付日期
      task.actualPaymentDate = new Date().toISOString().split('T')[0];
      break; // 找到并更新后，退出循环
    }
  }
}

/**
 * 处理数据导入
 */
function handleDataImport({ type, data }) {
  if (type === 'batch') {
    // 批量导入：data 是一个对象，包含 products, suppliers, orders
    let updateCount = 0
    const updates = []
    
    if (data.products) {
      products.value = data.products
      updateCount += data.products.length
      updates.push(`产品 ${data.products.length} 条`)
      console.log('产品数据已更新:', data.products.length, '条')
    }
    
    if (data.suppliers) {
      suppliers.value = data.suppliers
      updateCount += data.suppliers.length
      updates.push(`供应商 ${data.suppliers.length} 条`)
      console.log('供应商数据已更新:', data.suppliers.length, '条')
    }
    
    if (data.orders) {
      orders.value = data.orders
      updateCount += data.orders.length
      updates.push(`订单 ${data.orders.length} 条`)
      console.log('订单数据已更新:', data.orders.length, '条')
    }
    
    alert(`批量导入成功！\n共更新 ${updateCount} 条数据：\n${updates.join('\n')}`)
  } else {
    // 单个导入
    switch (type) {
      case 'orders':
        orders.value = data
        console.log('订单数据已更新:', data.length, '条')
        break
      case 'products':
        products.value = data
        console.log('产品数据已更新:', data.length, '条')
        break
      case 'suppliers':
        suppliers.value = data
        console.log('供应商数据已更新:', data.length, '条')
        break
    }
  }
}

/**
 * 智能生成付款预订
 */
function handleSmartGenerate() {
  if (!selectedOrderId.value) {
    alert('请选择一个订单！');
    return;
  }

  // 调用智能生成器
  const newBookings = generatePaymentBookings(
    selectedOrderId.value,
    orders.value,
    products.value,
    suppliers.value
  );

  if (newBookings.length > 0) {
    // 将生成的 bookings 添加到现有列表中
    bookings.value.push(...newBookings);
    alert(`成功生成 ${newBookings.length} 个付款预订！`);
    showSmartGenerateModal.value = false;
    selectedOrderId.value = '';
  } else {
    alert('生成失败，请检查订单信息！');
  }
}

</script>

<template>
  <div class="bg-gray-100 min-h-screen p-8 font-sans">
    <h1 class="text-3xl font-bold mb-6 text-gray-800">供应商付款看板</h1>

    <div class="mb-4 flex justify-between items-center">
      <div class="flex space-x-2">
      <button @click="filterStatus = 'All'" :class="['px-4 py-2 rounded-md text-sm font-medium', filterStatus === 'All' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50']">全部</button>
      <button @click="filterStatus = 'Pending'" :class="['px-4 py-2 rounded-md text-sm font-medium', filterStatus === 'Pending' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50']">待处理</button>
      <button @click="filterStatus = 'Paid'" :class="['px-4 py-2 rounded-md text-sm font-medium', filterStatus === 'Paid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50']">已支付</button>
      </div>
      <div class="flex space-x-2">
        <button @click="showDataImportModal = true" class="bg-orange-500 text-white px-4 py-2 rounded-md font-medium hover:bg-orange-600">数据导入</button>
        <button @click="showSmartGenerateModal = true" class="bg-purple-500 text-white px-4 py-2 rounded-md font-medium hover:bg-purple-600">智能生成</button>
        <button @click="showNewTaskModal = true" class="bg-green-500 text-white px-4 py-2 rounded-md font-medium hover:bg-green-600">新增付款</button>
      </div>
    </div>
    
    <div class="bg-white rounded-lg shadow overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
          <tr>
        <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">应付日期</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">供应商</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">类型</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">任务描述</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">关联订单</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">应付金额</th>
        <th scope="col" class="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">状态</th>
        <th scope="col" class="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">操作</th>
        <th scope="col" class="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">票据</th>
          </tr>
        </thead>
      
      <tbody v-if="paymentTasks.length > 0" class="bg-white divide-y divide-gray-200">
        <tr 
          v-for="task in paymentTasks" 
          :key="task.taskId"
          class="transition-colors duration-200"
          :class="getTaskRowClass(task)"
        >
          <td class="px-6 py-4 whitespace-nowrap font-medium" :class="{'text-red-700': getTaskRowClass(task).includes('red'), 'text-yellow-800': getTaskRowClass(task).includes('yellow')}">
            {{ task.dueDate }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{{ task.supplierName }}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ task.supplierType }}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{{ task.description }}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ task.relatedCustomerOrder }}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-800">¥{{ task.amountDue.toFixed(2) }}</td>
          <td class="px-6 py-4 whitespace-nowrap text-center text-sm">
            <span 
              class="px-2 py-1 text-xs font-semibold rounded-full"
              :class="task.paymentStatus === 'Pending' ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'"
            >
              {{ task.paymentStatus }}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
            <button 
              v-if="task.paymentStatus === 'Pending'"
              @click="markAsPaid(task.taskId)"
              class="bg-blue-500 text-white px-3 py-1 rounded-md text-sm font-semibold hover:bg-blue-600 transition-colors"
            >
              标记为已付
            </button>
            <span v-else class="text-sm text-gray-500">
              {{ task.actualPaymentDate }}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-center text-sm">
            <a v-if="task.invoiceLink" :href="task.invoiceLink" target="_blank" class="text-blue-500 hover:underline">
              查看票据
            </a>
            <button v-else @click="addInvoiceLink(task.taskId)" class="text-gray-400 hover:text-gray-600 text-xs">
              添加链接
            </button>
          </td>
        </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="9" class="p-8 text-center text-gray-500">
              没有待办付款任务
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <NewTaskForm 
      v-if="showNewTaskModal" 
      @close="showNewTaskModal = false" 
      @add-task="addTask"
    />

  <DataImport
      v-if="showDataImportModal"
      @close="showDataImportModal = false"
      @import-data="handleDataImport"
    />

  <!-- 智能生成模态框 -->
  <div v-if="showSmartGenerateModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
      <h2 class="text-2xl font-bold mb-6">智能生成付款预订</h2>
      
      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-2">选择订单</label>
        <select v-model="selectedOrderId" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500">
          <option value="">请选择订单...</option>
          <option v-for="order in orders" :key="order['订单ID']" :value="order['订单ID']">
            {{ order['订单名称'] }} ({{ order['出发日期'] }})
          </option>
        </select>
      </div>

      <div v-if="selectedOrderId" class="mb-6 p-4 bg-gray-50 rounded-md">
        <h3 class="text-sm font-semibold mb-2">订单详情</h3>
        <div class="text-sm text-gray-600">
          <p><strong>订单ID:</strong> {{ orders.find(o => o['订单ID'] === selectedOrderId)['订单ID'] }}</p>
          <p><strong>客户:</strong> {{ orders.find(o => o['订单ID'] === selectedOrderId)['客户名称'] }}</p>
          <p><strong>出发日期:</strong> {{ orders.find(o => o['订单ID'] === selectedOrderId)['出发日期'] }}</p>
          <p><strong>关联服务:</strong> {{ orders.find(o => o['订单ID'] === selectedOrderId)['关联的服务'] }}</p>
        </div>
      </div>

      <div class="flex justify-end space-x-4">
        <button @click="showSmartGenerateModal = false; selectedOrderId = ''" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">取消</button>
        <button @click="handleSmartGenerate" class="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">生成</button>
      </div>
    </div>
  </div>
</template>