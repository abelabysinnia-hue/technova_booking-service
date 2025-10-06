/**
 * Booking Lifecycle Usage Examples
 * 
 * This file demonstrates how to use the booking lifecycle event handler
 * in different scenarios within the ride-sharing application.
 */

const bookingLifecycleHandler = require('../services/bookingLifecycleHandler');
const bookingService = require('../services/bookingService');

// Example 1: Passenger cancels booking after driver acceptance
async function examplePassengerCancellation() {
  console.log('=== Example 1: Passenger Cancellation ===');
  
  try {
    // Using existing DELETE endpoint
    const result = await bookingService.cancelBooking({
      bookingId: '64f8a1b2c3d4e5f6a7b8c9d0',
      canceledReason: 'Change of plans',
      requester: {
        id: 'passenger123',
        type: 'passenger'
      }
    });
    
    console.log('Cancellation result:', result);
    console.log('✅ Passenger cancellation handled successfully');
    console.log('📡 API: DELETE /v1/bookings/:id');
  } catch (error) {
    console.error('❌ Error handling passenger cancellation:', error.message);
  }
}

// Example 2: Handle passenger disconnection
async function examplePassengerDisconnection() {
  console.log('\n=== Example 2: Passenger Disconnection ===');
  
  try {
    // Using existing lifecycle endpoint
    const result = await bookingService.handleBookingLifecycle({
      bookingId: '64f8a1b2c3d4e5f6a7b8c9d0',
      passengerDisconnected: true,
      driverAccepted: true,
      driverId: 'driver456',
      passengerId: 'passenger123'
    });
    
    console.log('Disconnection result:', result);
    console.log('✅ Passenger disconnection handled successfully');
    console.log('📡 API: POST /v1/bookings/:id/lifecycle');
  } catch (error) {
    console.error('❌ Error handling passenger disconnection:', error.message);
  }
}

// Example 3: Handle passenger reconnection
async function examplePassengerReconnection() {
  console.log('\n=== Example 3: Passenger Reconnection ===');
  
  try {
    const result = await bookingService.handlePassengerReconnection('64f8a1b2c3d4e5f6a7b8c9d0');
    console.log('Reconnection result:', result);
    console.log('✅ Passenger reconnection handled successfully');
  } catch (error) {
    console.error('❌ Error handling passenger reconnection:', error.message);
  }
}

// Example 4: Driver accepts booking
async function exampleDriverAcceptance() {
  console.log('\n=== Example 4: Driver Acceptance ===');
  
  try {
    // Using existing assign endpoint
    const result = await bookingService.handleBookingLifecycle({
      bookingId: '64f8a1b2c3d4e5f6a7b8c9d0',
      driverAccepted: true,
      driverId: 'driver456',
      passengerId: 'passenger123',
      vehicleType: 'mini',
      location: {
        latitude: 9.0192,
        longitude: 38.7525,
        address: 'Addis Ababa, Ethiopia'
      },
      pricing: {
        fare: 25.50,
        breakdown: {
          base: 5.00,
          distance: 15.50,
          time: 3.00,
          surge: 2.00
        }
      }
    });
    
    console.log('Driver acceptance result:', result);
    console.log('✅ Driver acceptance handled successfully');
    console.log('📡 API: POST /v1/bookings/:id/assign or POST /v1/bookings/:id/lifecycle');
  } catch (error) {
    console.error('❌ Error handling driver acceptance:', error.message);
  }
}

// Example 5: Direct lifecycle handler usage
async function exampleDirectLifecycleHandler() {
  console.log('\n=== Example 5: Direct Lifecycle Handler ===');
  
  try {
    // Scenario: Passenger cancels after driver acceptance
    await bookingLifecycleHandler.handleBookingLifecycle({
      bookingId: '64f8a1b2c3d4e5f6a7b8c9d0',
      passengerCancels: true,
      driverId: 'driver456',
      passengerId: 'passenger123'
    });
    
    console.log('✅ Direct lifecycle handler - passenger cancellation');
    
    // Scenario: Driver accepts booking
    await bookingLifecycleHandler.handleBookingLifecycle({
      bookingId: '64f8a1b2c3d4e5f6a7b8c9d1',
      driverAccepted: true,
      driverId: 'driver789',
      passengerId: 'passenger456',
      vehicleType: 'sedan',
      location: {
        latitude: 9.0192,
        longitude: 38.7525
      },
      pricing: {
        fare: 35.00
      }
    });
    
    console.log('✅ Direct lifecycle handler - driver acceptance');
  } catch (error) {
    console.error('❌ Error in direct lifecycle handler:', error.message);
  }
}

// Example 6: Socket event handling (simulated)
function exampleSocketEvents() {
  console.log('\n=== Example 6: Socket Events ===');
  
  // Simulate enhanced existing socket events
  const socketEvents = [
    {
      event: 'booking_cancel',
      data: { 
        bookingId: '64f8a1b2c3d4e5f6a7b8c9d0',
        reason: 'Found alternative transport'
      },
      enhancement: 'Now uses lifecycle handler for proper cancellation flow'
    },
    {
      event: 'booking_accept',
      data: {
        bookingId: '64f8a1b2c3d4e5f6a7b8c9d2',
        vehicleType: 'van',
        location: { latitude: 9.0192, longitude: 38.7525 },
        pricing: { fare: 45.00 }
      },
      enhancement: 'Now uses lifecycle handler for notifications and cleanup'
    },
    {
      event: 'booking_lifecycle',
      data: {
        bookingId: '64f8a1b2c3d4e5f6a7b8c9d3',
        passengerDisconnected: true
      },
      enhancement: 'New data fields for lifecycle scenarios'
    }
  ];
  
  console.log('Enhanced existing socket events:');
  socketEvents.forEach((event, index) => {
    console.log(`${index + 1}. ${event.event}:`, event.data);
    console.log(`   Enhancement: ${event.enhancement}`);
  });
  
  console.log('✅ Enhanced existing socket events documented');
}

// Example 7: API endpoint usage
function exampleAPIEndpoints() {
  console.log('\n=== Example 7: API Endpoints ===');
  
  const apiExamples = [
    {
      method: 'DELETE',
      endpoint: '/v1/bookings/:id',
      description: 'Cancel a booking (passenger) - Enhanced with lifecycle handler',
      auth: 'Bearer <passenger_token>',
      body: { canceledReason: 'Optional reason' }
    },
    {
      method: 'POST',
      endpoint: '/v1/bookings/:id/lifecycle',
      description: 'Handle booking lifecycle events - Enhanced',
      auth: 'Bearer <driver_token> or <passenger_token>',
      body: {
        passengerCancels: true,
        passengerDisconnected: true,
        driverAccepted: true,
        driverId: 'driver123',
        passengerId: 'passenger456',
        vehicleType: 'mini',
        location: { latitude: 9.0192, longitude: 38.7525 },
        pricing: { fare: 25.50 }
      }
    },
    {
      method: 'POST',
      endpoint: '/v1/bookings/:id/assign',
      description: 'Assign driver to booking - Enhanced with lifecycle handler',
      auth: 'Bearer <admin_token>',
      body: {
        driverId: 'driver123',
        dispatcherId: 'dispatcher456',
        passengerId: 'passenger789',
        vehicleType: 'mini',
        location: { latitude: 9.0192, longitude: 38.7525 },
        pricing: { fare: 25.50 }
      }
    }
  ];
  
  console.log('API endpoints for booking lifecycle:');
  apiExamples.forEach((api, index) => {
    console.log(`${index + 1}. ${api.method} ${api.endpoint}`);
    console.log(`   Description: ${api.description}`);
    console.log(`   Auth: ${api.auth}`);
    console.log(`   Body:`, JSON.stringify(api.body, null, 2));
    console.log('');
  });
  
  console.log('✅ API endpoints documented');
}

// Example 8: Error handling scenarios
async function exampleErrorHandling() {
  console.log('\n=== Example 8: Error Handling ===');
  
  try {
    // Test with invalid booking ID
    await bookingLifecycleHandler.handleBookingLifecycle({
      bookingId: 'invalid_id',
      passengerCancels: true,
      driverId: 'driver123',
      passengerId: 'passenger456'
    });
  } catch (error) {
    console.log('✅ Error handling works for invalid booking ID:', error.message);
  }
  
  try {
    // Test with missing required parameters
    await bookingLifecycleHandler.handleBookingLifecycle({
      bookingId: '64f8a1b2c3d4e5f6a7b8c9d0',
      passengerCancels: true
      // Missing driverId and passengerId
    });
  } catch (error) {
    console.log('✅ Error handling works for missing parameters:', error.message);
  }
  
  console.log('✅ Error handling scenarios tested');
}

// Run all examples
async function runAllExamples() {
  console.log('🚀 Booking Lifecycle Handler - Usage Examples\n');
  
  await examplePassengerCancellation();
  await examplePassengerDisconnection();
  await examplePassengerReconnection();
  await exampleDriverAcceptance();
  await exampleDirectLifecycleHandler();
  exampleSocketEvents();
  exampleAPIEndpoints();
  await exampleErrorHandling();
  
  console.log('\n🎉 All examples completed successfully!');
  console.log('\n📚 For more details, see: /docs/booking-lifecycle-events.md');
}

// Export for use in other files
module.exports = {
  examplePassengerCancellation,
  examplePassengerDisconnection,
  examplePassengerReconnection,
  exampleDriverAcceptance,
  exampleDirectLifecycleHandler,
  exampleSocketEvents,
  exampleAPIEndpoints,
  exampleErrorHandling,
  runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}