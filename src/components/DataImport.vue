<script setup>
import { ref } from 'vue'
import {
  parseCSV,
  parseExcel,
  parseExcelMultipleSheets,
  fetchFromFeishu,
  getFeishuAccessToken,
  validateAndTransformData,
  extractSuppliersFromProducts,
  exportToCSV,
  exportToExcel,
} from '../utils/dataImporter.js'

const emit = defineEmits(['close', 'import-data'])

// 当前选择的导入方式
const importMethod = ref('file') // 'file' 或 'feishu'
const importMode = ref('single') // 'single' 或 'batch'
const dataType = ref('orders') // 'orders', 'products', 'suppliers'
const fileInput = ref(null)
const batchFileInput = ref(null)

// 批量导入的工作表映射配置（使用索引）
const sheetMapping = ref({
  0: 'products', // 第1个工作表 = 产品/服务数据
  1: 'suppliers', // 第2个工作表 = 供应商数据
  2: 'orders', // 第3个工作表 = 订单数据
})
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// 飞书配置
const feishuConfig = ref({
  appId: '',
  appSecret: '',
  appToken: '',
  tableId: '',
})

/**
 * 处理批量文件上传
 */
async function handleBatchFileUpload(event) {
  const file = event.target.files[0]
  if (!file) return

  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const fileExtension = file.name.split('.').pop().toLowerCase()

    if (fileExtension !== 'xlsx' && fileExtension !== 'xls') {
      throw new Error('批量导入只支持 Excel 文件（.xlsx 或 .xls）')
    }

    // 解析多个工作表（使用索引模式）
    const {
      data: allData,
      errors,
      sheetInfo,
    } = await parseExcelMultipleSheets(file, sheetMapping.value, true)

    // 如果有产品数据但没有供应商数据，自动从产品中提取供应商
    if (allData.products && !allData.suppliers) {
      allData.suppliers = extractSuppliersFromProducts(allData.products)
      console.log('已从产品数据中自动提取供应商信息:', allData.suppliers.length, '个')
    }

    // 发送批量数据给父组件
    emit('import-data', {
      type: 'batch',
      data: allData,
    })

    // 构建成功消息
    const successParts = []
    if (allData.products) successParts.push(`产品 ${allData.products.length} 条`)
    if (allData.suppliers) {
      const isAutoExtracted = !sheetMapping.value[1] || sheetMapping.value[1] !== 'suppliers'
      successParts.push(
        `供应商 ${allData.suppliers.length} 条${isAutoExtracted ? '（自动提取）' : ''}`,
      )
    }
    if (allData.orders) successParts.push(`订单 ${allData.orders.length} 条`)

    let message = `批量导入成功：${successParts.join('、')}`

    // 显示工作表映射信息
    if (sheetInfo && sheetInfo.length > 0) {
      message += `\n\n工作表映射：\n${sheetInfo.join('\n')}`
    }

    if (errors.length > 0) {
      message += `\n\n警告：${errors.join('; ')}`
    }

    successMessage.value = message

    // 3秒后关闭
    setTimeout(() => {
      emit('close')
    }, 3000)
  } catch (error) {
    errorMessage.value = error.message || '批量导入失败，请检查文件格式'
    console.error('批量导入错误:', error)
  } finally {
    isLoading.value = false
    // 清空文件选择
    if (batchFileInput.value) {
      batchFileInput.value.value = ''
    }
  }
}

/**
 * 处理文件上传
 */
async function handleFileUpload(event) {
  const file = event.target.files[0]
  if (!file) return

  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    let data = []
    const fileExtension = file.name.split('.').pop().toLowerCase()

    // 根据文件类型解析
    if (fileExtension === 'csv') {
      data = await parseCSV(file)
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      data = await parseExcel(file)
    } else {
      throw new Error('不支持的文件格式，请上传 CSV 或 Excel 文件')
    }

    // 验证和转换数据
    const validData = validateAndTransformData(data, dataType.value)

    // 发送数据给父组件
    emit('import-data', {
      type: dataType.value,
      data: validData,
    })

    successMessage.value = `成功导入 ${validData.length} 条记录`

    // 2秒后关闭
    setTimeout(() => {
      emit('close')
    }, 2000)
  } catch (error) {
    errorMessage.value = error.message || '导入失败，请检查文件格式'
    console.error('文件导入错误:', error)
  } finally {
    isLoading.value = false
    // 清空文件选择
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}

/**
 * 从飞书导入数据
 */
async function handleFeishuImport() {
  if (
    !feishuConfig.value.appId ||
    !feishuConfig.value.appSecret ||
    !feishuConfig.value.appToken ||
    !feishuConfig.value.tableId
  ) {
    errorMessage.value = '请填写完整的飞书配置信息'
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    // 1. 获取访问令牌
    const accessToken = await getFeishuAccessToken(
      feishuConfig.value.appId,
      feishuConfig.value.appSecret,
    )

    // 2. 获取表格数据
    const data = await fetchFromFeishu(
      feishuConfig.value.appToken,
      feishuConfig.value.tableId,
      accessToken,
    )

    // 3. 验证和转换数据
    const validData = validateAndTransformData(data, dataType.value)

    // 4. 发送数据给父组件
    emit('import-data', {
      type: dataType.value,
      data: validData,
    })

    successMessage.value = `成功从飞书导入 ${validData.length} 条记录`

    // 2秒后关闭
    setTimeout(() => {
      emit('close')
    }, 2000)
  } catch (error) {
    errorMessage.value = error.message || '飞书导入失败'
    console.error('飞书导入错误:', error)
  } finally {
    isLoading.value = false
  }
}

/**
 * 下载模板文件
 */
function downloadTemplate() {
  const templates = {
    orders: [
      {
        订单ID: 'ORD-2025-001',
        客户名称: '张先生',
        订单名称: '张先生-北京5日游',
        出发日期: '2025-11-01',
        关联的服务: '服务1,服务2,服务3',
      },
    ],
    products: [
      {
        服务名称: '导游服务',
        供应商名称: '某某旅行社',
        平日单价: 1000,
        服务类型: '导游',
        付款方式: '定金50%+尾款50%',
      },
    ],
    suppliers: [
      {
        供应商名称: '某某旅行社',
        供应商类型: '地接社',
        联系人: '李经理',
        联系电话: '138-0000-0000',
      },
    ],
  }

  const template = templates[dataType.value]
  const filename = `${dataType.value}_template.csv`
  exportToCSV(template, filename)
}
</script>

<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <h2 class="text-2xl font-bold mb-6">数据导入</h2>

      <!-- 导入模式选择 -->
      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-2">导入模式</label>
        <div class="flex space-x-4">
          <button
            @click="importMode = 'single'"
            :class="[
              'px-4 py-2 rounded-md text-sm font-medium',
              importMode === 'single' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700',
            ]"
          >
            单个数据类型
          </button>
          <button
            @click="importMode = 'batch'"
            :class="[
              'px-4 py-2 rounded-md text-sm font-medium',
              importMode === 'batch' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700',
            ]"
          >
            批量导入（多工作表）
          </button>
        </div>
      </div>

      <!-- 数据类型选择（只在单个模式下显示） -->
      <div v-if="importMode === 'single'" class="mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-2">选择数据类型</label>
        <select
          v-model="dataType"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="orders">订单数据</option>
          <option value="products">产品/服务数据</option>
          <option value="suppliers">供应商数据</option>
        </select>
      </div>

      <!-- 导入方式选择 -->
      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-2">导入方式</label>
        <div class="flex space-x-4">
          <button
            @click="importMethod = 'file'"
            :class="[
              'px-4 py-2 rounded-md text-sm font-medium',
              importMethod === 'file' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700',
            ]"
          >
            文件上传
          </button>
          <button
            @click="importMethod = 'feishu'"
            :class="[
              'px-4 py-2 rounded-md text-sm font-medium',
              importMethod === 'feishu' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700',
            ]"
          >
            飞书多维表格
          </button>
        </div>
      </div>

      <!-- 批量导入方式 -->
      <div v-if="importMethod === 'file' && importMode === 'batch'" class="space-y-4">
        <div class="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm text-blue-800">
          <p class="font-semibold mb-2">📊 批量导入说明</p>
          <ul class="list-disc list-inside space-y-1 text-xs">
            <li>请上传一个 Excel 文件（.xlsx 或 .xls）</li>
            <li>
              <strong>第1个工作表</strong> =
              <strong>产品/服务数据</strong>（服务项目名称、供应商名称、平日单价等）
            </li>
            <li>
              <strong>第2个工作表</strong> =
              <strong>供应商数据</strong>（供应商名称、供应商类型、联系人等）
            </li>
            <li>
              <strong>第3个工作表</strong> =
              <strong>订单数据</strong>（订单ID、客户信息、旅行日期、关联的服务等）
            </li>
            <li>✨ 系统会自动识别工作表名称和字段名称</li>
          </ul>
        </div>

        <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <input
            ref="batchFileInput"
            type="file"
            accept=".xlsx,.xls"
            @change="handleBatchFileUpload"
            class="hidden"
            id="batch-file-upload"
          />
          <label for="batch-file-upload" class="cursor-pointer">
            <div class="text-gray-600 mb-2">
              <svg
                class="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <p class="text-sm text-gray-600">点击上传批量导入 Excel 文件</p>
            <p class="text-xs text-gray-500 mt-1">包含产品、供应商、订单三个工作表</p>
          </label>
        </div>
      </div>

      <!-- 单个文件上传方式 -->
      <div v-if="importMethod === 'file' && importMode === 'single'" class="space-y-4">
        <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <input
            ref="fileInput"
            type="file"
            accept=".csv,.xlsx,.xls"
            @change="handleFileUpload"
            class="hidden"
            id="file-upload"
          />
          <label for="file-upload" class="cursor-pointer">
            <div class="text-gray-600 mb-2">
              <svg
                class="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <p class="text-sm text-gray-600">点击上传或拖拽文件到此处</p>
            <p class="text-xs text-gray-500 mt-1">支持 CSV、Excel 格式</p>
          </label>
        </div>

        <button
          @click="downloadTemplate"
          class="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
        >
          下载模板文件
        </button>
      </div>

      <!-- 飞书导入方式 -->
      <div v-if="importMethod === 'feishu'" class="space-y-4">
        <div class="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm text-blue-800">
          <p class="font-semibold mb-2">📌 如何获取飞书配置信息？</p>
          <ol class="list-decimal list-inside space-y-1 text-xs">
            <li>
              访问
              <a href="https://open.feishu.cn/app" target="_blank" class="underline"
                >飞书开放平台</a
              >
            </li>
            <li>创建应用并获取 App ID 和 App Secret</li>
            <li>打开多维表格，从 URL 中获取 app_token 和 table_id</li>
            <li>给应用授权访问多维表格的权限</li>
          </ol>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">App ID</label>
          <input
            v-model="feishuConfig.appId"
            type="text"
            placeholder="cli_xxxxxxxxxxxxxxxx"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">App Secret</label>
          <input
            v-model="feishuConfig.appSecret"
            type="password"
            placeholder="应用密钥"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">App Token (多维表格)</label>
          <input
            v-model="feishuConfig.appToken"
            type="text"
            placeholder="bascnxxxxxxxxxxxxxx"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Table ID (数据表)</label>
          <input
            v-model="feishuConfig.tableId"
            type="text"
            placeholder="tblxxxxxxxxxxxxxx"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          @click="handleFeishuImport"
          :disabled="isLoading"
          class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {{ isLoading ? '导入中...' : '从飞书导入' }}
        </button>
      </div>

      <!-- 消息提示 -->
      <div
        v-if="errorMessage"
        class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800"
      >
        {{ errorMessage }}
      </div>

      <div
        v-if="successMessage"
        class="mt-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800"
      >
        {{ successMessage }}
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="mt-4 flex items-center justify-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span class="ml-2 text-gray-600">处理中...</span>
      </div>

      <!-- 操作按钮 -->
      <div class="mt-6 flex justify-end">
        <button
          @click="$emit('close')"
          class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          :disabled="isLoading"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
</template>
