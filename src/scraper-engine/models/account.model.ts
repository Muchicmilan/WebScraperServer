import mongoose, {Document, Schema} from 'mongoose';
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY as string;
const IV_LENGTH = 16;

function encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string): string {
    if (!text || !text.includes(':')) {
        console.error("Decryption failed: Invalid input format. Expected 'iv:encrypted_data'.");
        throw new Error("Invalid encrypted text format for decryption.");
    }

    const textParts = text.split(':');

    const ivHex = textParts.shift()!;
    const encryptedTextHex = textParts.join(':');

    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedTextHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

export interface IAccount extends Document {
    platform: string;
    username: string;
    password?: string;
    decryptPassword: () => string;
}

const AccountSchema = new Schema<IAccount>({
    platform: { type: String, required: true, index: true },
    username: { type: String, required: true },
    password: { type: String, required: true },
}, { timestamps: true });

AccountSchema.pre<IAccount>('save', function(next) {
    if (this.isModified('password') && this.password) {
        this.password = encrypt(this.password);
    }
    next();
});

AccountSchema.methods.decryptPassword = function(): string {
    return decrypt(this.password);
};

export const AccountModel = mongoose.model<IAccount>('Account', AccountSchema);