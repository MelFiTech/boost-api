const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQGJvb3N0LmNvbSIsInN1YiI6ImFkbWluIiwicm9sZSI6ImFkbWluIiwiaXNBZG1pbiI6dHJ1ZSwiaWF0IjoxNzUwNjg5MTE5LCJleHAiOjE3NTEyOTM5MTl9.tOc0aiGc0MF1lLa5CIjJ28WbNs6tl3XI7OMBqEQkLYM';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${ADMIN_TOKEN}`
};

// Test data
const testOrders = [
  {
    platform: 'instagram',
    service: 'followers',
    quantity: 100,
    paymentMethod: 'ngn',
    socialUrl: 'https://www.instagram.com/ree_miind',
    amount: '998.40',
    currency: 'NGN',
    timestamp: new Date().toISOString()
  },
  {
    platform: 'instagram',
    service: 'followers',
    quantity: 50,
    paymentMethod: 'ngn',
    socialUrl: 'https://www.instagram.com/ree_miind',
    amount: '499.20',
    currency: 'NGN',
    timestamp: new Date().toISOString()
  },
  {
    platform: 'instagram',
    service: 'followers',
    quantity: 200,
    paymentMethod: 'ngn',
    socialUrl: 'https://www.instagram.com/ree_miind',
    amount: '1996.80',
    currency: 'NGN',
    timestamp: new Date().toISOString()
  }
];

async function makeRequest(method, url, data = null) {
  try {
    const config = { method, url: `${BASE_URL}${url}`, headers };
    if (data) config.data = data;
    
    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

async function findMatchingServices(services, orderServiceType) {
  console.log(`\n🎯 Finding matching services for: ${orderServiceType}`);
  
  // Smart keyword matching based on order service type
  const orderType = orderServiceType.toLowerCase();
  const matchingServices = services.filter(service => {
    const serviceName = service.name.toLowerCase();
    const serviceCategory = service.category.toLowerCase();
    
    // Direct keyword matching - prioritize exact matches
    if (orderType.includes('follower')) {
      return serviceCategory.includes('follower') || serviceName.includes('follower');
    }
    if (orderType.includes('like')) {
      return serviceCategory.includes('like') || serviceName.includes('like');
    }
    if (orderType.includes('comment')) {
      return serviceCategory.includes('comment') || serviceName.includes('comment');
    }
    if (orderType.includes('view')) {
      return serviceCategory.includes('view') || serviceName.includes('view');
    }
    if (orderType.includes('share')) {
      return serviceCategory.includes('share') || serviceName.includes('share');
    }
    if (orderType.includes('save')) {
      return serviceCategory.includes('save') || serviceName.includes('save');
    }
    
    return false;
  });
  
  console.log(`✅ Smart matching found ${matchingServices.length} services for "${orderServiceType}"`);
  
  if (matchingServices.length > 0) {
    console.log(`   Sample matches:`);
    matchingServices.slice(0, 3).forEach(service => {
      console.log(`   - ${service.name} (${service.category}) [Min: ${service.minOrder}, ServiceID: ${service.serviceId}]`);
    });
    
    // Sort by minOrder to find the most flexible service first
    matchingServices.sort((a, b) => a.minOrder - b.minOrder);
    
    console.log(`   🎯 Best match (lowest minimum): ${matchingServices[0].name}`);
    console.log(`      ServiceID: ${matchingServices[0].serviceId}, Min: ${matchingServices[0].minOrder}, Max: ${matchingServices[0].maxOrder}`);
  }
  
  return matchingServices;
}

function extractServiceType(serviceName) {
  if (!serviceName) return 'followers'; // Default fallback
  
  const name = serviceName.toLowerCase();
  
  // Extract service type from service name
  if (name.includes('follower')) return 'followers';
  if (name.includes('like')) return 'likes';
  if (name.includes('comment')) return 'comments';
  if (name.includes('view')) return 'views';
  if (name.includes('share')) return 'shares';
  if (name.includes('save')) return 'saves';
  if (name.includes('story')) return 'story views';
  if (name.includes('reel')) return 'reels';
  
  // Default to followers if we can't determine
  return 'followers';
}

async function createTestOrder(orderData) {
  console.log(`\n📝 Creating test order...`);
  console.log(`   Platform: ${orderData.platform}`);
  console.log(`   Service: ${orderData.service}`);
  console.log(`   Quantity: ${orderData.quantity}`);
  console.log(`   Social URL: ${orderData.socialUrl}`);
  console.log(`   Amount: ${orderData.amount} ${orderData.currency}`);
  
  const result = await makeRequest('POST', '/orders', orderData);
  
  if (result.success) {
    console.log(`✅ Order created successfully: ${result.data.id}`);
    return result.data;
  } else {
    console.log(`❌ Failed to create order:`, result.error);
    return null;
  }
}

async function getPendingOrders() {
  console.log(`\n📋 Fetching pending orders...`);
  
  const result = await makeRequest('GET', '/admin/orders/pending');
  
  if (result.success) {
    console.log(`✅ Found ${result.data.count || 0} pending orders`);
    return result.data.orders || [];
  } else {
    console.log(`❌ Failed to fetch pending orders:`, result.error);
    return [];
  }
}

async function getSMMStoneServices(quantity = null, orderServiceType = null) {
  console.log(`\n🔍 Fetching SMMStone services...`);
  if (quantity) {
    console.log(`   Looking for services that support quantity: ${quantity}`);
  }
  if (orderServiceType) {
    console.log(`   Looking for service type: ${orderServiceType}`);
  }
  
  const result = await makeRequest('GET', '/admin/smmstone/services?platform=Instagram&limit=300');
  
  if (result.success) {
    const allServices = result.data.data?.services || [];
    console.log(`✅ Found ${allServices.length} total SMMStone Instagram services`);
    
    if (quantity && orderServiceType) {
      // First filter by quantity compatibility
      let compatibleServices = allServices.filter(service => 
        service.minOrder <= quantity && service.maxOrder >= quantity
      );
      
      console.log(`✅ Found ${compatibleServices.length} services compatible with quantity ${quantity}`);
      
      // Then filter by service type using AI-powered matching
      const matchingServices = await findMatchingServices(compatibleServices, orderServiceType);
      
      if (matchingServices.length > 0) {
            // Sort by minOrder to prefer services with lower minimums (more flexible)
    // But also prefer newer services (higher serviceId numbers tend to be more recent)
    matchingServices.sort((a, b) => {
      // First sort by minOrder (lower is better)
      const minOrderDiff = a.minOrder - b.minOrder;
      if (minOrderDiff !== 0) return minOrderDiff;
      
      // If minOrder is the same, prefer higher serviceId (newer services)
      return parseInt(b.serviceId) - parseInt(a.serviceId);
    });
        
        const selectedService = matchingServices[0];
        console.log(`✅ Found ${matchingServices.length} services matching "${orderServiceType}"`);
        console.log(`   Selected service: ${selectedService.name}`);
        console.log(`   Service ID: ${selectedService.id}`);
        console.log(`   Category: ${selectedService.category}`);
        console.log(`   Min/Max: ${selectedService.minOrder} - ${selectedService.maxOrder}`);
        console.log(`   Rate: $${selectedService.providerRate} USDT`);
        
        return matchingServices;
      }
      
      return compatibleServices; // Fallback to quantity-compatible services
    } else if (quantity) {
      // Filter services that support the required quantity
      const compatibleServices = allServices.filter(service => 
        service.minOrder <= quantity && service.maxOrder >= quantity
      );
      
      // Sort by minOrder to prefer services with lower minimums (more flexible)
      compatibleServices.sort((a, b) => a.minOrder - b.minOrder);
      
      console.log(`✅ Found ${compatibleServices.length} services compatible with quantity ${quantity}`);
      
      if (compatibleServices.length > 0) {
        const selectedService = compatibleServices[0];
        console.log(`   Selected service: ${selectedService.name}`);
        console.log(`   Service ID: ${selectedService.id}`);
        console.log(`   Min/Max: ${selectedService.minOrder} - ${selectedService.maxOrder}`);
        console.log(`   Rate: $${selectedService.providerRate} USDT`);
      }
      
      return compatibleServices;
    } else {
      if (allServices.length > 0) {
        console.log(`   First service: ${allServices[0].name}`);
        console.log(`   Service ID: ${allServices[0].id}`);
      }
      return allServices;
    }
  } else {
    console.log(`❌ Failed to fetch SMMStone services:`, result.error);
    return [];
  }
}

async function fulfillOrderWithSMMStone(orderId, smmstoneServiceId, orderQuantity = null) {
  console.log(`\n🚀 Fulfilling order with SMMStone...`);
  console.log(`   Order ID: ${orderId}`);
  console.log(`   SMMStone Service ID: ${smmstoneServiceId}`);
  console.log(`   Social URL: https://www.instagram.com/ree_miind`);
  console.log(`   Quantity: ${orderQuantity || 'Using order default'}`);
  
  const fulfillmentData = {
    smmstoneServiceId: smmstoneServiceId,
    socialUrl: 'https://www.instagram.com/ree_miind'
  };
  
  // Only override quantity if specified
  if (orderQuantity) {
    fulfillmentData.quantity = orderQuantity;
  }
  
  const result = await makeRequest('POST', `/admin/orders/${orderId}/fulfill-smmstone`, fulfillmentData);
  
  if (result.success) {
    console.log(`✅ Order fulfilled successfully!`);
    console.log(`   SMMStone Order ID: ${result.data.data?.smmstoneOrderId}`);
    console.log(`   Charge: $${result.data.data?.smmstoneCharge}`);
    console.log(`   Start Count: ${result.data.data?.smmstoneStartCount}`);
    return result.data;
  } else {
    console.log(`❌ Failed to fulfill order:`, result.error);
    return null;
  }
}

async function checkSMMStoneBalance() {
  console.log(`\n💰 Checking SMMStone balance...`);
  
  const result = await makeRequest('GET', '/admin/smmstone/balance');
  
  if (result.success) {
    console.log(`✅ SMMStone Balance: $${result.data.data?.balance || 'N/A'}`);
    return result.data;
  } else {
    console.log(`❌ Failed to check balance:`, result.error);
    return null;
  }
}

async function syncSMMStoneServices() {
  console.log(`\n🔄 Syncing SMMStone services...`);
  
  const result = await makeRequest('POST', '/admin/smmstone/sync-services');
  
  if (result.success) {
    console.log(`✅ Services synced successfully`);
    return result.data;
  } else {
    console.log(`❌ Failed to sync services:`, result.error);
    return null;
  }
}

async function runTests() {
  console.log('🧪 Starting SMMStone Fulfillment Tests');
  console.log('=====================================');
  
  // Step 1: Check SMMStone balance
  await checkSMMStoneBalance();
  
  // Step 2: Sync SMMStone services (if needed)
  console.log(`\n⚠️  Note: Syncing services might take a while...`);
  await syncSMMStoneServices();
  
  // Step 3: Get all SMMStone services first (for overview)
  const allSmmstoneServices = await getSMMStoneServices();
  if (allSmmstoneServices.length === 0) {
    console.log(`\n❌ No SMMStone services available. Cannot proceed with tests.`);
    return;
  }
  
  // Step 4: Create test orders
  console.log(`\n📦 Creating ${testOrders.length} test orders...`);
  const createdOrders = [];
  
  for (const orderData of testOrders) {
    const order = await createTestOrder(orderData);
    if (order) {
      createdOrders.push(order);
    }
    // Small delay between orders
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  if (createdOrders.length === 0) {
    console.log(`\n❌ No orders were created. Cannot proceed with fulfillment tests.`);
    return;
  }
  
  // Step 5: Get pending orders
  const pendingOrders = await getPendingOrders();
  
  if (pendingOrders.length === 0) {
    console.log(`\n❌ No pending orders found. Cannot proceed with fulfillment tests.`);
    return;
  }
  
  // Step 6: Test fulfillment with smart service selection
  const firstPendingOrder = pendingOrders[0];
  const orderQuantity = firstPendingOrder.quantity;
  const orderServiceName = firstPendingOrder.serviceName;
  
  console.log(`\n🎯 Testing fulfillment...`);
  console.log(`   Using Order: ${firstPendingOrder.id}`);
  console.log(`   Order Service: ${orderServiceName}`);
  console.log(`   Order Quantity: ${orderQuantity}`);
  
  // Extract service type from order (followers, likes, comments, etc.)
  const orderServiceType = extractServiceType(orderServiceName);
  console.log(`   Detected Service Type: ${orderServiceType}`);
  
  // Find compatible SMMStone services for this order quantity and type
  const compatibleServices = await getSMMStoneServices(orderQuantity, orderServiceType);
  
  if (compatibleServices.length === 0) {
    console.log(`\n❌ No SMMStone services found that support quantity ${orderQuantity} and type "${orderServiceType}"`);
    console.log(`\n📊 Summary:`);
    console.log(`   Orders created: ${createdOrders.length}`);
    console.log(`   Pending orders: ${pendingOrders.length}`);
    console.log(`   SMMStone services: ${allSmmstoneServices.length}`);
    console.log(`   Compatible services: 0`);
    console.log(`   Fulfillment: FAILED (No compatible service)`);
    return;
  }
  
  const selectedService = compatibleServices[0];
  console.log(`   Selected Service: ${selectedService.name}`);
  
  const fulfillmentResult = await fulfillOrderWithSMMStone(
    firstPendingOrder.id,
    selectedService.id,
    orderQuantity
  );
  
  if (fulfillmentResult) {
    console.log(`\n🎉 Test completed successfully!`);
    console.log(`\n📊 Summary:`);
    console.log(`   Orders created: ${createdOrders.length}`);
    console.log(`   Pending orders: ${pendingOrders.length}`);
    console.log(`   SMMStone services: ${allSmmstoneServices.length}`);
    console.log(`   Compatible services: ${compatibleServices.length}`);
    console.log(`   Fulfillment: SUCCESS`);
  } else {
    console.log(`\n❌ Test failed during fulfillment step.`);
  }
  
  console.log(`\n✨ Test suite completed!`);
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
}); 