"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
process.env.PRISMA_CLIENT_ENGINE_TYPE = "library";
var http_1 = __importDefault(require("http"));
var url_1 = require("url");
var next_1 = __importDefault(require("next"));
var socket_io_1 = require("socket.io");
var cookie = __importStar(require("cookie"));
var jwt_1 = require("next-auth/jwt");
var prisma_1 = require("./src/lib/prisma");
var dev = process.env.NODE_ENV !== "production";
var PORT = Number((_a = process.env.PORT) !== null && _a !== void 0 ? _a : 3000);
// For development, we allow all localhost variants
var ALLOWED_ORIGINS = [
    process.env.NEXT_PUBLIC_API_URL,
    "http://localhost:".concat(PORT),
    "http://127.0.0.1:".concat(PORT),
].filter(Boolean);
var app = (0, next_1.default)({ dev: dev });
var handle = app.getRequestHandler();
var server = http_1.default.createServer(function (req, res) {
    var _a;
    var parsedUrl = (0, url_1.parse)((_a = req.url) !== null && _a !== void 0 ? _a : "", true);
    handle(req, res, parsedUrl);
});
var io = new socket_io_1.Server(server, {
    cors: {
        origin: function (origin, callback) {
            if (!origin || ALLOWED_ORIGINS.includes(origin) || dev) {
                callback(null, true);
            }
            else {
                callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true,
    },
    // Use polling then upgrade for better compatibility
    transports: ["polling", "websocket"],
});
io.use(function (socket, next) { return __awaiter(void 0, void 0, void 0, function () {
    var req, cookieHeader, cookies, secret, cookieNames, token, _i, cookieNames_1, cookieName, error_1;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 5, , 6]);
                req = socket.request;
                cookieHeader = (_b = (_a = req.headers) === null || _a === void 0 ? void 0 : _a.cookie) !== null && _b !== void 0 ? _b : "";
                cookies = cookie.parse(cookieHeader);
                req.cookies = cookies;
                secret = process.env.NEXTAUTH_SECRET;
                if (!secret) {
                    console.error("NEXTAUTH_SECRET is not defined");
                    return [2 /*return*/, next(new Error("Server configuration error"))];
                }
                cookieNames = [
                    "__Secure-next-auth.session-token",
                    "next-auth.session-token",
                ];
                token = null;
                _i = 0, cookieNames_1 = cookieNames;
                _c.label = 1;
            case 1:
                if (!(_i < cookieNames_1.length)) return [3 /*break*/, 4];
                cookieName = cookieNames_1[_i];
                return [4 /*yield*/, (0, jwt_1.getToken)({
                        req: req,
                        secret: secret,
                        secureCookie: cookieName.startsWith("__Secure-"),
                        cookieName: cookieName,
                    })];
            case 2:
                token = _c.sent();
                if (token)
                    return [3 /*break*/, 4];
                _c.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4:
                if (!(token === null || token === void 0 ? void 0 : token.sub)) {
                    console.log("Socket Auth Failed: No valid token found in cookies");
                    return [2 /*return*/, next(new Error("Unauthorized"))];
                }
                socket.data.userId = token.sub;
                next();
                return [3 /*break*/, 6];
            case 5:
                error_1 = _c.sent();
                console.error("Socket Auth Error:", error_1);
                next(new Error("Socket authentication failed"));
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); });
io.on("connection", function (socket) {
    var userId = socket.data.userId;
    var room = "user:".concat(userId);
    console.log("Socket connected: ".concat(socket.id, " for user: ").concat(userId));
    socket.join(room);
    socket.on("clipboard:update", function (payload, callback) { return __awaiter(void 0, void 0, void 0, function () {
        var result_1, item, result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!payload || typeof payload.content !== "string") {
                        return [2 /*return*/, callback({ error: "Invalid clipboard payload." })];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    // If content is empty or whitespace only, broadcast but don't save to DB
                    if (!payload.content.trim()) {
                        result_1 = {
                            id: "temporary-empty",
                            content: "",
                            createdAt: new Date().toISOString(),
                        };
                        io.to(room).emit("clipboard:updated", result_1);
                        return [2 /*return*/, callback({ item: result_1 })];
                    }
                    return [4 /*yield*/, (0, prisma_1.getPrisma)().copyItem.create({
                            data: {
                                content: payload.content,
                                userId: userId,
                            },
                        })];
                case 2:
                    item = _a.sent();
                    result = {
                        id: item.id,
                        content: item.content,
                        createdAt: item.createdAt.toISOString(),
                    };
                    // Emit to all devices of the same user, including the sender
                    io.to(room).emit("clipboard:updated", result);
                    callback({ item: result });
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _a.sent();
                    console.error("Database error in clipboard:update:", error_2);
                    callback({ error: "Failed to save clipboard in real-time." });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    socket.on("disconnect", function (reason) {
        console.log("Socket disconnected: ".concat(socket.id, ", reason: ").concat(reason));
    });
});
app.prepare().then(function () {
    server.listen(PORT, function () {
        console.log("> Ready on http://localhost:".concat(PORT, " [").concat(process.env.NODE_ENV || "development", "]"));
    });
});
