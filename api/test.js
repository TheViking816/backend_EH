module.exports = (req, res) => {
  res.status(200).json({
    message: 'Backend is working!',
    method: req.method,
    timestamp: new Date().toISOString()
  });
};
