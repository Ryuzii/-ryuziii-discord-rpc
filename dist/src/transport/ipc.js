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
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPCTransport = void 0;
const events_1 = require("events");
const net = __importStar(require("net"));
const errors_1 = require("../errors");
// IPC Transport for Discord RPC
class IPCTransport extends events_1.EventEmitter {
    constructor(pipeId = 0) {
        super();
        this.socket = null;
        this.buffer = Buffer.alloc(0);
        this.pipe = process.platform === 'win32'
            ? `\\\\.\\pipe\\discord-ipc-${pipeId}`
            : `/tmp/discord-ipc-${pipeId}`;
    }
    connect() {
        return new Promise((resolve, reject) => {
            this.socket = net.createConnection(this.pipe, () => {
                this.emit('open');
                resolve();
            });
            this.socket.on('data', (data) => this.handleData(data));
            this.socket.on('error', (err) => {
                this.emit('error', new errors_1.DiscordRPCError('IPC connection error: ' + err.message));
                reject(err);
            });
            this.socket.on('close', () => this.emit('close'));
        });
    }
    send(op, data) {
        if (!this.socket)
            throw new errors_1.DiscordRPCError('IPC socket not connected');
        const payload = Buffer.from(JSON.stringify(data), 'utf8');
        const header = Buffer.alloc(8);
        header.writeInt32LE(op, 0);
        header.writeInt32LE(payload.length, 4);
        this.socket.write(Buffer.concat([header, payload]));
    }
    handleData(data) {
        this.buffer = Buffer.concat([this.buffer, data]);
        while (this.buffer.length >= 8) {
            const op = this.buffer.readInt32LE(0);
            const len = this.buffer.readInt32LE(4);
            if (this.buffer.length < 8 + len)
                break;
            const json = this.buffer.slice(8, 8 + len).toString('utf8');
            try {
                const message = JSON.parse(json);
                this.emit('message', op, message);
            }
            catch (e) {
                this.emit('error', new errors_1.DiscordRPCError('Failed to parse IPC message'));
            }
            this.buffer = this.buffer.slice(8 + len);
        }
    }
    close() {
        this.socket?.end();
        this.socket = null;
    }
}
exports.IPCTransport = IPCTransport;
