/**
 * Standardized API response format
 * All responses follow: { success, message, data, pagination? }
 */

const sendSuccess = (res, data = {}, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const sendCreated = (res, data = {}, message = 'Created successfully') => {
  return sendSuccess(res, data, message, 201);
};

const sendPaginated = (res, result, message = 'Success') => {
  const { docs, totalDocs, limit, page, totalPages, hasPrevPage, hasNextPage } = result;
  return res.status(200).json({
    success: true,
    message,
    data: docs,
    pagination: {
      total: totalDocs,
      page,
      limit,
      totalPages,
      hasPrevPage,
      hasNextPage,
    },
  });
};

const sendError = (res, message = 'An error occurred', statusCode = 500, errors = null) => {
  const response = { success: false, message };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
};

const sendNotFound = (res, message = 'Resource not found') =>
  sendError(res, message, 404);

const sendUnauthorized = (res, message = 'Unauthorized') =>
  sendError(res, message, 401);

const sendForbidden = (res, message = 'Forbidden') =>
  sendError(res, message, 403);

const sendBadRequest = (res, message = 'Bad request', errors = null) =>
  sendError(res, message, 400, errors);

const sendConflict = (res, message = 'Conflict') =>
  sendError(res, message, 409);

module.exports = {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendError,
  sendNotFound,
  sendUnauthorized,
  sendForbidden,
  sendBadRequest,
  sendConflict,
};
