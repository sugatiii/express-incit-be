export const formatErrorResponse = (error) => {
    if (error.name === 'SequelizeValidationError') {
      // Extract and return validation error messages
      return error.errors.map(e => e.message)?.join(', ');
    }
    if (error.name === 'SequelizeUniqueConstraintError') {
      // Extract and return validation error messages
      return error.errors.map(e => e.message)?.join(', ');
    }
    // Return a general error message for other types of errors
    return error.message;
  };
  