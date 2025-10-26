/**
 * 数据导入工具
 * 支持 CSV、Excel 和飞书多维表格
 */

import Papa from 'papaparse'
import * as XLSX from 'xlsx'

/**
 * 解析 CSV 文件
 * @param {File} file - CSV 文件对象
 * @returns {Promise<Array>} 解析后的数据数组
 */
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true, // 第一行作为表头
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn('CSV 解析警告:', results.errors)
        }
        resolve(results.data)
      },
      error: (error) => {
        reject(error)
      }
    })
  })
}

/**
 * 解析 Excel 文件
 * @param {File} file - Excel 文件对象
 * @param {string} sheetName - 工作表名称（可选，默认第一个）
 * @returns {Promise<Array>} 解析后的数据数组
 */
export function parseExcel(file, sheetName = null) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        
        // 选择工作表
        const sheet = sheetName 
          ? workbook.Sheets[sheetName] 
          : workbook.Sheets[workbook.SheetNames[0]]
        
        if (!sheet) {
          reject(new Error(`工作表 "${sheetName}" 未找到`))
          return
        }
        
        // 转换为 JSON
        const jsonData = XLSX.utils.sheet_to_json(sheet)
        resolve(jsonData)
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => {
      reject(new Error('文件读取失败'))
    }
    
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 批量解析 Excel 文件的多个工作表
 * @param {File} file - Excel 文件对象
 * @param {Object} sheetMapping - 工作表映射配置，如 { 'Sheet1': 'products', 'Sheet2': 'suppliers', 'Sheet3': 'orders' }
 *                                或使用索引 { 0: 'products', 1: 'suppliers', 2: 'orders' }
 * @param {boolean} useIndex - 是否使用索引而不是工作表名称（默认 true）
 * @returns {Promise<Object>} 解析后的数据对象，格式为 { products: [...], suppliers: [...], orders: [...] }
 */
export function parseExcelMultipleSheets(file, sheetMapping = null, useIndex = true) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        
        const result = {}
        const errors = []
        const sheetInfo = []
        
        // 如果使用索引模式（默认），按工作表顺序读取
        if (useIndex) {
          // 默认映射：第1个工作表=products, 第2个=suppliers, 第3个=orders
          const defaultMapping = {
            0: 'products',
            1: 'suppliers',
            2: 'orders'
          }
          
          const mapping = sheetMapping || defaultMapping
          
          // 遍历工作表
          for (const [indexStr, dataType] of Object.entries(mapping)) {
            const index = parseInt(indexStr)
            const sheetName = workbook.SheetNames[index]
            
            if (!sheetName) {
              errors.push(`第 ${index + 1} 个工作表不存在`)
              continue
            }
            
            const sheet = workbook.Sheets[sheetName]
            sheetInfo.push(`第${index + 1}个工作表 "${sheetName}" → ${dataType}`)
            
            try {
              // 转换为 JSON
              const jsonData = XLSX.utils.sheet_to_json(sheet)
              
              if (jsonData.length === 0) {
                errors.push(`工作表 "${sheetName}" 没有数据`)
                continue
              }
              
              // 验证和转换数据
              const validData = validateAndTransformData(jsonData, dataType)
              result[dataType] = validData
              
            } catch (error) {
              errors.push(`工作表 "${sheetName}" 解析失败: ${error.message}`)
            }
          }
        } else {
          // 使用工作表名称模式
          for (const [sheetName, dataType] of Object.entries(sheetMapping)) {
            const sheet = workbook.Sheets[sheetName]
            
            if (!sheet) {
              errors.push(`工作表 "${sheetName}" 未找到`)
              continue
            }
            
            sheetInfo.push(`工作表 "${sheetName}" → ${dataType}`)
            
            try {
              // 转换为 JSON
              const jsonData = XLSX.utils.sheet_to_json(sheet)
              
              if (jsonData.length === 0) {
                errors.push(`工作表 "${sheetName}" 没有数据`)
                continue
              }
              
              // 验证和转换数据
              const validData = validateAndTransformData(jsonData, dataType)
              result[dataType] = validData
              
            } catch (error) {
              errors.push(`工作表 "${sheetName}" 解析失败: ${error.message}`)
            }
          }
        }
        
        // 如果有错误但也有成功的数据，返回部分成功
        if (errors.length > 0) {
          console.warn('批量导入警告:', errors)
        }
        
        // 如果没有任何成功的数据，抛出错误
        if (Object.keys(result).length === 0) {
          reject(new Error('所有工作表解析失败: ' + errors.join('; ')))
          return
        }
        
        console.log('工作表映射:', sheetInfo)
        resolve({ data: result, errors, sheetInfo })
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => {
      reject(new Error('文件读取失败'))
    }
    
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 从飞书多维表格获取数据
 * @param {string} appToken - 多维表格的 app_token
 * @param {string} tableId - 数据表的 table_id
 * @param {string} accessToken - 访问令牌
 * @returns {Promise<Array>} 表格数据
 */
export async function fetchFromFeishu(appToken, tableId, accessToken) {
  const baseUrl = 'https://open.feishu.cn/open-apis/bitable/v1'
  const url = `${baseUrl}/apps/${appToken}/tables/${tableId}/records`
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`飞书 API 请求失败: ${response.status}`)
    }
    
    const result = await response.json()
    
    if (result.code !== 0) {
      throw new Error(`飞书 API 错误: ${result.msg}`)
    }
    
    // 转换飞书数据格式为标准格式
    return result.data.items.map(item => item.fields)
  } catch (error) {
    console.error('飞书数据获取失败:', error)
    throw error
  }
}

/**
 * 批量获取飞书多维表格的访问令牌（tenant_access_token）
 * @param {string} appId - 应用 ID
 * @param {string} appSecret - 应用密钥
 * @returns {Promise<string>} 访问令牌
 */
export async function getFeishuAccessToken(appId, appSecret) {
  const url = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal'
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret
      })
    })
    
    const result = await response.json()
    
    if (result.code !== 0) {
      throw new Error(`获取访问令牌失败: ${result.msg}`)
    }
    
    return result.tenant_access_token
  } catch (error) {
    console.error('获取飞书访问令牌失败:', error)
    throw error
  }
}

/**
 * 字段映射配置
 * 将用户文件中的字段名映射到系统需要的字段名
 */
const fieldMappings = {
  products: {
    '服务项目名称': '服务名称',
    '供应商名称': '供应商名称',  // 已匹配
    '平日单价': '平日单价',      // 已匹配
    '供应商类型': '服务类型',    // 使用供应商类型作为服务类型
    '子项说明': '付款方式'       // 子项说明映射为付款方式
  },
  suppliers: {
    '供应商名称': '供应商名称',  // 已匹配
    '供应商类型': '供应商类型',  // 已匹配
    '主要联系人': '联系人',
    '联系电话': '联系电话'       // 已匹配
  },
  orders: {
    '订单ID': '订单ID',          // 已匹配
    '客户信息': '客户名称',
    '订单名称': '订单名称',      // 已匹配
    '旅行日期': '出发日期',
    '关联的服务': '关联的服务'   // 已匹配
  }
}

/**
 * 默认值配置
 * 为缺失的必需字段提供默认值
 */
const defaultValues = {
  products: {
    '付款方式': '全款',  // 默认付款方式
    '服务类型': '其他'   // 默认服务类型
  },
  suppliers: {
    '供应商类型': '其他',
    '联系人': '未提供',
    '联系电话': '未提供'
  },
  orders: {
    '客户名称': '未命名客户',
    '关联的服务': ''
  }
}

/**
 * 应用字段映射
 * @param {Array} data - 原始数据
 * @param {string} dataType - 数据类型
 * @returns {Array} 映射后的数据
 */
function applyFieldMapping(data, dataType) {
  const mapping = fieldMappings[dataType]
  const defaults = defaultValues[dataType] || {}
  
  if (!mapping) return data
  
  return data.map(item => {
    const mappedItem = {}
    
    // 应用字段映射
    for (const [sourceField, targetField] of Object.entries(mapping)) {
      if (sourceField in item) {
        mappedItem[targetField] = item[sourceField]
      }
    }
    
    // 保留未映射的字段
    for (const key in item) {
      if (!(key in mapping)) {
        mappedItem[key] = item[key]
      }
    }
    
    // 应用默认值（如果字段不存在或为空）
    for (const [field, defaultValue] of Object.entries(defaults)) {
      if (!mappedItem[field] || mappedItem[field] === '') {
        mappedItem[field] = defaultValue
      }
    }
    
    return mappedItem
  })
}

/**
 * 数据格式验证和转换
 * @param {Array} data - 原始数据
 * @param {string} dataType - 数据类型 ('orders', 'products', 'suppliers')
 * @param {boolean} autoMap - 是否自动应用字段映射（默认 true）
 * @returns {Array} 验证并转换后的数据
 */
export function validateAndTransformData(data, dataType, autoMap = true) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('数据格式错误：必须是非空数组')
  }
  
  const requiredFields = {
    orders: ['订单ID', '客户名称', '订单名称', '出发日期', '关联的服务'],
    products: ['服务名称', '供应商名称', '平日单价', '服务类型', '付款方式'],
    suppliers: ['供应商名称', '供应商类型']
  }
  
  const required = requiredFields[dataType]
  if (!required) {
    throw new Error(`未知的数据类型: ${dataType}`)
  }
  
  // 如果启用自动映射，先应用字段映射
  let processedData = data
  if (autoMap) {
    processedData = applyFieldMapping(data, dataType)
    console.log(`[${dataType}] 已应用字段映射`)
  }
  
  // 获取实际的字段名称（从第一条记录）
  const actualFields = processedData.length > 0 ? Object.keys(processedData[0]) : []
  console.log(`[${dataType}] 实际字段:`, actualFields)
  console.log(`[${dataType}] 需要字段:`, required)
  
  // 验证每条记录是否包含必需字段
  const validData = processedData.filter(item => {
    const hasAllFields = required.every(field => field in item)
    if (!hasAllFields) {
      const missingFields = required.filter(field => !(field in item))
      console.warn(`记录缺少必需字段: ${missingFields.join(', ')}`)
      console.warn('记录的实际字段:', Object.keys(item))
    }
    return hasAllFields
  })
  
  if (validData.length === 0) {
    // 提供更详细的错误信息
    const errorMsg = `没有有效的数据记录。\n期望字段: ${required.join(', ')}\n实际字段: ${actualFields.join(', ')}`
    throw new Error(errorMsg)
  }
  
  // 数据类型转换
  if (dataType === 'products') {
    validData.forEach(item => {
      item['平日单价'] = Number(item['平日单价'])
    })
  }
  
  return validData
}

/**
 * 从产品数据中提取供应商信息
 * @param {Array} products - 产品数据
 * @returns {Array} 供应商数据
 */
export function extractSuppliersFromProducts(products) {
  const suppliersMap = new Map()
  
  products.forEach(product => {
    const supplierName = product['供应商名称']
    if (supplierName && !suppliersMap.has(supplierName)) {
      suppliersMap.set(supplierName, {
        '供应商名称': supplierName,
        '供应商类型': product['服务类型'] || product['服务区域'] || '其他',
        '联系人': product['联系人姓名'] || product['联系人'] || '未提供',
        '联系电话': product['联系方式'] || product['联系电话'] || '未提供'
      })
    }
  })
  
  return Array.from(suppliersMap.values())
}

/**
 * 导出数据为 CSV 格式
 * @param {Array} data - 要导出的数据
 * @param {string} filename - 文件名
 */
export function exportToCSV(data, filename) {
  const csv = Papa.unparse(data)
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * 导出数据为 Excel 格式
 * @param {Array} data - 要导出的数据
 * @param {string} filename - 文件名
 */
export function exportToExcel(data, filename) {
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
  XLSX.writeFile(workbook, filename)
}
