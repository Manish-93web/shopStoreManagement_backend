import mongoose, { Schema, Document } from 'mongoose';

export interface IThemeConfig extends Document {
    storeId: mongoose.Types.ObjectId;
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    logoUrl?: string;
    faviconUrl?: string;
    brandName: string;
    fontFamily: string;
    borderRadius: string;
    createdAt: Date;
    updatedAt: Date;
}

const ThemeConfigSchema: Schema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, unique: true, index: true },
    primaryColor: { type: String, default: '#6366f1' },       // Indigo
    accentColor: { type: String, default: '#8b5cf6' },        // Violet
    backgroundColor: { type: String, default: '#0f0f1a' },    // Dark navy
    textColor: { type: String, default: '#f8fafc' },          // Near-white
    logoUrl: { type: String },
    faviconUrl: { type: String },
    brandName: { type: String, default: 'RetailSync' },
    fontFamily: { type: String, default: 'Inter' },
    borderRadius: { type: String, default: '0.75rem' },       // 12px rounded
}, { timestamps: true });

export default mongoose.model<IThemeConfig>('ThemeConfig', ThemeConfigSchema);
