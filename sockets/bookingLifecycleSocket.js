const bookingLifecycleHandler = require('../services/bookingLifecycleHandler');
const logger = require('../utils/logger');

/**
 * Socket handlers for booking lifecycle events
 */
function attachBookingLifecycleSocketHandlers(io) {
  // Handle passenger disconnection
  io.on('connection', (socket) => {
    // Handle passenger disconnection event
    socket.on('passenger:disconnect', async (data) => {
      try {
        const { bookingId } = data;
        if (!bookingId) {
          socket.emit('error', { message: 'Booking ID is required' });
          return;
        }

        await bookingLifecycleHandler.handleBookingLifecycle({
          bookingId,
          passengerDisconnected: true,
          driverAccepted: true,
          passengerId: socket.userId
        });

        socket.emit('passenger:disconnect:handled', { 
          success: true, 
          bookingId,
          message: 'Disconnection handled, timeout started' 
        });

        logger.info('Passenger disconnection handled via socket', {
          bookingId,
          passengerId: socket.userId,
          socketId: socket.id
        });

      } catch (error) {
        logger.error('Error handling passenger disconnection via socket', {
          error: error.message,
          bookingId: data.bookingId,
          socketId: socket.id
        });
        socket.emit('error', { message: 'Failed to handle disconnection' });
      }
    });

    // Handle passenger reconnection event
    socket.on('passenger:reconnect', async (data) => {
      try {
        const { bookingId } = data;
        if (!bookingId) {
          socket.emit('error', { message: 'Booking ID is required' });
          return;
        }

        bookingLifecycleHandler.handlePassengerReconnection(bookingId);

        socket.emit('passenger:reconnect:handled', { 
          success: true, 
          bookingId,
          message: 'Reconnection handled, cancellation timeout cleared' 
        });

        logger.info('Passenger reconnection handled via socket', {
          bookingId,
          passengerId: socket.userId,
          socketId: socket.id
        });

      } catch (error) {
        logger.error('Error handling passenger reconnection via socket', {
          error: error.message,
          bookingId: data.bookingId,
          socketId: socket.id
        });
        socket.emit('error', { message: 'Failed to handle reconnection' });
      }
    });

    // Handle passenger cancellation
    socket.on('passenger:cancel', async (data) => {
      try {
        const { bookingId, reason } = data;
        if (!bookingId) {
          socket.emit('error', { message: 'Booking ID is required' });
          return;
        }

        // Get booking details first
        const { Booking } = require('../models/bookingModels');
        const booking = await Booking.findById(bookingId);
        
        if (!booking) {
          socket.emit('error', { message: 'Booking not found' });
          return;
        }

        await bookingLifecycleHandler.handleBookingLifecycle({
          bookingId,
          passengerCancels: true,
          driverId: booking.driverId,
          passengerId: booking.passengerId
        });

        socket.emit('passenger:cancel:handled', { 
          success: true, 
          bookingId,
          message: 'Booking canceled successfully' 
        });

        logger.info('Passenger cancellation handled via socket', {
          bookingId,
          passengerId: socket.userId,
          socketId: socket.id,
          reason
        });

      } catch (error) {
        logger.error('Error handling passenger cancellation via socket', {
          error: error.message,
          bookingId: data.bookingId,
          socketId: socket.id
        });
        socket.emit('error', { message: 'Failed to cancel booking' });
      }
    });

    // Handle driver acceptance
    socket.on('driver:accept', async (data) => {
      try {
        const { bookingId, vehicleType, location, pricing } = data;
        if (!bookingId) {
          socket.emit('error', { message: 'Booking ID is required' });
          return;
        }

        // Get booking details first
        const { Booking } = require('../models/bookingModels');
        const booking = await Booking.findById(bookingId);
        
        if (!booking) {
          socket.emit('error', { message: 'Booking not found' });
          return;
        }

        await bookingLifecycleHandler.handleBookingLifecycle({
          bookingId,
          driverAccepted: true,
          driverId: socket.userId,
          passengerId: booking.passengerId,
          vehicleType: vehicleType || booking.vehicleType,
          location,
          pricing
        });

        socket.emit('driver:accept:handled', { 
          success: true, 
          bookingId,
          message: 'Booking accepted successfully' 
        });

        logger.info('Driver acceptance handled via socket', {
          bookingId,
          driverId: socket.userId,
          socketId: socket.id,
          vehicleType,
          location
        });

      } catch (error) {
        logger.error('Error handling driver acceptance via socket', {
          error: error.message,
          bookingId: data.bookingId,
          socketId: socket.id
        });
        socket.emit('error', { message: 'Failed to accept booking' });
      }
    });

    // Handle driver cancellation
    socket.on('driver:cancel', async (data) => {
      try {
        const { bookingId, reason } = data;
        if (!bookingId) {
          socket.emit('error', { message: 'Booking ID is required' });
          return;
        }

        // Get booking details first
        const { Booking } = require('../models/bookingModels');
        const booking = await Booking.findById(bookingId);
        
        if (!booking) {
          socket.emit('error', { message: 'Booking not found' });
          return;
        }

        // Update booking status
        await bookingLifecycleHandler.updateBookingStatus({
          id: bookingId,
          requesterType: 'driver',
          status: 'canceled',
          current: 'canceled',
          canceledBy: 'driver',
          canceledReason: reason || 'Driver canceled the booking'
        });

        // Notify passenger
        await bookingLifecycleHandler.sendNotificationToPassenger(booking.passengerId, {
          message: "The driver has canceled your booking.",
          status: "canceled",
          bookingId: bookingId,
          type: 'booking_canceled_by_driver'
        });

        socket.emit('driver:cancel:handled', { 
          success: true, 
          bookingId,
          message: 'Booking canceled successfully' 
        });

        logger.info('Driver cancellation handled via socket', {
          bookingId,
          driverId: socket.userId,
          socketId: socket.id,
          reason
        });

      } catch (error) {
        logger.error('Error handling driver cancellation via socket', {
          error: error.message,
          bookingId: data.bookingId,
          socketId: socket.id
        });
        socket.emit('error', { message: 'Failed to cancel booking' });
      }
    });

    // Handle socket disconnection cleanup
    socket.on('disconnect', () => {
      try {
        // Clean up any pending timeouts for this socket's user
        // This is a basic cleanup - in production you might want more sophisticated tracking
        logger.info('Socket disconnected, cleaning up lifecycle tracking', {
          socketId: socket.id,
          userId: socket.userId
        });
      } catch (error) {
        logger.error('Error during socket disconnect cleanup', {
          error: error.message,
          socketId: socket.id,
          userId: socket.userId
        });
      }
    });
  });
}

module.exports = { attachBookingLifecycleSocketHandlers };