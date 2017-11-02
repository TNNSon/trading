import {CURRENCY_TYPE} from "./Common";
import mongoose = require("mongoose");

var _ = require("lodash");
export const SCHEMA = {
    PRICE_TYPE: {
        fee: {
            type: Number,
            default: 0
        },
        currency: {
            type: String,
            enum: {
                values: _.toArray(CURRENCY_TYPE),
                default: CURRENCY_TYPE.VN
            }
        }
    },
    CURRENCY_TYPE: {
        type: String,
        enum: {
            values: _.toArray(CURRENCY_TYPE),
            default: CURRENCY_TYPE.USD
        }
    },
    NUMBER_TYPE: {
        type: Number,
        default: 0
    },

    DB_REF: {
        ACCOUNT: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'accounts'
        },
        USER: {
            type: Number,
            ref: 'users'
        },
        CONTACT: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'contacts'
        },
        TOKEN: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'tokens'
        },
        CAMPAIGN: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'campaigns'
        },
        CONTENT: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'contents'
        },
        CHANNEL: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'channels'
        },
        LINK: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'links'
        },
        WHITELABEL: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'whitelabels'
        },
        AUTOMATION: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'automations'
        },
        AUTOMATION_STEP: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'automationSteps'
        },
        AUTOMATION_OBJECT: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'automationObjects'
        },
        FIELD: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'fields'
        },
        TEMPLATE: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'templates'
        },
        CLICK: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'clicks'
        },
        WEBFORM_SUBMISSION: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'webformSubmissions'
        },
        USAGE: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'usages'
        },
        WEBFORM: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'webforms'
        },
        SEGMENT: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'segments'
        },
        WEBFORM_VIEW: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'webformViews'
        }
    }
};