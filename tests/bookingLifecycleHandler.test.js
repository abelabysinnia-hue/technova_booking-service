const bookingLifecycleHandler = require('../services/bookingLifecycleHandler');
const { Booking } = require('../models/bookingModels');
const logger = require('../utils/logger');

// Mock the dependencies
jest.mock('../sockets/utils', () => ({
  sendMessageToSocketId: jest.fn(),
  broadcast: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('Booking Lifecycle Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleBookingLifecycle', () => {
    it('should handle passenger cancellation scenario', async () => {
      const mockBooking = {
        _id: 'booking123',
        passengerId: 'passenger123',
        driverId: 'driver123',
        status: 'accepted'
      };

      jest.spyOn(Booking, 'findByIdAndUpdate').mockResolvedValue(mockBooking);
      jest.spyOn(Booking, 'findById').mockResolvedValue(mockBooking);

      const params = {
        bookingId: 'booking123',
        passengerCancels: true,
        driverId: 'driver123',
        passengerId: 'passenger123'
      };

      await bookingLifecycleHandler.handleBookingLifecycle(params);

      expect(Booking.findByIdAndUpdate).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Passenger cancellation handled successfully',
        expect.any(Object)
      );
    });

    it('should handle passenger disconnection scenario', async () => {
      const mockBooking = {
        _id: 'booking123',
        passengerId: 'passenger123',
        driverId: 'driver123',
        status: 'accepted'
      };

      jest.spyOn(Booking, 'findById').mockResolvedValue(mockBooking);

      const params = {
        bookingId: 'booking123',
        passengerDisconnected: true,
        driverAccepted: true,
        driverId: 'driver123',
        passengerId: 'passenger123'
      };

      await bookingLifecycleHandler.handleBookingLifecycle(params);

      expect(logger.info).toHaveBeenCalledWith(
        'Passenger disconnection timeout set',
        expect.any(Object)
      );
    });

    it('should handle driver acceptance scenario', async () => {
      const mockBooking = {
        _id: 'booking123',
        passengerId: 'passenger123',
        driverId: 'driver123',
        status: 'requested'
      };

      jest.spyOn(Booking, 'findByIdAndUpdate').mockResolvedValue(mockBooking);

      const params = {
        bookingId: 'booking123',
        driverAccepted: true,
        driverId: 'driver123',
        passengerId: 'passenger123',
        vehicleType: 'mini',
        location: { latitude: 9.0192, longitude: 38.7525 },
        pricing: { fare: 25.50 }
      };

      await bookingLifecycleHandler.handleBookingLifecycle(params);

      expect(Booking.findByIdAndUpdate).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Driver acceptance handled successfully',
        expect.any(Object)
      );
    });
  });

  describe('updateBookingStatus', () => {
    it('should update booking status successfully', async () => {
      const mockBooking = {
        _id: 'booking123',
        status: 'canceled'
      };

      jest.spyOn(Booking, 'findByIdAndUpdate').mockResolvedValue(mockBooking);

      const result = await bookingLifecycleHandler.updateBookingStatus({
        id: 'booking123',
        requesterType: 'passenger',
        status: 'canceled',
        current: 'canceled'
      });

      expect(result).toEqual(mockBooking);
      expect(Booking.findByIdAndUpdate).toHaveBeenCalledWith(
        'booking123',
        { status: 'canceled' },
        { new: true }
      );
    });

    it('should throw error when booking not found', async () => {
      jest.spyOn(Booking, 'findByIdAndUpdate').mockResolvedValue(null);

      await expect(
        bookingLifecycleHandler.updateBookingStatus({
          id: 'nonexistent',
          requesterType: 'passenger',
          status: 'canceled',
          current: 'canceled'
        })
      ).rejects.toThrow('Booking with ID nonexistent not found');
    });
  });

  describe('handlePassengerReconnection', () => {
    it('should clear timeout when passenger reconnects', () => {
      const bookingId = 'booking123';
      
      // Mock the reconnection map
      const mockTimeoutId = setTimeout(() => {}, 1000);
      bookingLifecycleHandler.passengerReconnectionMap = new Map();
      bookingLifecycleHandler.passengerReconnectionMap.set(bookingId, {
        timeoutId: mockTimeoutId,
        hasReconnected: false
      });

      bookingLifecycleHandler.handlePassengerReconnection(bookingId);

      expect(logger.info).toHaveBeenCalledWith(
        'Passenger reconnected, cancellation timeout cleared',
        { bookingId }
      );
    });
  });
});

// Example usage tests
describe('Example Usage', () => {
  it('should demonstrate passenger cancellation flow', async () => {
    const params = {
      bookingId: 'booking123',
      passengerCancels: true,
      driverId: 'driver123',
      passengerId: 'passenger123'
    };

    // This would be called when a passenger cancels their booking
    await expect(
      bookingLifecycleHandler.handleBookingLifecycle(params)
    ).resolves.not.toThrow();
  });

  it('should demonstrate driver acceptance flow', async () => {
    const params = {
      bookingId: 'booking123',
      driverAccepted: true,
      driverId: 'driver123',
      passengerId: 'passenger123',
      vehicleType: 'mini',
      location: { latitude: 9.0192, longitude: 38.7525 },
      pricing: { fare: 25.50 }
    };

    // This would be called when a driver accepts a booking
    await expect(
      bookingLifecycleHandler.handleBookingLifecycle(params)
    ).resolves.not.toThrow();
  });
});