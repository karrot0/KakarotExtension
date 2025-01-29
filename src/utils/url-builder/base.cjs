"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.URLBuilder = void 0;
var URLBuilder = /** @class */ (function () {
    function URLBuilder(baseUrl) {
        this.queryParams = {};
        this.pathSegments = [];
        this.baseUrl = baseUrl.replace(/\/+$/, "");
    }
    URLBuilder.prototype.formatArrayQuery = function (key, value) {
        return value.length > 0 ? value.map(function (v) { return "".concat(key, "[]=").concat(v); }) : [];
    };
    URLBuilder.prototype.formatObjectQuery = function (key, value) {
        return Object.entries(value)
            .map(function (_a) {
            var objKey = _a[0], objValue = _a[1];
            return objValue !== undefined ? "".concat(key, "[").concat(objKey, "]=").concat(objValue) : undefined;
        })
            .filter(function (x) { return x !== undefined; });
    };
    URLBuilder.prototype.formatQuery = function (queryParams) {
        var _this = this;
        return Object.entries(queryParams)
            .flatMap(function (_a) {
            var key = _a[0], value = _a[1];
            // Handle string[]
            if (Array.isArray(value)) {
                return _this.formatArrayQuery(key, value);
            }
            // Handle objects
            if (typeof value === "object") {
                return _this.formatObjectQuery(key, value);
            }
            // Default handling
            return value === "" ? [] : ["".concat(key, "=").concat(value)];
        })
            .join("&");
    };
    URLBuilder.prototype.build = function () {
        var fullPath = this.pathSegments.length > 0 ? "/".concat(this.pathSegments.join("/")) : "";
        var queryString = this.formatQuery(this.queryParams);
        if (queryString.length > 0)
            return "".concat(this.baseUrl).concat(fullPath, "?").concat(queryString);
        return "".concat(this.baseUrl).concat(fullPath);
    };
    URLBuilder.prototype.addPath = function (segment) {
        this.pathSegments.push(segment.replace(/^\/+|\/+$/g, ""));
        return this;
    };
    URLBuilder.prototype.addQuery = function (key, value) {
        this.queryParams[key] = value;
        return this;
    };
    URLBuilder.prototype.reset = function () {
        this.queryParams = {};
        this.pathSegments = [];
        return this;
    };
    return URLBuilder;
}());
exports.URLBuilder = URLBuilder;
