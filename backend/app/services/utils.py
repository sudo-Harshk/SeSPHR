from flask import jsonify, make_response


def api_success(data=None):
    """
    Create a standardized success response.
    
    Args:
        data: Optional data to include in the response
        
    Returns:
        Flask response with JSON: {"success": true, "data": data, "error": null}
    """
    return jsonify({
        "success": True,
        "data": data,
        "error": None
    })


def api_error(message, status_code=400):
    """
    Create a standardized error response.
    
    Args:
        message: Error message string
        status_code: HTTP status code (default: 400)
        
    Returns:
        Flask response with JSON: {"success": false, "data": null, "error": message}
    """
    response = make_response(jsonify({
        "success": False,
        "data": None,
        "error": message
    }))
    response.status_code = status_code
    return response

