import mongoose, {Schema} from "mongoose";

export interface ILoginConfig {
    requiresLogin: boolean;
    accountId?: mongoose.Types.ObjectId;
    loginUrl?: string;
    usernameSelector?: string;
    passwordSelector?: string;
    submitButtonSelector?: string;
    postLoginSelector?: string;
}

export const LoginConfigSchema = new Schema<ILoginConfig>({
    requiresLogin: { type: Boolean, default: false },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: function() { return (this as ILoginConfig).requiresLogin; } },
    loginUrl: { type: String, required: function() { return (this as ILoginConfig).requiresLogin; } },
    usernameSelector: { type: String, required: function() { return (this as ILoginConfig).requiresLogin; } },
    passwordSelector: { type: String, required: function() { return (this as ILoginConfig).requiresLogin; } },
    submitButtonSelector: { type: String, required: function() { return (this as ILoginConfig).requiresLogin; } },
    postLoginSelector: { type: String, required: function() { return (this as ILoginConfig).requiresLogin; } },
}, { _id: false });