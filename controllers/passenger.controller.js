const passengerService = require('../services/passengerService');
const errorHandler = require('../utils/errorHandler');

exports.create = async (req, res) => {
  try {
    return res.status(501).json({ message: 'Passenger creation is managed by the external user service.' });
  } catch (e) { errorHandler(res, e); }
};

exports.list = async (req, res) => {
  try {
    const { listPassengers } = require('../integrations/userServiceClient');
    const rows = await listPassengers(req.query || {}, { headers: req.headers && req.headers.authorization ? { Authorization: req.headers.authorization } : undefined });
    return res.json(rows);
  } catch (e) { errorHandler(res, e); }
};

exports.get = async (req, res) => {
  try {
    const { getPassengerById } = require('../integrations/userServiceClient');
    const info = await getPassengerById(req.params.id, { headers: req.headers && req.headers.authorization ? { Authorization: req.headers.authorization } : undefined });
    if (!info) return res.status(404).json({ message: 'Passenger not found' });
    return res.json(info);
  } catch (e) { errorHandler(res, e); }
};

exports.update = async (req, res) => {
  try {
    return res.status(501).json({ message: 'Passenger updates are managed by the external user service.' });
  } catch (e) { errorHandler(res, e); }
};

exports.remove = async (req, res) => {
  try {
    return res.status(501).json({ message: 'Passenger deletion is managed by the external user service.' });
  } catch (e) { errorHandler(res, e); }
};

exports.getMyProfile = async (req, res) => {
  try {
    if (req.user.type !== 'passenger') return res.status(403).json({ message: 'Only passengers can access this endpoint' });
    const { getPassengerById } = require('../integrations/userServiceClient');
    const passenger = await getPassengerById(req.user.id, { headers: req.headers && req.headers.authorization ? { Authorization: req.headers.authorization } : undefined });
    if (!passenger) return res.status(404).json({ message: 'Passenger not found' });
    return res.json(passenger);
  } catch (e) { errorHandler(res, e); }
};

exports.updateMyProfile = async (req, res) => {
  try {
    return res.status(501).json({ message: 'Profile updates are managed by the external user service.' });
  } catch (e) { errorHandler(res, e); }
};

exports.deleteMyAccount = async (req, res) => {
  try {
    return res.status(501).json({ message: 'Account deletion is managed by the external user service.' });
  } catch (e) { errorHandler(res, e); }
};

exports.rateDriver = async (req, res) => {
  try {
    if (req.user.type !== 'passenger') return res.status(403).json({ message: 'Only passengers can rate drivers' });
    const { rating } = req.body;
    const driverId = req.params.driverId;
    const driver = await passengerService.rateDriver(driverId, rating);
    return res.json({ message: 'Driver rated successfully', driver });
  } catch (e) { errorHandler(res, e); }
};

