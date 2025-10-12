"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDatabase = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined in environment variables');
}
const connectDatabase = async () => {
    try {
        await mongoose_1.default.connect(DATABASE_URL);
        console.log('Connected to MongoDB');
    }
    catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};
exports.connectDatabase = connectDatabase;
