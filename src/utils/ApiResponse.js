class ApiResponse {
    constructor(statusCode, message = "Success", data) {
        this.success = success;
        this.message = message;
        this.data = data;
        this.statusCode = statusCode < 400;
    }
}

export default ApiResponse;