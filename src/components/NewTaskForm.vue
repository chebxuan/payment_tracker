
<script setup>
import { ref } from 'vue'

const emit = defineEmits(['close', 'add-task'])

// 表单数据模型
const newTask = ref({
  supplierName: '',
  supplierType: '地接社',
  relatedCustomerOrder: '',
  description: '',
  amountDue: null,
  dueDate: '',
  taskType: '定金'
})

// 提交表单
function handleSubmit() {
  // 在这里可以添加数据校验逻辑
  if (!newTask.value.supplierName || !newTask.value.amountDue || !newTask.value.dueDate) {
    alert('请填写所有必填项！')
    return
  }
  emit('add-task', { ...newTask.value })
  emit('close')
}
</script>

<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg">
      <h2 class="text-2xl font-bold mb-6">新增付款任务</h2>
      
      <form @submit.prevent="handleSubmit">
        <div class="grid grid-cols-2 gap-6">
          <!-- 供应商名称 -->
          <div>
            <label class="block text-sm font-medium text-gray-700">供应商名称</label>
            <input type="text" v-model="newTask.supplierName" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required>
          </div>

          <!-- 供应商类型 -->
          <div>
            <label class="block text-sm font-medium text-gray-700">供应商类型</label>
            <select v-model="newTask.supplierType" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
              <option>地接社</option>
              <option>导游</option>
              <option>酒店</option>
              <option>司机</option>
            </select>
          </div>

          <!-- 关联订单 -->
          <div class="col-span-2">
            <label class="block text-sm font-medium text-gray-700">关联订单ID/名称</label>
            <input type="text" v-model="newTask.relatedCustomerOrder" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
          </div>

          <!-- 任务描述 -->
          <div class="col-span-2">
            <label class="block text-sm font-medium text-gray-700">款项描述</label>
            <input type="text" v-model="newTask.description" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required>
          </div>

          <!-- 应付金额 -->
          <div>
            <label class="block text-sm font-medium text-gray-700">应付金额</label>
            <input type="number" v-model.number="newTask.amountDue" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required>
          </div>

          <!-- 应付日期 -->
          <div>
            <label class="block text-sm font-medium text-gray-700">应付日期</label>
            <input type="date" v-model="newTask.dueDate" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required>
          </div>

          <!-- 款项类型 -->
          <div class="col-span-2">
            <label class="block text-sm font-medium text-gray-700">款项类型</label>
            <select v-model="newTask.taskType" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
              <option>定金</option>
              <option>尾款</option>
              <option>全款</option>
            </select>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="mt-8 flex justify-end space-x-4">
          <button type="button" @click="$emit('close')" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">取消</button>
          <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">确认添加</button>
        </div>
      </form>
    </div>
  </div>
</template>
