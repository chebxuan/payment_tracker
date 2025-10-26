/**
 * 智能付款预订生成器
 * 根据订单信息自动生成付款任务
 */

/**
 * 根据订单ID查找订单
 * @param {string} orderId - 订单ID
 * @param {Array} allOrders - 所有订单列表
 * @returns {Object|null} 找到的订单对象
 */
function findOrderById(orderId, allOrders) {
  return allOrders.find(order => order['订单ID'] === orderId) || null;
}

/**
 * 根据服务名称查找产品信息
 * @param {string} serviceName - 服务名称
 * @param {Array} allProducts - 所有产品列表
 * @returns {Object|null} 找到的产品对象
 */
function findProductByName(serviceName, allProducts) {
  return allProducts.find(product => product['服务名称'] === serviceName.trim()) || null;
}

/**
 * 根据供应商名称查找供应商信息
 * @param {string} supplierName - 供应商名称
 * @param {Array} allSuppliers - 所有供应商列表
 * @returns {Object|null} 找到的供应商对象
 */
function findSupplierByName(supplierName, allSuppliers) {
  return allSuppliers.find(supplier => supplier['供应商名称'] === supplierName) || null;
}

/**
 * 根据付款方式计算付款任务
 * @param {string} paymentMethod - 付款方式（如 "定金50%+尾款50%"）
 * @param {number} totalAmount - 总金额
 * @param {string} dueDate - 基准日期
 * @returns {Array} 付款任务列表
 */
function calculatePaymentTasks(paymentMethod, totalAmount, dueDate) {
  const tasks = [];
  const baseDate = new Date(dueDate);

  if (paymentMethod.includes('定金') && paymentMethod.includes('尾款')) {
    // 解析百分比
    const depositMatch = paymentMethod.match(/定金(\d+)%/);
    const finalMatch = paymentMethod.match(/尾款(\d+)%/);
    
    if (depositMatch && finalMatch) {
      const depositPercent = parseInt(depositMatch[1]) / 100;
      const finalPercent = parseInt(finalMatch[1]) / 100;

      // 定金：提前7天支付
      const depositDate = new Date(baseDate);
      depositDate.setDate(depositDate.getDate() - 7);
      
      tasks.push({
        taskType: '定金',
        description: `预付${depositMatch[1]}%款项`,
        amountDue: totalAmount * depositPercent,
        dueDate: depositDate.toISOString().split('T')[0]
      });

      // 尾款：提前1天支付
      const finalDate = new Date(baseDate);
      finalDate.setDate(finalDate.getDate() - 1);
      
      tasks.push({
        taskType: '尾款',
        description: `支付剩余${finalMatch[1]}%款项`,
        amountDue: totalAmount * finalPercent,
        dueDate: finalDate.toISOString().split('T')[0]
      });
    }
  } else if (paymentMethod.includes('全款')) {
    // 全款：提前3天支付
    const fullPaymentDate = new Date(baseDate);
    fullPaymentDate.setDate(fullPaymentDate.getDate() - 3);
    
    tasks.push({
      taskType: '全款',
      description: '一次性支付全款',
      amountDue: totalAmount,
      dueDate: fullPaymentDate.toISOString().split('T')[0]
    });
  }

  return tasks;
}

/**
 * 将分组的供应商成本转换为 bookings 格式
 * @param {Object} supplierCosts - 按供应商分组的成本信息
 * @param {Object} orderInfo - 订单基本信息
 * @param {Array} allSuppliers - 所有供应商列表
 * @returns {Array} bookings 格式的数据
 */
function convertToBookingsFormat(supplierCosts, orderInfo, allSuppliers) {
  const bookings = [];

  for (const [supplierName, data] of Object.entries(supplierCosts)) {
    const supplier = findSupplierByName(supplierName, allSuppliers);
    const supplierType = supplier ? supplier['供应商类型'] : '其他';

    // 为每个供应商的所有服务项生成付款任务
    const allPaymentTasks = [];
    
    data.items.forEach((product, index) => {
      const tasks = calculatePaymentTasks(
        product['付款方式'],
        product['平日单价'],
        orderInfo['出发日期']
      );

      tasks.forEach((task, taskIndex) => {
        allPaymentTasks.push({
          taskId: `TASK-${Date.now()}-${index}-${taskIndex}`,
          ...task,
          paymentStatus: 'Pending',
          actualPaymentDate: null,
          invoiceLink: null
        });
      });
    });

    // 创建 booking 对象
    const booking = {
      bookingId: `BOOK-${Date.now()}-${supplierName}`,
      supplierName: supplierName,
      supplierType: supplierType,
      relatedCustomerOrder: orderInfo['订单名称'],
      bookingStatus: 'InProgress',
      costItems: data.items.map(item => ({
        itemName: item['服务名称'],
        amount: item['平日单价'],
        invoiceSource: supplierName
      })),
      totalAmount: data.total,
      paymentTasks: allPaymentTasks
    };

    bookings.push(booking);
  }

  return bookings;
}

/**
 * 主函数：智能生成付款预订
 * @param {string} orderId - 订单ID
 * @param {Array} allOrders - 所有订单列表
 * @param {Array} allProducts - 所有产品列表
 * @param {Array} allSuppliers - 所有供应商列表
 * @returns {Array} 生成的 bookings 数据
 */
export function generatePaymentBookings(orderId, allOrders, allProducts, allSuppliers) {
  // 1. 根据 orderId 找到对应的订单
  const currentOrder = findOrderById(orderId, allOrders);
  
  if (!currentOrder) {
    console.error(`订单 ${orderId} 未找到`);
    return [];
  }

  // 2. 获取并拆分服务列表
  const serviceNames = currentOrder['关联的服务'].split(',');

  // 3. 智能分组的"篮子"
  const supplierCosts = {}; // 例如: { "桂林漓江旅行社": { total: 1840, items: [...] } }

  // 4. 遍历服务列表，查找信息并放入"篮子"
  for (const name of serviceNames) {
    const product = findProductByName(name, allProducts);
    
    if (!product) {
      console.warn(`服务 "${name}" 未找到`);
      continue;
    }

    const supplierName = product['供应商名称'];
    const cost = product['平日单价'];

    // 如果这个供应商是第一次出现，就为他创建一个小篮子
    if (!supplierCosts[supplierName]) {
      supplierCosts[supplierName] = { total: 0, items: [] };
    }

    // 把成本和服务项加到对应供应商的篮子里
    supplierCosts[supplierName].total += cost;
    supplierCosts[supplierName].items.push(product);
  }

  // 5. 将分组结果转换成最终的 bookings.json 格式
  const finalBookings = convertToBookingsFormat(supplierCosts, currentOrder, allSuppliers);

  // 6. 返回结果！
  return finalBookings;
}
