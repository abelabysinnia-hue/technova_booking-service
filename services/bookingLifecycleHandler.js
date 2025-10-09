const { Booking, BookingAssignment } = require('../models/bookingModels');
const { sendMessageToSocketId, broadcast } = require('../sockets/utils');
const logger = require('../utils/logger');

// Configuration constants
const DISCONNECT_TIMEOUT = 60000; // 60 seconds timeout for passenger disconnection
const passengerReconnectionMap = new Map(); // Track passenger reconnection status

/**
 * Main function to handle booking lifecycle events
 * @param {Object} params - The booking lifecycle parameters
 * @param {string} params.bookingId - The booking ID
 * @param {boolean} params.passengerCancels - Whether passenger cancels the booking
 * @param {boolean} params.passengerDisconnected - Whether passenger disconnected from socket
 * @param {boolean} params.driverAccepted - Whether driver accepted the booking
 * @param {string} params.driverId - The driver ID
 * @param {string} params.passengerId - The passenger ID
 * @param {string} params.vehicleType - The vehicle type
 * @param {Object} params.location - The location data
 * @param {Object} params.pricing - The pricing data
 */
async function handleBookingLifecycle({
  bookingId,
  passengerCancels,
  passengerDisconnected,
  driverAccepted,
  driverId,
  passengerId,
  vehicleType,
  location,
  pricing
}) {
  try {
    logger.info('Handling booking lifecycle event', {
      bookingId,
      passengerCancels,
      passengerDisconnected,
      driverAccepted,
      driverId,
      passengerId
    });

    // Scenario 1: Passenger cancels the booking after driver has accepted
    if (passengerCancels) {
      await handlePassengerCancellation(bookingId, driverId, passengerId);
    }

    // Scenario 2: Passenger disconnects from socket after driver has accepted the booking
    if (passengerDisconnected && driverAccepted) {
      await handlePassengerDisconnection(bookingId, driverId, passengerId);
    }

    // Scenario 3: Driver accepts the booking, so remove it from all other drivers' lists
    if (driverAccepted) {
      await handleDriverAcceptance(bookingId, driverId, passengerId, vehicleType, location, pricing);
    }

  } catch (error) {
    logger.error('Error in booking lifecycle handler', {
      bookingId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Handle passenger cancellation scenario
 */
async function handlePassengerCancellation(bookingId, driverId, passengerId) {
  try {
    // Step 1: Update passenger status to 'canceled'
    await updateBookingStatus({
      id: bookingId,
      requesterType: 'passenger',
      status: 'canceled',
      current: 'canceled',
      canceledBy: 'passenger',
      canceledReason: 'Passenger requested cancellation'
    });

    // Step 2: Update driver status to 'canceled' as well
    await updateBookingStatus({
      id: bookingId,
      requesterType: 'driver',
      status: 'canceled',
      current: 'canceled',
      canceledBy: 'passenger',
      canceledReason: 'Passenger requested cancellation'
    });

    // Step 3: Notify the driver that the passenger has canceled
    await sendNotificationToDriver(driverId, {
      message: "The passenger has canceled the booking.",
      status: "canceled",
      bookingId: bookingId,
      type: 'booking_canceled'
    });

    // Step 4: Remove the booking from the driver's active list
    await removeBookingFromDriverList(driverId, bookingId);

    // Step 5: Clean up booking details from in-memory cache for passenger and driver
    await cleanUpCache(bookingId);

    logger.info('Passenger cancellation handled successfully', { bookingId, driverId, passengerId });

  } catch (error) {
    logger.error('Error handling passenger cancellation', {
      bookingId,
      driverId,
      passengerId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Handle passenger disconnection scenario
 */
async function handlePassengerDisconnection(bookingId, driverId, passengerId) {
  try {
    // Set a timeout for automatic cancellation if passenger doesn't reconnect
    const timeoutId = setTimeout(async () => {
      try {
        const hasReconnected = passengerReconnectionMap.get(bookingId);
        if (!hasReconnected) {
          // Step 2: Cancel the booking due to disconnection
          await updateBookingStatus({
            id: bookingId,
            requesterType: 'passenger',
            status: 'canceled',
            current: 'canceled',
            canceledBy: 'system',
            canceledReason: 'Passenger disconnected and did not reconnect within timeout'
          });

          // Step 3: Notify the driver of the cancellation
          await sendNotificationToDriver(driverId, {
            message: "The passenger disconnected. The booking has been canceled.",
            status: "canceled",
            bookingId: bookingId,
            type: 'booking_canceled_disconnect'
          });

          // Step 4: Remove the booking from the driver's active list
          await removeBookingFromDriverList(driverId, bookingId);

          // Step 5: Clean up booking details from in-memory cache for passenger and driver
          await cleanUpCache(bookingId);

          // Clean up the timeout tracking
          passengerReconnectionMap.delete(bookingId);

          logger.info('Passenger disconnection timeout handled', { bookingId, driverId, passengerId });
        }
      } catch (error) {
        logger.error('Error handling passenger disconnection timeout', {
          bookingId,
          driverId,
          passengerId,
          error: error.message
        });
      }
    }, DISCONNECT_TIMEOUT);

    // Store timeout ID for potential cleanup
    passengerReconnectionMap.set(bookingId, { timeoutId, hasReconnected: false });

    logger.info('Passenger disconnection timeout set', { 
      bookingId, 
      driverId, 
      passengerId, 
      timeoutMs: DISCONNECT_TIMEOUT 
    });

  } catch (error) {
    logger.error('Error handling passenger disconnection', {
      bookingId,
      driverId,
      passengerId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Handle driver acceptance scenario
 */
async function handleDriverAcceptance(bookingId, driverId, passengerId, vehicleType, location, pricing) {
  try {
    // Step 1: Update the status to accepted for both passenger and driver
    await updateBookingStatus({
      id: bookingId,
      requesterType: 'passenger',
      status: 'accepted',
      current: 'accepted',
      acceptedAt: new Date()
    });

    await updateBookingStatus({
      id: bookingId,
      requesterType: 'driver',
      status: 'accepted',
      current: 'requested'
    });

    // Step 2: Remove the booking from all other drivers' lists (except the one who accepted)
    await removeBookingFromOtherDrivers(driverId, bookingId);

    // Step 3: Clear the booking details from in-memory/cache for other drivers
    await cleanUpCacheForOtherDrivers(bookingId);

    // Step 4: Clean up booking details (location, pricing, vehicle type) from cache for this booking
    await cleanUpCache(bookingId);

    // Step 5: Notify the driver that the booking has been successfully accepted
    await sendNotificationToDriver(driverId, {
      message: `You have successfully accepted the booking for passenger ID ${passengerId}.`,
      status: "accepted",
      bookingId: bookingId,
      location: location,
      pricing: pricing,
      vehicleType: vehicleType,
      type: 'booking_accepted'
    });

    // Step 6: Notify the passenger about the acceptance of their booking
    await sendNotificationToPassenger(passengerId, {
      message: "Your booking has been accepted by a driver.",
      status: "accepted",
      bookingId: bookingId,
      driverId: driverId,
      type: 'booking_accepted'
    });

    logger.info('Driver acceptance handled successfully', { 
      bookingId, 
      driverId, 
      passengerId, 
      vehicleType 
    });

  } catch (error) {
    logger.error('Error handling driver acceptance', {
      bookingId,
      driverId,
      passengerId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Function to update booking status in the system (database)
 */
async function updateBookingStatus({ id, requesterType, status, current, canceledBy, canceledReason, acceptedAt }) {
  try {
    const updateData = {
      status,
      ...(canceledBy && { canceledBy }),
      ...(canceledReason && { canceledReason }),
      ...(acceptedAt && { acceptedAt })
    };

    const booking = await Booking.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!booking) {
      throw new Error(`Booking with ID ${id} not found`);
    }

    // Update booking assignment if it exists
    await BookingAssignment.findOneAndUpdate(
      { bookingId: id },
      { status: current },
      { new: true }
    );

    logger.info('Booking status updated', {
      bookingId: id,
      requesterType,
      status,
      current
    });

    return booking;

  } catch (error) {
    logger.error('Error updating booking status', {
      bookingId: id,
      requesterType,
      status,
      error: error.message
    });
    throw error;
  }
}

/**
 * Function to remove the booking from a specific driver's list
 */
async function removeBookingFromDriverList(driverId, bookingId) {
  try {
    // Remove from driver's active assignments
    await BookingAssignment.findOneAndUpdate(
      { bookingId, driverId },
      { status: 'canceled' },
      { new: true }
    );

    logger.info('Booking removed from driver list', {
      driverId,
      bookingId
    });

  } catch (error) {
    logger.error('Error removing booking from driver list', {
      driverId,
      bookingId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Function to remove the booking from other drivers' lists once it is accepted
 */
async function removeBookingFromOtherDrivers(excludedDriverId, bookingId) {
  try {
    // Update all other driver assignments to canceled
    await BookingAssignment.updateMany(
      { 
        bookingId, 
        driverId: { $ne: excludedDriverId } 
      },
      { status: 'canceled' }
    );

    logger.info('Booking removed from other drivers', {
      excludedDriverId,
      bookingId
    });

  } catch (error) {
    logger.error('Error removing booking from other drivers', {
      excludedDriverId,
      bookingId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Function to clean up booking details from in-memory cache
 */
async function cleanUpCache(bookingId) {
  try {
    // Broadcast cache cleanup event for real-time systems
    broadcast('booking:cache_cleanup', {
      bookingId,
      timestamp: new Date().toISOString()
    });

    logger.info('Booking cache cleaned up', { bookingId });

  } catch (error) {
    logger.error('Error cleaning up booking cache', {
      bookingId,
      error: error.message
    });
    // Don't throw here as cache cleanup is not critical
  }
}

/**
 * Function to clean up booking details from in-memory cache for other drivers
 */
async function cleanUpCacheForOtherDrivers(bookingId) {
  try {
    // Broadcast cache cleanup event for other drivers
    broadcast('booking:cache_cleanup_other_drivers', {
      bookingId,
      timestamp: new Date().toISOString()
    });

    logger.info('Booking cache cleaned up for other drivers', { bookingId });

  } catch (error) {
    logger.error('Error cleaning up booking cache for other drivers', {
      bookingId,
      error: error.message
    });
    // Don't throw here as cache cleanup is not critical
  }
}

/**
 * Function to send notifications to the driver
 */
async function sendNotificationToDriver(driverId, notificationDetails) {
  try {
    // Send via socket to specific driver
    await sendMessageToSocketId(`driver:${driverId}`, {
      event: 'booking:notification',
      data: notificationDetails
    });

    // Also broadcast for admin dashboards
    broadcast('driver:notification', {
      driverId,
      ...notificationDetails
    });

    logger.info('Notification sent to driver', {
      driverId,
      type: notificationDetails.type,
      bookingId: notificationDetails.bookingId
    });

  } catch (error) {
    logger.error('Error sending notification to driver', {
      driverId,
      error: error.message
    });
    // Don't throw here as notifications are not critical to core functionality
  }
}

/**
 * Function to send notifications to the passenger
 */
async function sendNotificationToPassenger(passengerId, notificationDetails) {
  try {
    // Send via socket to specific passenger
    await sendMessageToSocketId(`passenger:${passengerId}`, {
      event: 'booking:notification',
      data: notificationDetails
    });

    // Also broadcast for admin dashboards
    broadcast('passenger:notification', {
      passengerId,
      ...notificationDetails
    });

    logger.info('Notification sent to passenger', {
      passengerId,
      type: notificationDetails.type,
      bookingId: notificationDetails.bookingId
    });

  } catch (error) {
    logger.error('Error sending notification to passenger', {
      passengerId,
      error: error.message
    });
    // Don't throw here as notifications are not critical to core functionality
  }
}

/**
 * Function to handle passenger reconnection
 * This should be called when a passenger reconnects to prevent automatic cancellation
 */
function handlePassengerReconnection(bookingId) {
  try {
    const reconnectionData = passengerReconnectionMap.get(bookingId);
    if (reconnectionData) {
      // Clear the timeout
      clearTimeout(reconnectionData.timeoutId);
      
      // Mark as reconnected
      reconnectionData.hasReconnected = true;
      passengerReconnectionMap.set(bookingId, reconnectionData);

      logger.info('Passenger reconnected, cancellation timeout cleared', { bookingId });
    }
  } catch (error) {
    logger.error('Error handling passenger reconnection', {
      bookingId,
      error: error.message
    });
  }
}

/**
 * Function to clean up timeout tracking for a booking
 */
function cleanupTimeoutTracking(bookingId) {
  try {
    const reconnectionData = passengerReconnectionMap.get(bookingId);
    if (reconnectionData) {
      clearTimeout(reconnectionData.timeoutId);
      passengerReconnectionMap.delete(bookingId);
      logger.info('Timeout tracking cleaned up', { bookingId });
    }
  } catch (error) {
    logger.error('Error cleaning up timeout tracking', {
      bookingId,
      error: error.message
    });
  }
}

module.exports = {
  handleBookingLifecycle,
  handlePassengerReconnection,
  cleanupTimeoutTracking,
  updateBookingStatus,
  removeBookingFromDriverList,
  removeBookingFromOtherDrivers,
  cleanUpCache,
  cleanUpCacheForOtherDrivers,
  sendNotificationToDriver,
  sendNotificationToPassenger
};